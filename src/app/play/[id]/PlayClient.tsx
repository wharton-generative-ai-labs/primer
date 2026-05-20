"use client";

import React, {
  Suspense,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  useMemo,
} from "react";
import { flushSync } from "react-dom";

import { TranscriptProvider, useTranscript } from "@/app/contexts/TranscriptContext";
import { EventProvider } from "@/app/contexts/EventContext";
import { SceneProvider } from "@/app/contexts/SceneContext";
import { ClientEventProvider } from "@/app/contexts/ClientEventContext";
import PlayPage, { type PlayPageFooterApi } from "@/app/components/PlayPage";
import PrimerBackground from "@/app/components/PrimerBackground";
import ExperienceTitle from "@/app/components/ExperienceTitle";
import ExperienceBuildSequence, {
  BuildingPanel,
  type BuildPhase,
  type SequencePhase,
} from "@/app/components/ExperienceBuildSequence";
import { SessionRecoveryDialog } from "@/app/components/SessionRecoveryDialog";
import { ComponentScripts } from "@/app/components/ComponentScripts";
import {
  getConfig,
  getValidationReport,
  seedExperienceConfig,
} from "@/app/lib/configUtils";
import { createSoundManager } from "@/app/lib/tools/sound";
import { createSceneManager, getSceneManager } from "@/app/lib/SceneManager";
import {
  ExperienceMetadata,
  AgentConfig,
  SessionStatus,
} from "@/app/lib/types";
import { setSessionId, getExistingSessionId } from "@/app/lib/session-utils";
import { useArtifact, type Artifact } from "@/app/contexts/ArtifactContext";
import type { PanelStateRecord } from "@/app/lib/panel-state";
import { chooseSessionAction } from "@/app/server-actions/play";
import { SessionEvent } from "@/app/lib/file-utils";
import { pickWelcomeSceneKey } from "@/app/lib/pickWelcomeSceneKey";
import { createModuleLogger } from "@/lib/logger";

const playBootstrapLogger = createModuleLogger("PlayClient.bootstrap");

function getPreparingCopy(kind?: string): string {
  return kind === "meta"
    ? "Your experience creator is being prepared."
    : "Your experience is being prepared.";
}

/** Two rAFs: wait until after the next paint so the checklist can settle. */
function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

export interface PlayClientPreviousSession {
  sessionId: string;
  experienceId: string;
  startTime: string;
  lastActivity?: string;
  userName?: string;
  userEmail?: string;
}

export interface PlayClientPreviousSessionInfo {
  session: PlayClientPreviousSession;
  hasArtifacts: boolean;
  isCompleted: boolean;
  lastEvent: SessionEvent | null;
}

/**
 * Streamed-from-RSC payload describing this user's starting state for the
 * experience. Either:
 * - `previousSession` is set and `preCreatedSessionId` is `null` (returning
 *   user → recovery dialog drives the choice client-side), or
 * - `previousSession` is `null` and `preCreatedSessionId` carries the
 *   server-issued id of the row the RSC just wrote to disk.
 */
export interface PlayClientSessionPayload {
  previousSession: PlayClientPreviousSessionInfo | null;
  preCreatedSessionId: string | null;
}

interface PlayClientProps {
  experienceId: string;
  title: string;
  kind?: string;
  hasComponents: boolean;
  hasReadme: boolean;
  canViewTechnical: boolean;
  /**
   * Verbatim `experience.json` payload from the RSC. Seeded into the client
   * config cache on first render so the bootstrap doesn't have to refetch it.
   */
  bootstrapConfigText: string;
  /**
   * Streamed-unawaited session lookup + fresh-row creation. `PlayClientInner`
   * unwraps it via React's `use()` inside a Suspense boundary; while it's
   * pending, the chrome + BuildingPanel "all pending" fallback paints
   * synchronously on first render so the user sees the loading shell during
   * the round trip.
   */
  sessionPromise: Promise<PlayClientSessionPayload>;
}

/**
 * After WebRTC is `CONNECTED` in the pre-play window (welcome morph),
 * wait this long for a visible transcript `MESSAGE` before showing `PlayPage`
 * anyway, so a stuck or silent agent does not block the user forever.
 */
const FIRST_MESSAGE_FALLBACK_MS = 25_000;

/**
 * Outer chrome for `/play/[id]`. Renders synchronously on first hydration
 * tick using props that arrived with the RSC payload — the title, the
 * primer backdrop, the header, and the footer wiring — so the user never
 * sees a blank screen during the streaming round trip while the inner
 * unwraps `sessionPromise` via `use()`.
 *
 * Phase ownership lives in `PlayClientInner`; this outer component reads a
 * `revealBackdrop` flag back through a callback so {@link PrimerBackground}
 * can trigger its 4 s desaturation reveal exactly when the inner transitions
 * out of `'loading'` (not on mount, which would race the loading checklist).
 */
export default function PlayClient(props: PlayClientProps) {
  // Seed the config cache so the bootstrap effect inside `PlayClientInner`
  // resolves `experience.json` from the seeded entry instead of hitting the
  // network. Idempotent under strict-mode double invocation. `useEffect` (not
  // `useLayoutEffect`) avoids SSR "useLayoutEffect does nothing on the server"
  // noise for this client-only cache write.
  useEffect(() => {
    seedExperienceConfig(
      `/api/storage/${props.experienceId}/experience.json`,
      props.bootstrapConfigText,
    );
  }, [props.experienceId, props.bootstrapConfigText]);

  const footerApiRef = useRef<PlayPageFooterApi | null>(null);
  const [transcriptActive, setTranscriptActive] = useState(false);
  const [eventsActive, setEventsActive] = useState(false);
  const [debugActive, setDebugActive] = useState(false);

  // Inner phase mirrored up so the chrome (PrimerBackground reveal,
  // PlayPage visibility) can react. Defaults to `'loading'` so the very
  // first paint matches `loading.tsx` / the Suspense fallback below.
  const [phase, setPhase] = useState<SequencePhase | "play">("loading");
  const revealBackdrop = phase !== "loading";

  return (
    // `ClientEventProvider` lives inside `PlayClientInner` so it can read
    // the freshly-bound `dataChannel`. The chrome above (Header / Footer /
    // PrimerBackground / ExperienceTitle) doesn't consume the context, so
    // suspending below the providers is safe.
    <SceneProvider>
        <TranscriptProvider>
          <EventProvider>
            <ComponentScripts hasComponents={props.hasComponents} />
            <PrimerBackground
              darkOverlay
              showOverlays
              useInitialBackdrop
              triggerTransition={revealBackdrop}
              // PrimerBackground starts the 4 s reveal immediately when
              // `loadingPhase` is anything other than `'loading'`. Keeping
              // it pegged at `'loading'` until the inner exits the checklist
              // means the initial backdrop holds during the checklist and
              // only dissolves once the bootstrap is genuinely complete.
              loadingPhase={phase === "loading" ? "loading" : "ready"}
              footerType={props.kind === 'meta' ? 'builder' : 'lesson'}
              onFooterBack={() => footerApiRef.current?.onRequestLeave?.()}
              onTranscript={() =>
                footerApiRef.current?.onToggleTranscript?.()
              }
              transcriptActive={transcriptActive}
              onEvents={
                props.canViewTechnical && debugActive
                  ? () => footerApiRef.current?.onToggleEvents?.()
                  : undefined
              }
              eventsActive={eventsActive}
              onInfo={
                props.hasReadme
                  ? () => footerApiRef.current?.onOpenInfo?.()
                  : undefined
              }
              onBug={
                props.canViewTechnical
                  ? () => footerApiRef.current?.onToggleDebug?.()
                  : undefined
              }
              bugActive={debugActive}
            >
              <Suspense
                fallback={
                  // Mirrors the layout `PlayClientInner` paints during the
                  // loading phase so the Suspense → resolved transition is
                  // visually a no-op. When the RSC inlined experience.json,
                  // step 1 is already done — show it checked from the start.
                  <div className="flex h-full flex-col items-center justify-start gap-6 px-4 pt-10">
                    <ExperienceTitle title={getPreparingCopy(props.kind)} />
                    <BuildingPanel
                      mode={
                        props.bootstrapConfigText
                          ? { kind: "loading", firedPhases: new Set<BuildPhase>(["experience-data"]) }
                          : { kind: "allPending" }
                      }
                    />
                  </div>
                }
              >
                <PlayClientInner
                  experienceId={props.experienceId}
                  title={props.title}
                  kind={props.kind}
                  hasReadme={props.hasReadme}
                  bootstrapConfigText={props.bootstrapConfigText}
                  sessionPromise={props.sessionPromise}
                  onPhaseChange={setPhase}
                  footerApiRef={footerApiRef}
                  onTranscriptActive={setTranscriptActive}
                  onEventsActive={setEventsActive}
                  onDebugActive={setDebugActive}
                />
              </Suspense>
            </PrimerBackground>
          </EventProvider>
        </TranscriptProvider>
      </SceneProvider>
  );
}

interface PlayClientInnerProps {
  experienceId: string;
  title: string;
  kind?: string;
  hasReadme: boolean;
  /**
   * Non-empty when the RSC inlined `experience.json` in the SSR payload,
   * meaning the server already completed the `experience-data` step. Used
   * to pre-check step 1 of the loading checklist on first render.
   */
  bootstrapConfigText: string;
  sessionPromise: Promise<PlayClientSessionPayload>;
  onPhaseChange: (phase: SequencePhase | "play") => void;
  footerApiRef: React.MutableRefObject<PlayPageFooterApi | null>;
  onTranscriptActive: (active: boolean) => void;
  onEventsActive: (active: boolean) => void;
  onDebugActive: (active: boolean) => void;
}

/**
 * Phase host for `/play/[id]`. Owns the `loading → (welcome?) → play`
 * state machine and every side effect that can't run before the streamed
 * `sessionPromise` resolves:
 * - install the server-issued session id (no-previous-session path),
 * - subscribe to `ConfigLoader` phase events to drive the BuildingPanel,
 * - kick off `getConfig()` / `createSoundManager` / `createSceneManager`,
 * - on bootstrap complete, either morph to the welcome image card
 *   (if a `welcome*` scene exists) or pre-mount `PlayPage` hidden so the
 *   realtime session can connect while the checklist is still visible.
 *
 * **`play` (split layout) readiness:** We no longer advance on
 * `sessionStatus === "CONNECTED"` alone. The user stays on
 * `ExperienceBuildSequence` (loading/welcome) until **both** the realtime
 * connection is up **and** a visible `MESSAGE` exists in `TranscriptContext`
 * (so the in-chat "Waiting for conversation to begin…" line does not
 * show on first paint), or until {@link FIRST_MESSAGE_FALLBACK_MS} from the
 * first time both were true: pre-play window + `CONNECTED` + no message yet.
 *
 * Errors from any phase land here as a single `error` state, which renders
 * the {@link BuildingPanel} `'error'` mode.
 */
function PlayClientInner({
  experienceId,
  title,
  kind,
  hasReadme,
  bootstrapConfigText,
  sessionPromise,
  onPhaseChange,
  footerApiRef,
  onTranscriptActive,
  onEventsActive,
  onDebugActive,
}: PlayClientInnerProps) {
  const { transcriptItems } = useTranscript();
  const hasVisibleConversationMessage = useMemo(
    () =>
      transcriptItems.some(
        (i) => i.type === "MESSAGE" && !i.isHidden,
      ),
    [transcriptItems],
  );
  // Suspends until the RSC's streamed promise resolves. `useTranscript` and
  // the memo above must run before `use()` so hook order is stable if this
  // pass suspends. While suspended, the outer Suspense boundary paints the
  // BuildingPanel "all pending" fallback.
  const sessionPayload = use(sessionPromise);
  const { previousSession, preCreatedSessionId } = sessionPayload;

  const { bootstrapArtifactsForSession, seedPanelState, resetPanelState } =
    useArtifact();

  // Install the server-issued session id ASAP so the bootstrap effect
  // below sees it on its first run. Effect (not render) so we don't mutate
  // during a strict-mode discarded render.
  useEffect(() => {
    if (preCreatedSessionId) {
      setSessionId(preCreatedSessionId);
    }
  }, [preCreatedSessionId]);

  // Phase machine. `'play'` is technically still inside the BuildSequence
  // host — but instead of rendering a panel for it, we mount `PlayPage` and
  // hide the sequence. The outer reads this via `onPhaseChange` to drive
  // the backdrop reveal.
  type Phase = SequencePhase | "play";
  const [phase, setPhase] = useState<Phase>("loading");
  const advance = useCallback(
    (next: Phase) => {
      setPhase(next);
      onPhaseChange(next);
    },
    [onPhaseChange],
  );

  // Pre-check step 1 when the RSC inlined experience.json — the server already
  // completed the experience-data fetch before the client rendered anything.
  const [firedPhases, setFiredPhases] = useState<ReadonlySet<BuildPhase>>(
    () => bootstrapConfigText ? new Set<BuildPhase>(["experience-data"]) : new Set<BuildPhase>(),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [agents, setAgents] = useState<Record<string, AgentConfig>>({});
  const [aiConfigurations, setAIConfigurations] = useState<
    Record<string, unknown>
  >({});
  const [toolsRegistered, setToolsRegistered] = useState(false);
  const [experienceMetadata, setExperienceMetadata] =
    useState<ExperienceMetadata | null>(null);
  const [welcomeSceneImageUrl, setWelcomeSceneImageUrl] = useState<
    string | undefined
  >(undefined);
  /** True once loadExperience fully completes; gates PlayPage pre-mount and preplay effect. */
  const [bootstrapDone, setBootstrapDone] = useState(false);
  /** For advancing to play when CONNECTED arrives; mirrors PlayPage callbacks. */
  const [lastSessionStatus, setLastSessionStatus] =
    useState<SessionStatus | null>(null);
  const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null);

  const hasWelcomeImage = welcomeSceneImageUrl != null;

  // Recovery-dialog overlay state. Only rendered while phase === 'loading'
  // so it cleanly disappears once the bootstrap advances.
  const [showSessionRecovery, setShowSessionRecovery] = useState<boolean>(
    !!previousSession,
  );
  const [sessionDecisionMade, setSessionDecisionMade] = useState<boolean>(
    !previousSession,
  );
  const [decisionPending, startDecisionTransition] = useTransition();

  const previousSessionId = previousSession?.session.sessionId;
  const recordDecision = useCallback(
    (decision: "continue" | "fresh") => {
      startDecisionTransition(async () => {
        const continueId =
          decision === "continue" ? previousSessionId : undefined;
        const result = await chooseSessionAction(
          experienceId,
          decision,
          continueId,
        );
        if (!result.success || !result.sessionId) {
          setErrorMessage(
            result.error ||
              "Could not record your session decision. Please refresh and try again.",
          );
          setShowSessionRecovery(false);
          advance("error");
          return;
        }
        setSessionId(result.sessionId);
        setShowSessionRecovery(false);
        setSessionDecisionMade(true);
      });
    },
    [advance, experienceId, previousSessionId],
  );

  const handleContinueSession = useCallback(
    () => recordDecision("continue"),
    [recordDecision],
  );
  const handleStartFresh = useCallback(
    () => recordDecision("fresh"),
    [recordDecision],
  );

  // Bootstrap effect: only runs once the user has implicitly or explicitly
  // chosen a session (no-previous path is auto; recovery dialog flips
  // `sessionDecisionMade` on success). Subscribes to `ConfigLoader` phase
  // events and emits a synthetic `'starting-up'` once Sound + Scene
  // managers exist.
  useEffect(() => {
    if (!sessionDecisionMade) return;

    let cancelled = false;
    const observed = new Set<BuildPhase>();
    /** One UI snapshot per phase tick; drained one frame at a time (see pump). */
    const phasePaintQueue: Set<BuildPhase>[] = [];
    let paintPumpScheduled = false;
    let paintRafId: number | null = null;

    const pumpPhasePaint = () => {
      if (cancelled) {
        phasePaintQueue.length = 0;
        paintPumpScheduled = false;
        paintRafId = null;
        return;
      }
      const firedSnapshot = phasePaintQueue.shift();
      if (!firedSnapshot) {
        paintPumpScheduled = false;
        paintRafId = null;
        return;
      }
      flushSync(() => {
        setFiredPhases(firedSnapshot);
      });
      if (phasePaintQueue.length > 0) {
        paintRafId = requestAnimationFrame(pumpPhasePaint);
      } else {
        paintPumpScheduled = false;
        paintRafId = null;
      }
    };

    const handlePhase = (loadPhase: BuildPhase) => {
      if (cancelled) return;
      observed.add(loadPhase);
      const firedSnapshot = new Set(observed);
      // `getConfig` can replay many phases in one synchronous turn. Microtasks
      // + flushSync still run before the next paint, so the user only saw the
      // last commit. Queue snapshots and apply one per animation frame so the
      // browser can paint between checklist steps. rAF is outside React commit,
      // so flushSync here does not hit the lifecycle flushSync warning.
      phasePaintQueue.push(firedSnapshot);
      if (!paintPumpScheduled) {
        paintPumpScheduled = true;
        paintRafId = requestAnimationFrame(pumpPhasePaint);
      }
      playBootstrapLogger.debug(
        { phase: loadPhase, firedPhases: Array.from(observed) },
        "Build checklist phase tick",
      );
    };

    async function loadExperience() {
      try {
        const configUrl = `/api/storage/${experienceId}/experience.json`;
        const sid = getExistingSessionId();

        // Wipe any panel slice left over from a previously-mounted experience.
        // ArtifactProvider is app-wide so its state survives client navigations;
        // without this, All Documents leaks docs from the prior experience.
        resetPanelState();

        // Kick off artifact bootstrap in parallel with config load — it only
        // needs experienceId + sessionId, so there's no dependency on getConfig.
        const artifactBootstrapPromise: Promise<Artifact[]> = sid
          ? bootstrapArtifactsForSession({ experienceId, sessionId: sid }).catch(
              (err) => {
                playBootstrapLogger.warn({ err }, "artifact bootstrap failed");
                return [];
              },
            )
          : Promise.resolve([]);

        const config = await getConfig(configUrl, handlePhase);
        if (cancelled) return;

        const validationReport = getValidationReport();
        if (validationReport?.hasErrors && validationReport.statuses) {
          const errorMessages = validationReport.statuses
            .filter(
              (s) =>
                s.status === "MISSING" || s.status === "INVALID_PLACEHOLDER",
            )
            .map(
              (s) =>
                `${s.objectPath} ${s.status}: ${
                  s.statusDetail ? ` - ${s.statusDetail}` : ""
                }`,
            )
            .join("\n");
          throw new Error(errorMessages);
        }

        // Spin up audio + scene managers synchronously so they are queryable
        // before any subsequent async steps. `'starting-up'` is deferred until
        // all bootstrap work is done and the redirect is imminent — it fires
        // just before waitForNextPaint so the user sees the final checkmark
        // for one frame before the play surface appears.
        createSoundManager({ sounds: config.resources.sounds });
        createSceneManager({ scenes: config.resources.scenes });

        // Await artifacts — likely already resolved since getConfig takes longer.
        const artifacts = await artifactBootstrapPromise;
        if (cancelled) return;

        if (sid) {
          try {
            const panelRes = await fetch(
              `/api/sessions/${encodeURIComponent(sid)}/panel-state`,
              {
                headers: { "x-experience-id": experienceId },
              },
            );
            if (panelRes.ok) {
              const data = (await panelRes.json()) as PanelStateRecord | null;
              if (data && typeof data.updatedAt === "string") {
                seedPanelState(data, artifacts);
              }
            }
          } catch (panelErr) {
            playBootstrapLogger.warn(
              { err: panelErr },
              "panel-state restore failed",
            );
          }
        }

        if (cancelled) return;

        // Welcome morph image: prefer Primer Experience Creator's
        // `creator_welcome` chalkboard, else any `welcome*` basename, else any
        // key containing `welcome` (e.g. `foo_welcome`). No match → no image;
        // no-welcome path stays in 'loading'; preplay effect drives → play.
        let sceneUrl: string | undefined;
        try {
          const sceneManager = getSceneManager();
          const welcomeKey = pickWelcomeSceneKey(
            sceneManager.getAvailableScenes(),
          );
          if (welcomeKey) {
            sceneUrl = sceneManager.getScenePath(welcomeKey);
          }
        } catch {
          // SceneManager throws if uninitialized — shouldn't happen here.
        }
        // Preload the welcome image so the browser can fetch it while the
        // checklist is still visible.
        if (sceneUrl) {
          const preload = new window.Image();
          preload.src = sceneUrl;
        }
        setWelcomeSceneImageUrl(sceneUrl);

        setAIConfigurations(config.aiConfigurations ?? {});
        setToolsRegistered(true);
        setAgents(config.agents);
        setExperienceMetadata({
          ...config.metadata,
          title,
          hasReadme,
          ...(kind ? { kind } : {}),
        });

        // All bootstrap work is done. Tick 'starting-up' now — it's the last
        // checklist step and signals that the redirect is about to happen.
        // waitForNextPaint lets the browser paint the completed checklist
        // (all five steps green) for one frame before the play surface appears.
        handlePhase("starting-up");

        playBootstrapLogger.info(
          {
            experienceId,
            firedPhases: Array.from(observed),
          },
          "Experience bootstrap finished",
        );
        await waitForNextPaint();
        if (cancelled) return;

        // Bootstrap complete — mark done and transition directly to welcome
        // (if a welcome image exists) or stay in 'loading' so the preplay
        // effect can drive → play once CONNECTED + first message arrive.
        setBootstrapDone(true);
        if (sceneUrl) {
          advance("welcome");
        }
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while loading the Experience.";
        setErrorMessage(message);
        setExperienceMetadata(null);
        setAgents({});
        setToolsRegistered(false);
        setAIConfigurations({});
        advance("error");
      }
    }

    loadExperience();
    return () => {
      cancelled = true;
      if (paintRafId != null) {
        cancelAnimationFrame(paintRafId);
        paintRafId = null;
      }
      phasePaintQueue.length = 0;
      paintPumpScheduled = false;
    };
  }, [
    advance,
    experienceId,
    sessionDecisionMade,
    title,
    kind,
    hasReadme,
    bootstrapArtifactsForSession,
    seedPanelState,
    resetPanelState,
  ]);

  // welcome → play (or no-welcome: loading + bootstrapDone → play) only when the realtime
  // path is up **and** the first visible transcript line exists (or fallback
  // timer). `handleSessionStatusChange` only mirrors status into state; the
  // transition is centralized in the effect below.
  const handleSessionStatusChange = useCallback((status: SessionStatus) => {
    setLastSessionStatus(status);
  }, []);

  const preplayConnectStartedAtRef = useRef<number | null>(null);
  const playAdvanceFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    const clearFallback = () => {
      if (playAdvanceFallbackRef.current) {
        clearTimeout(playAdvanceFallbackRef.current);
        playAdvanceFallbackRef.current = null;
      }
    };

    if (phase === "play") {
      preplayConnectStartedAtRef.current = null;
      clearFallback();
      return;
    }

    const inPreplay =
      (phase === "welcome" && hasWelcomeImage) ||
      (phase === "loading" && bootstrapDone && !hasWelcomeImage);

    if (!inPreplay || lastSessionStatus !== "CONNECTED") {
      preplayConnectStartedAtRef.current = null;
      clearFallback();
      return;
    }

    if (hasVisibleConversationMessage) {
      preplayConnectStartedAtRef.current = null;
      clearFallback();
      advance("play");
      return;
    }

    if (preplayConnectStartedAtRef.current === null) {
      preplayConnectStartedAtRef.current = Date.now();
    }
    const startedAt = preplayConnectStartedAtRef.current;
    const elapsed = Date.now() - startedAt;
    if (elapsed >= FIRST_MESSAGE_FALLBACK_MS) {
      preplayConnectStartedAtRef.current = null;
      clearFallback();
      advance("play");
      return;
    }

    clearFallback();
    playAdvanceFallbackRef.current = setTimeout(() => {
      playAdvanceFallbackRef.current = null;
      advance("play");
    }, FIRST_MESSAGE_FALLBACK_MS - elapsed);
    return clearFallback;
  }, [
    advance,
    phase,
    hasWelcomeImage,
    lastSessionStatus,
    bootstrapDone,
    hasVisibleConversationMessage,
  ]);

  const handleSendClientEvent = useCallback(
    (eventObj: Record<string, unknown>) => {
      if (dataChannel && dataChannel.readyState === "open") {
        dataChannel.send(JSON.stringify(eventObj));
      }
    },
    [dataChannel],
  );

  const sequencePhase: SequencePhase =
    phase === "play" ? "welcome" : phase;

  // PlayPage pre-mounts hidden once bootstrap is done, so the realtime
  // connection can establish while the welcome card (or final checklist) is
  // still visible. Toggling visibility (not swapping subtrees) keeps the
  // WebRTC session stable across the welcome → play hand-off.
  const playPageMounted = !!experienceMetadata && bootstrapDone;
  const playPageHidden = phase !== "play";

  return (
    // ClientEventProvider lives here (not in the outer chrome) so its
    // `sendClientEvent` closes over the freshly-bound `dataChannel`. Above
    // this Suspense boundary nothing reads the context, so the outer
    // chrome doesn't need its own provider.
    <ClientEventProvider sendClientEvent={handleSendClientEvent}>
      {/*
        Two rendered branches keep PlayPage stable across the
        welcome → play hand-off:
        - "checklist" branch: title + ExperienceBuildSequence, centered,
          rendered for every phase except 'play' (so welcome shows the
          welcome card while PlayPage is pre-mounted hidden below).
        - "playpage" branch: full-bleed PlayPage, rendered as soon as
          `experienceMetadata` lands once bootstrapDone is set, hidden until
          phase === 'play' so the visible flip is just a CSS toggle.
        Putting both in the same render and toggling visibility (rather
        than swapping subtrees) is what makes the connect-during-welcome
        (or connect-during-loading) trick work.
      */}
      <div
        className={
          phase === "play"
            ? "hidden"
            : "flex h-full flex-col items-center justify-start gap-6 px-4 pt-10"
        }
        aria-hidden={phase === "play" || undefined}
      >
        <ExperienceTitle title={getPreparingCopy(kind)} />
        <ExperienceBuildSequence
          phase={sequencePhase}
          firedPhases={firedPhases}
          title={title}
          welcomeSceneImageUrl={welcomeSceneImageUrl}
          errorMessage={errorMessage ?? undefined}
        />
      </div>

      {playPageMounted && experienceMetadata && (
        <div
          className={playPageHidden ? "hidden" : "contents"}
          aria-hidden={playPageHidden || undefined}
        >
          <PlayPage
            setDataChannel={setDataChannel}
            experienceId={experienceId}
            experienceMetadata={experienceMetadata}
            agents={agents}
            toolsRegistered={toolsRegistered}
            aiConfigurations={aiConfigurations}
            footerApiRef={footerApiRef}
            onFooterTranscriptActive={onTranscriptActive}
            onFooterEventsActive={onEventsActive}
            onFooterDebugActive={onDebugActive}
            onSessionStatusChange={handleSessionStatusChange}
          />
        </div>
      )}

      {showSessionRecovery && previousSession && phase === "loading" && (
        <SessionRecoveryDialog
          isOpen={showSessionRecovery}
          sessionInfo={previousSession.session}
          hasArtifacts={previousSession.hasArtifacts}
          isCompleted={previousSession.isCompleted}
          lastEvent={previousSession.lastEvent}
          pending={decisionPending}
          onContinueSession={handleContinueSession}
          onStartFresh={handleStartFresh}
        />
      )}
    </ClientEventProvider>
  );
}
