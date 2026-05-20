"use client";

import { ServerEvent, SessionStatus, AgentConfig, ToolResponse } from "@/app/lib/types";
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";
import { useScene } from "@/app/hooks/useScene";
import { useFileUpload } from "@/app/contexts/FileUploadContext";
import { useContext, useRef } from "react";
import { ToolRegistry } from "@/app/lib/ToolRegistry";
import { useExperienceUrl } from "@/app/hooks/useExperienceUrl";
import { useArtifact } from "@/app/contexts/ArtifactContext";
import { useLayout } from "@/app/contexts/LayoutContext";
import { WorkflowPhaseContext } from "@/app/contexts/WorkflowPhaseContext";
import { getSceneUrl } from '@/app/lib/scene-utils';
import { getSceneManager } from '@/app/lib/SceneManager';
import { ToolContext } from '@/app/lib/tools/types';
import { createModuleLogger } from "@/lib/logger";
import { generateUUID } from '@/app/lib/uuid';

const logger = createModuleLogger('useHandleServerEvent');
// ✅ CENTRALIZED IMPORTS - migrated tools
import { SoundToolContext, getSoundManager } from '@/app/lib/tools/sound';
import { ExperienceToolContext, getExperienceManager } from '@/app/lib/tools/experience';
import { WebSearchToolContext, getWebSearchManager } from '@/app/lib/tools/research';
import { ImageGeneratorToolContext, getImageGeneratorManager } from '@/app/lib/tools/image-generator';
// Note: Information tool is now backend-first, no client-side manager needed
// ✅ CENTRALIZED IMPORTS - UI components migrated
import { MermaidToolContext, getMermaidManager } from '@/app/lib/tools/ui/mermaid/index';
import { toast } from "@/hooks/use-toast";
import { pushInlineChatToast } from '@/app/lib/inlineChatToasts';
import { handleToolResponse, getGlobalSocket } from '@/app/lib/tools/client/tool-calling-shim';

export interface UseHandleServerEventParams {
  setSessionStatus: (status: SessionStatus) => void;
  selectedAgentKey: string;
  agents: Record<string, AgentConfig>;
  sendClientEvent: (eventObj: any, eventNameSuffix?: string) => void;
  setIsAIAudioPlaying: (isPlaying: boolean) => void;
  setQueuedAgentTransfer: (key: string | null) => void;
  isDebugModeEnabled: boolean;
  showChecklist?: (artifactId: string) => void;
  hideChecklist?: () => void;
  onSessionUpdated: () => void;
}

export function useHandleServerEvent({
  setSessionStatus,
  selectedAgentKey,
  agents,
  sendClientEvent,
  setIsAIAudioPlaying,
  setQueuedAgentTransfer,
  isDebugModeEnabled,
  showChecklist,
  hideChecklist,
  onSessionUpdated,
}: UseHandleServerEventParams) {
  const {
    transcriptItems,
    addTranscriptBreadcrumb,
    addTranscriptBreadcrumbWithId,
    addTranscriptHandoff,
    addTranscriptToolError,
    updateTranscriptBreadcrumb,
    addTranscriptMessage,
    updateTranscriptMessage,
    updateTranscriptItemStatus,
  } = useTranscript();
  const { logServerEvent } = useEvent();
  const { setScene, showScene, hideScene, currentScene, isSceneVisible } = useScene();
  const { showFileUpload } = useFileUpload();
  const { getExperienceId } = useExperienceUrl();
  const toolRegistry = ToolRegistry.getInstance();
  const {
    listArtifacts,
    createArtifact,
    deleteArtifact,
    updateArtifact,
    getArtifact,
    showContent,
    clearContent,
    activeContent,
    library,
    viewedContent,
    artifacts,
    viewState,
  } = useArtifact();
  const {
    isDocumentVisible,
    setDocumentVisible,
    getWorkspaceLayout,
    documentTab,
  } = useLayout();
  // Optional: not every harness mount wires the provider. Tools that depend
  // on the workflow-phase capability degrade to "not available in context"
  // when the provider is absent.
  const workflowPhaseContext = useContext(WorkflowPhaseContext);

  const handleFunctionCall = async (function_request: {
    name: string;
    call_id?: string;
    arguments: string;
  }) => {
    logger.debug({ arguments: function_request.arguments }, 'Raw fn args');
    const args = JSON.parse(function_request.arguments);

    // Create a context object for tool execution
    const experienceId = getExperienceId();
    if (!experienceId) {
      logger.error({ functionName: function_request.name }, 'No experience ID found when executing tool');
      throw new Error('Experience ID is required');
    }

    const functionCallId = function_request.call_id;

    // context should be created based on target tool's advertised dependencies (eventually)
    const toolContext: ToolContext &
      SoundToolContext &
      ExperienceToolContext &
      WebSearchToolContext &
      ImageGeneratorToolContext &
      MermaidToolContext = {
      functionCallId,
      transcriptItems,
      selectedAgentKey,
      agents,
      experienceId,
      setScene,
      showScene,
      hideScene,
      setDocumentVisible,
      sendClientEvent,
      showFileUpload,
      addTranscriptBreadcrumb,
      addTranscriptHandoff,
      setQueuedAgentTransfer,
      listArtifacts,
      createArtifact: (name: string, content: string, type: string, metadata?: any) =>
        createArtifact(name, content, type, metadata, { agentKey: selectedAgentKey }),
      deleteArtifact,
      updateArtifact: (id: string, content: string, metadata?: any) =>
        updateArtifact(id, content, metadata, { agentKey: selectedAgentKey }),
      // ToolContext signature is (id, includeContent?, rev?) — includeContent
      // is legacy/ignored, but kept in the type for backward compat. The
      // ArtifactContext getArtifact only takes (id, rev?), so wrap to drop
      // the unused middle arg.
      getArtifact: (id: string, _includeContent?: boolean, rev?: number) =>
        getArtifact(id, rev),
      getSceneUrl,
      getAvailableScenes: () => getSceneManager().getAvailableScenes(),
      addCustomScene: (sceneName: string, imageUrl: any) => {
        const sceneManager = getSceneManager();
        sceneManager.addCustomScene(sceneName, { path: imageUrl, url: imageUrl });
        return { result: true };
      },
      removeCustomScene: (sceneName) => {
        const result = getSceneManager().removeCustomScene(sceneName);
        return { result };
      },
      getAvailableSounds: () => getSoundManager().getAvailableSounds(),
      playSound: (sound: string, options?: { volume?: number, loop?: boolean }) => getSoundManager().playSound(sound, options),
      createExperience: () => getExperienceManager().createExperience(),
      copyTemplate: (templateExperienceId) => getExperienceManager().copyTemplate(templateExperienceId),
      createDirectory: (experienceId, path) => getExperienceManager().createDirectory(experienceId, path),
      createFile: (experienceId, path, content, contentEncoding) => getExperienceManager().createFile(experienceId, path, content, contentEncoding),
      deleteDirectory: (experienceId, path) => getExperienceManager().deleteDirectory(experienceId, path),
      deleteFile: (experienceId, path) => getExperienceManager().deleteFile(experienceId, path),
      moveFile: (experienceId, sourcePath, destinationPath) => getExperienceManager().moveFile(experienceId, sourcePath, destinationPath),
      moveDirectory: (experienceId, sourcePath, destinationPath) => getExperienceManager().moveDirectory(experienceId, sourcePath, destinationPath),
      listResources: (experienceId) => getExperienceManager().listResources(experienceId),
      getResourceContent: (experienceId, path) => getExperienceManager().getResourceContent(experienceId, path),
      searchWeb: (query) => getWebSearchManager().searchWeb(query),
      generateImage: (prompt, options) => getImageGeneratorManager().generateImage(prompt, options),
      showMermaidDiagram: (title: string, diagram: string) => {
        // Route diagrams into the split-panel DocumentPanel (single content slot)
        // rather than the old full-screen overlay. Keep the manager call in sync
        // in case anything else still reads from it.
        const diagramId = `diagram-${generateUUID()}`;
        showContent({ kind: 'diagram', id: diagramId, name: title, diagram });
        setDocumentVisible(true);
        return getMermaidManager().showMermaidDiagram(title, diagram);
      },
      hideDiagram: () => {
        // In the split-panel layout the right pane holds one piece of content
        // at a time, so `hideDiagram` has ambiguous semantics — it only made
        // sense when diagrams were a separate overlay. We keep the manager call
        // for back-compat; the pane clears when the next show* call replaces it.
        return getMermaidManager().hideDiagram();
      },
      // Note: Information and note tools are now backend-first, they use their respective stores on the server
      showChecklist: showChecklist || (() => logger.warn({}, 'showChecklist not available')),
      hideChecklist: hideChecklist || (() => logger.warn({}, 'hideChecklist not available')),
      toast: (options: { title: string; variant?: 'default' | 'destructive' }) => {
        toast({
          title: options.title,
          variant: options.variant || 'default',
        });
        if (!options.variant || options.variant === 'default') {
          pushInlineChatToast(options.title);
        }
        // Surface an actionable failure signal on non-interactive phase
        // surfaces. When the orchestrator reports a destructive toast (e.g.
        // "I'm having trouble delegating...") during a build/result phase,
        // the user has no chat input to ask for a retry — they're stuck
        // staring at a frozen checklist. Emit a `phase-failure` window event
        // so BuildPhaseSurface / ResultPhaseSurface can render a Retry
        // button. Interactive phases keep the plain toast since the user
        // can still type a follow-up.
        if (options.variant === 'destructive') {
          const current = workflowPhaseContext?.currentPhase;
          if (
            current &&
            (current.mode === 'build' || current.mode === 'result')
          ) {
            try {
              window.dispatchEvent(
                new CustomEvent('phase-failure', {
                  detail: {
                    phaseId: current.id,
                    message: options.title,
                  },
                }),
              );
            } catch {
              // window may be unavailable in some environments; the toast
              // alone still surfaces the error and we don't want to break
              // the tool callback over the optional retry affordance.
            }
          }
        }
      },
      // Custom component event callbacks
      onComponentEvent: (event) => {
        logger.info('Component event received', event);
        
        // Send event as system message so it's in context but hidden from transcript
        sendClientEvent({
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "system",
            content: [{
              type: "input_text",
              text: `[Component Event] ${event.componentId}: ${event.eventType}\n${JSON.stringify(event.eventData, null, 2)}`
            }]
          }
        });
        
        // Trigger agent response
        sendClientEvent({
          type: "response.create"
        });
      },
      onComponentStateChange: (event) => {
        logger.info('Component state changed', event);
        // Optionally log state changes without notifying agent
        // (Agent will be notified via onComponentEvent for important events)
      },
      // Workflow-phase capabilities. These flip on only when a
      // WorkflowPhaseProvider is mounted around this hook (PlayPageInner does).
      // Each capability defers to the provider for navigation; the agent tool
      // never mutates the server directly from the realtime path.
      ...(workflowPhaseContext
        ? {
            getWorkflowPhases: () => workflowPhaseContext.phases,
            getWorkflowPhaseState: () => ({
              currentPhase: workflowPhaseContext.currentPhase?.id,
              furthestPhase: workflowPhaseContext.furthestPhase?.id,
              visited: workflowPhaseContext.visited,
              completedPhases: workflowPhaseContext.completedPhases,
              completedObjectives: workflowPhaseContext.completedObjectives,
              nextPhaseOverride: workflowPhaseContext.nextPhaseOverride,
              snapshots: {},
            }),
            getCurrentWorkflowPhase: () => {
              const current = workflowPhaseContext.currentPhase;
              if (!current) return null;
              const idx = workflowPhaseContext.phases.findIndex(
                (p) => p.id === current.id,
              );
              return {
                id: current.id,
                title: current.title,
                index: idx,
                total: workflowPhaseContext.phases.length,
                isCompleted: workflowPhaseContext.completedPhases.includes(
                  current.id,
                ),
                nextPhaseOverride: workflowPhaseContext.nextPhaseOverride,
                resolvedNextPhaseId: workflowPhaseContext.resolvedNextPhaseId,
              };
            },
            setWorkflowPhase: async (op, _meta) => {
              // Every op delegates to the provider so the response is applied
              // to local state (completedPhases, nextPhaseOverride,
              // experienceCompleted). Bypassing the provider — which the
              // pre-A14 implementation did for everything except `advance` —
              // leaves the strip's Next button stuck because its gating reads
              // from the provider's state.
              try {
                switch (op.kind) {
                  case 'advance': {
                    await workflowPhaseContext.advance({ trigger: 'agent' });
                    return {
                      result: true,
                      currentPhase: workflowPhaseContext.currentPhase?.id,
                    };
                  }
                  case 'complete': {
                    const r = await workflowPhaseContext.complete();
                    return r.ok
                      ? { result: true, currentPhase: r.currentPhase }
                      : { result: false, message: r.message };
                  }
                  case 'nextPhase': {
                    const r = await workflowPhaseContext.nextPhase();
                    return r.ok
                      ? { result: true, currentPhase: r.currentPhase }
                      : { result: false, message: r.message };
                  }
                  case 'set': {
                    const r = await workflowPhaseContext.setPhase(op.targetPhase);
                    return r.ok
                      ? { result: true, currentPhase: r.currentPhase }
                      : { result: false, message: r.message };
                  }
                  case 'setNext': {
                    const r = await workflowPhaseContext.setNext(op.targetPhase);
                    return r.ok
                      ? { result: true, nextPhaseOverride: r.nextPhaseOverride }
                      : { result: false, message: r.message };
                  }
                  case 'markObjective': {
                    const r = await workflowPhaseContext.markObjective(
                      op.id,
                      op.note ? { note: op.note } : undefined,
                    );
                    return r.ok
                      ? { result: true, currentPhase: r.currentPhase }
                      : { result: false, message: r.message };
                  }
                  default:
                    // Other ops (`init`, `goTo`, `finishExperience`, `rewind`)
                    // are not part of the agent tool's surface — they belong
                    // to the user/system path. Reject explicitly so a stray
                    // call surfaces during testing.
                    return {
                      result: false,
                      message: `Unsupported transition op for setWorkflowPhase: ${(op as { kind: string }).kind}`,
                    };
                }
              } catch (e) {
                return {
                  result: false,
                  message:
                    e instanceof Error ? e.message : 'transition request failed',
                };
              }
            },
            suggestWorkflowPhaseReturn: (phaseId: string, reason: string) => {
              if (typeof window === 'undefined') return;
              window.dispatchEvent(
                new CustomEvent('workflow-phase-suggest-return', {
                  detail: { phaseId, reason },
                }),
              );
            },
            // `finishExperience` delegates to the provider so the closing
            // dialog appears immediately (driven by `experienceCompleted` in
            // the provider state). The manager handles idempotency: if the
            // flag is already set the second call is a no-op on the server.
            finishExperience: async (reason?: string) => {
              try {
                const r = await workflowPhaseContext.finishExperience(reason);
                return { result: r.ok };
              } catch {
                return { result: false };
              }
            },
          }
        : {}),
    };

    // Create breadcrumb ID for tracking
    const breadcrumbId = `tool-${functionCallId || generateUUID()}`;

    try {
      if (toolRegistry.hasToolWithName(function_request.name)) {
        if (isDebugModeEnabled) {
          addTranscriptBreadcrumbWithId(
            breadcrumbId,
            `Calling ${function_request.name}`,
            args,
            "IN_PROGRESS"
          );
        }
        
        const result = await toolRegistry.execute(function_request.name, args, toolContext) as ToolResponse;

        // After a successful agent.delegate call, the backend agent may have
        // executed workflowPhase transitions that bypassed the provider's
        // mutation callbacks. Re-fetch the canonical server state so the
        // strip's Next button reflects any completedPhases updates.
        if (
          result.status === 'success' &&
          function_request.name === 'agent' &&
          args?.action === 'delegate'
        ) {
          void workflowPhaseContext?.refetchState();
        }

        switch (result.status) {
          case 'deferred':
            if (isDebugModeEnabled) {
              updateTranscriptBreadcrumb(
                breadcrumbId,
                `Called ${function_request.name} (deferred)`,
                { status: 'deferred', message: result.message }
              );
              updateTranscriptItemStatus(breadcrumbId, "DONE");
            }
            return;

          case 'error':
            if (isDebugModeEnabled) {
              updateTranscriptBreadcrumb(
                breadcrumbId,
                `Called ${function_request.name} (error)`,
                { status: 'error', message: result.message, data: result.data }
              );
              updateTranscriptItemStatus(breadcrumbId, "DONE");
            }

            // Tool errors are always surfaced in the chat stream — previously
            // they were only visible when debug mode was on, which made
            // "agent says something weird" bugs impossible to diagnose in
            // normal use.
            addTranscriptToolError(
              function_request.name,
              result.message ?? 'Tool returned error',
              {
                args,
                data: result.data,
                call_id: function_request.call_id,
              }
            );

            sendClientEvent({
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: function_request.call_id,
                output: JSON.stringify({ error: result.message, ...result.data }),
              },
            });
            break;

          case 'success':
            if (isDebugModeEnabled) {
              updateTranscriptBreadcrumb(
                breadcrumbId,
                `Called ${function_request.name}`,
                { status: 'success', data: result.data }
              );
              updateTranscriptItemStatus(breadcrumbId, "DONE");
            }

            sendClientEvent({
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: function_request.call_id,
                output: JSON.stringify(result.data),
              },
            });
            break;

          default:
            if (isDebugModeEnabled) {
              updateTranscriptBreadcrumb(
                breadcrumbId,
                `Called ${function_request.name} (invalid)`,
                { status: 'error', message: `Tool returned unknown status: ${result.status}` }
              );
              updateTranscriptItemStatus(breadcrumbId, "DONE");
            }
            break;
        }
      } else {
        logger.warn({ functionName: function_request.name, args }, 'AI called unknown function');

        const simulatedResult = { result: true };
        if (isDebugModeEnabled) {
          addTranscriptBreadcrumbWithId(
            breadcrumbId,
            `${function_request.name} (SIMULATED)`,
            simulatedResult,
            "DONE"
          );
        }

        sendClientEvent({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: function_request.call_id,
            output: JSON.stringify(simulatedResult),
          },
        });
      }
    } catch (error) {
      logger.error({ err: error, functionName: function_request.name }, 'Error executing tool');

      // Send an error result back to the AI
      const errorResult = {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'error'
      };

      if (isDebugModeEnabled) {
        updateTranscriptBreadcrumb(
          breadcrumbId,
          `Called ${function_request.name} (error)`,
          errorResult
        );
        updateTranscriptItemStatus(breadcrumbId, "DONE");
      }

      // See the matching block in the 'error' case above — thrown exceptions
      // also need to surface so the user sees why the agent stalled.
      addTranscriptToolError(
        function_request.name,
        error instanceof Error ? error.message : 'Unknown error',
        { args, call_id: function_request.call_id }
      );

      sendClientEvent({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: function_request.call_id,
          output: JSON.stringify(errorResult),
        },
      });
    }

    // Always trigger a response after handling the function call
    sendClientEvent({ type: "response.create" });
  };

  const handleServerEvent = (serverEvent: ServerEvent) => {
    logServerEvent(serverEvent);

    if (!serverEvent.delta && serverEvent.type.startsWith("output_audio_buffer")) {
      setIsAIAudioPlaying(serverEvent.type === "output_audio_buffer.started");
    }

    switch (serverEvent.type) {
      case "session.created": {
        // OpenAI Realtime API session created
        if (serverEvent.session?.id) {
          logger.debug({ sessionId: serverEvent.session.id }, 'OpenAI realtime session created');
          if (isDebugModeEnabled) {
            addTranscriptBreadcrumb(
              "OpenAI Realtime session created",
              {
                id: serverEvent.session.id,
                started: new Date().toLocaleString()
              }
            );
          }
        }
        break;
      }

      case "socket.session.connected": {
        // Socket server connection established (distinct from OpenAI session)
        if (serverEvent.session?.id) {
          logger.debug({ sessionId: serverEvent.session.id }, 'Primer socket session connected, setting status to CONNECTED');
          setSessionStatus("CONNECTED");
          if (isDebugModeEnabled) {
            addTranscriptBreadcrumb(
              "Primer Socket connected",
              {
                id: serverEvent.session.id,
                connected: new Date().toLocaleString()
              }
            );
          }
        }
        break;
      }

      case "session.updated": {
        // Don't change status on session updates, just log it
        logger.debug({ session: serverEvent.session }, 'Session updated');
        // Notify that session was updated - this will increment sessionConfiguredCount
        // if there was a pending initial configuration
        onSessionUpdated();
        break;
      }

      case "error": {
        logger.error({
          error: serverEvent.error,
          type: serverEvent.error?.type,
          message: serverEvent.error?.message,
          code: serverEvent.error?.code
        }, 'Server error');
        
        // Handle different error types appropriately.
        //
        // Important: `setSessionStatus("DISCONNECTED")` here only flips React
        // state — it does NOT tear down the WebRTC peer connection. So if the
        // underlying connection is still healthy (audio/data channel still
        // flowing), forcing the status to DISCONNECTED creates a split-brain:
        // the user can keep talking to the agent but UI controls (mute,
        // speaker, etc.) gated on `CONNECTED` disappear. Only flip to
        // DISCONNECTED when we're confident the connection itself is dead.
        if (serverEvent.error?.type === 'authentication_error') {
          // Authentication failures usually mean the ephemeral key is
          // dead/expired — the connection cannot recover.
          setSessionStatus("DISCONNECTED");
        } else if (serverEvent.error?.type === 'invalid_request_error') {
          // `invalid_request_error` is the server rejecting a single client
          // event (e.g. a malformed `session.update`). The peer connection
          // itself stays open, so we log/breadcrumb but stay CONNECTED.
          // Tearing the UI down here would mislead the user about the actual
          // connection state.
          logger.warn({
            code: serverEvent.error?.code,
            param: serverEvent.error?.param,
            message: serverEvent.error?.message,
          }, 'Server rejected a client event; connection still healthy');
          if (isDebugModeEnabled) {
            addTranscriptBreadcrumb(
              "Recoverable Error",
              {
                type: serverEvent.error.type,
                code: serverEvent.error.code,
                param: serverEvent.error.param,
                message: serverEvent.error.message,
                action: "Continued (connection still open)"
              }
            );
          }
        } else {
          // For other error types, log but don't disconnect unless we know they're critical
          logger.warn({ type: serverEvent.error?.type }, 'Non-critical error, continuing');
        }
        break;
      }

      // GA Realtime API introduced `conversation.item.added`, fired when a
      // new item is added to the conversation (e.g., immediately after the
      // input audio buffer commits — before the transcript exists). We
      // handle it identically to the legacy `conversation.item.created`
      // event so the user message item gets registered in the transcript
      // panel; otherwise the later `input_audio_transcription.completed`
      // update is a no-op (it can only update existing items) and the
      // user's message never appears.
      case "conversation.item.added":
      case "conversation.item.created": {
        const content = serverEvent.item?.content;
        let text = "";
        
        // Handle regular message content
        if (Array.isArray(content)) {
          text = content[0]?.text || content[0]?.transcript || "";
        }
        
        const role = serverEvent.item?.role as "user" | "assistant" | "system";
        const itemId = serverEvent.item?.id;

        if (itemId && transcriptItems.some((item) => item.itemId === itemId)) {
          break;
        }

        // Only show user and assistant messages in transcript, skip system messages
        if (itemId && role && role !== "system") {
          if (role === "user" && !text) {
            text = "[Transcribing...]";
          }
          addTranscriptMessage(itemId, role, text);
        }
        break;
      }

      case "conversation.item.input_audio_transcription.completed": {
        const itemId = serverEvent.item_id;
        const finalTranscript =
          !serverEvent.transcript || serverEvent.transcript === "\n"
            ? "[inaudible]"
            : serverEvent.transcript;
        if (itemId) {
          updateTranscriptMessage(itemId, finalTranscript, false);
        }
        break;
      }

      // GA Realtime API: emitted when a conversation item is finalized. The
      // event includes the full content of the item (transcript for audio,
      // text for text). This is a defensive catch-all for both user and
      // assistant items — if the `added` / `created` event was missed, or
      // if streaming deltas didn't fire, this still surfaces the message
      // with its final text. Idempotent with the other handlers thanks to
      // the existence check inside `addTranscriptMessage` and the no-op
      // behavior of `updateTranscriptMessage` when nothing changed.
      case "conversation.item.done": {
        const item = serverEvent.item;
        const itemId = item?.id;
        const role = item?.role as "user" | "assistant" | "system" | undefined;
        if (!itemId || !role || role === "system") {
          break;
        }

        const content = item?.content;
        const finalText = Array.isArray(content)
          ? content[0]?.text || content[0]?.transcript || ""
          : "";

        const exists = transcriptItems.some((t) => t.itemId === itemId);
        if (!exists) {
          addTranscriptMessage(itemId, role, finalText);
        } else if (finalText) {
          updateTranscriptMessage(itemId, finalText, false);
        }
        updateTranscriptItemStatus(itemId, "DONE");
        break;
      }

      // GA Realtime API renamed the audio-transcript streaming events:
      //   legacy: response.audio_transcript.{delta,done}
      //   GA:     response.output_audio_transcript.{delta,done}
      // We handle both so non-GA realtime models (e.g. gpt-4o-realtime-preview)
      // still produce transcripts. Without the GA handler, the message item
      // gets created with an empty text and the conversation panel shows a
      // timestamp with no body.
      case "response.audio_transcript.delta":
      case "response.output_audio_transcript.delta": {
        const itemId = serverEvent.item_id;
        const deltaText = serverEvent.delta || "";
        if (itemId) {
          updateTranscriptMessage(itemId, deltaText, true);
        }
        break;
      }

      case "response.output_audio_transcript.done": {
        // Final, complete transcript for the audio output. We replace
        // (append=false) to make sure the rendered text matches the
        // server's authoritative version even if a delta got dropped.
        const itemId = serverEvent.item_id;
        const finalTranscript = serverEvent.transcript || "";
        if (itemId && finalTranscript) {
          updateTranscriptMessage(itemId, finalTranscript, false);
        }
        break;
      }

      case "response.text.delta": {
        const itemId = serverEvent.item_id;
        const deltaText = serverEvent.delta || "";
        if (itemId) {
          updateTranscriptMessage(itemId, deltaText, true);
        }
        break;
      }

      case "response.completed": // Used by Responses API (figure out a nice way to do this)
      case "response.done": {
        if (serverEvent.response?.output) {
          serverEvent.response.output.forEach((outputItem) => {
            if (
              outputItem.type === "function_call" &&
              outputItem.name &&
              outputItem.arguments
            ) {
              handleFunctionCall({
                name: outputItem.name,
                call_id: outputItem.call_id,
                arguments: outputItem.arguments,
              });
            }
          });
        }
        break;
      }

      case "response.in_progress": {
        if (isDebugModeEnabled) {
          addTranscriptBreadcrumb("Response in progress", {
            id: serverEvent.response?.id,
            status: serverEvent.response?.status
          });
        }
        break;
      }

      case "response.output_text.delta": {
        const itemId = serverEvent.item_id;
        const deltaText = serverEvent.delta || "";
        if (itemId) {
          updateTranscriptMessage(itemId, deltaText, true);
        }
        break;
      }

      case "response.completed": {
        if (serverEvent.response?.output) {
          serverEvent.response.output.forEach((outputItem) => {
            if (outputItem.type === "message" && outputItem.content) {
              outputItem.content.forEach((content) => {
                if (content.type === "output_text" || content.type === "text") {
                  const itemId = outputItem.id;
                  if (itemId) {
                    updateTranscriptMessage(itemId, content.text, false);
                    updateTranscriptItemStatus(itemId, "DONE");
                  }
                }
              });
            }
          });
        }
        break;
      }

      case "response.output_item.added": {
        const itemId = serverEvent.item?.id;
        const role = serverEvent.item?.role as "user" | "assistant";
        if (itemId && role) {
          addTranscriptMessage(itemId, role, "");
        }
        break;
      }

      case "response.output_text.done": {
        const itemId = serverEvent.item_id;
        const text = serverEvent.text || "";
        if (itemId) {
          updateTranscriptMessage(itemId, text, false);
        }
        break;
      }

      case "response.output_item.done": {
        const itemId = serverEvent.item?.id;
        if (itemId) {
          // Safety net: if any streaming transcript deltas were missed
          // (e.g. an event-name mismatch between legacy and GA), use the
          // final text from the item's content array. GA content parts use
          // `type: "output_audio"` (with `transcript`) or `type: "output_text"`
          // (with `text`); legacy used `audio` / `text`. Both expose the same
          // fields, so reading either works regardless of API generation.
          const content = serverEvent.item?.content;
          if (Array.isArray(content)) {
            const finalText =
              content[0]?.text || content[0]?.transcript || "";
            if (finalText) {
              updateTranscriptMessage(itemId, finalText, false);
            }
          }
          updateTranscriptItemStatus(itemId, "DONE");
        }
        break;
      }

      case "conversation.item.create": {
        const content = serverEvent.item?.content;
        let text = "";
        
        // Handle regular message content
        if (Array.isArray(content)) {
          text = content[0]?.text || "";
        }
        
        const role = serverEvent.item?.role as "user" | "assistant";
        const itemId = serverEvent.item?.id;

        if (itemId && role) {
          addTranscriptMessage(itemId, role, text);
        }
        break;
      }

      case "response.failed": {
        logger.error({
          id: serverEvent.response?.id,
          error: serverEvent.response?.error
        }, 'Response failed');
        if (serverEvent.response?.error) {
          const errorMessage = `Error: ${serverEvent.response.error.message}`;
          addTranscriptMessage(`error-${Date.now()}`, "assistant", errorMessage);
        }
        break;
      }

      case "toast.show": {
        // Handle toast notifications from backend.
        //
        // Mirror the destructive→`phase-failure` dispatch from the inline
        // `toast` callback above so backend-emitted destructive toasts
        // (e.g. the Track D delegation circuit breaker) actually surface
        // a Retry/Reload tile in build & result phases. Without this the
        // user sees a transient toast on a non-interactive surface and
        // gets stuck.
        const { message, type = 'default' } = (serverEvent as { data?: { message?: string; type?: string } }).data || {};
        if (!message) break;
        toast({
          title: message,
          variant: type === 'destructive' ? 'destructive' : 'default',
        });
        if (type === 'destructive') {
          const current = workflowPhaseContext?.currentPhase;
          if (
            current &&
            (current.mode === 'build' || current.mode === 'result')
          ) {
            try {
              window.dispatchEvent(
                new CustomEvent('phase-failure', {
                  detail: {
                    phaseId: current.id,
                    message,
                  },
                }),
              );
            } catch {
              // window may be unavailable in some environments; the toast
              // alone still surfaces the error and we don't want to break
              // event handling over the optional retry affordance.
            }
          }
        }
        break;
      }

      case "ui.observe.request": {
        const data = (serverEvent as any).data as { callId: string };
        const socket = getGlobalSocket();
        if (!socket) break;
        // New simplified return shape per docs/superpowers/specs/
        // 2026-04-15-panel-layout-and-tool-redesign.md §5.3. No viewport
        // coords, no spatial analysis — the AI reasons about layout mode,
        // what's in the document slot + library, notes, scene, and who
        // the user is currently talking to.
        const notesList = (async () => {
          try {
            const { getNotesManager } = await import('@/app/lib/tools/ui/notes/NotesManager');
            const notes = getNotesManager().getVisibleNotes();
            return notes.map((n: any) => ({
              id: n.id,
              title: n.title || n.content?.split('\n')[0]?.slice(0, 60) || '(untitled)',
              color: n.color,
            }));
          } catch {
            return [] as Array<{ id: string; title: string; color: string }>;
          }
        })();
        notesList.then((notes) => {
          const availableScenes = getSceneManager().getAvailableScenes?.() ?? [];
          // Enrich document summaries with the user's current viewing
          // state so the agent knows which version they're looking at
          // (focusedRev) and what the latest is (currentRev). The agent
          // can then call `artifact.get(rev?)` with the right rev to
          // explain the exact content the user sees, even when they're
          // browsing history. Non-document items (diagrams, components)
          // skip these fields — there's no revision system there.
          const summarise = (c: any) => {
            if (!c) return null;
            const base = {
              id: c.id,
              name: c.kind === 'component' ? 'Component' : c.name,
              kind: c.kind,
            };
            if (c.kind !== 'document') return base;
            const artifactKey = c.artifactId ?? c.id;
            const artifact = artifacts.find((a) => a.id === artifactKey);
            const currentRev = artifact?.currentRev ?? 1;
            const focusedRev = viewState[artifactKey]?.focusedRev ?? currentRev;
            return { ...base, currentRev, focusedRev };
          };
          socket.emit('tool.result', {
            callId: data.callId,
            status: 'success',
            data: {
              layout: {
                arrangement: getWorkspaceLayout(),
                sceneVisible: isSceneVisible,
                documentVisible: isDocumentVisible,
                chatVisible: true,
              },
              activeDocument: summarise(activeContent),
              viewedDocument: summarise(viewedContent),
              library: library.map(summarise).filter(Boolean),
              notes: { count: notes.length, items: notes },
              scene: {
                current: currentScene,
                visible: isSceneVisible,
                available: availableScenes,
              },
              currentTab: documentTab,
              conversation: {
                currentAgent:
                  selectedAgentKey && agents[selectedAgentKey]
                    ? { key: selectedAgentKey, name: agents[selectedAgentKey].name }
                    : null,
                // queuedAgentTransfer is in the hook's closure via the outer
                // setQueuedAgentTransfer plumbing — but we don't have a live
                // read here. The AI can still infer "mid-handoff" from
                // queue state via the agent tool; we surface the bit we
                // have (reconnecting) for completeness.
                pendingAgent: null,
                isReconnecting: false,
              },
            },
          });
        });
        break;
      }

      case "ui.slide.create": {
        const data = (serverEvent as any).data;
        // Handle async imports in IIFE to avoid making parent function async
        (async () => {
          const socket = getGlobalSocket();
          if (!socket) {
            logger.error('No socket available for tool.result');
            return;
          }

          try {
            // Generate unique slide ID (shared between both render paths)
            const slideId = `slide-${generateUUID()}`;

            // Both `show` and `showArtifact` slides render in the split-panel
            // DocumentPanel instead of a floating window. Per docs/superpowers
            // (UX rec #6 and figma-screens §4–5): one piece of content at a
            // time, in the right pane.
            showContent({
              kind: 'document',
              id: slideId,
              name: data.artifactName || data.title,
              content: data.content,
              ...(data.artifactId && {
                artifactId: data.artifactId,
                type: data.artifactType || 'text/markdown',
              }),
            });
            setDocumentVisible(true);

            // Send success response back to backend with slideId
            // Use socket.emit directly to avoid wrapping in client:message
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'success',
              data: {
                slideId,
                title: data.title,
                // Include artifact info if this was from showArtifact
                ...(data.artifactId && {
                  artifactId: data.artifactId,
                  artifactName: data.artifactName,
                  artifactType: data.artifactType
                })
              }
            });

            logger.debug({ slideId, title: data.title }, 'Slide created and routed to DocumentPanel');
          } catch (error) {
            logger.error(error, 'Error creating slide');
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'error',
              data: {
                error: error instanceof Error ? error.message : 'Failed to create slide'
              }
            });
          }
        })();
        break;
      }

      case "ui.document.visibility": {
        const data = (serverEvent as any).data as { callId: string; visible: boolean };
        const socket = getGlobalSocket();
        if (!socket) break;
        setDocumentVisible(data.visible);
        socket.emit('tool.result', {
          callId: data.callId,
          status: 'success',
          data: { visible: data.visible },
        });
        break;
      }

      // ---- Document and component UI tool actions ----

      case "ui.slide.list": {
        const data = (serverEvent as any).data as { callId: string };
        const socket = getGlobalSocket();
        if (!socket) break;
        const entries: Array<{ id: string; name: string; kind: string; active: boolean }> = [];
        if (activeContent) {
          entries.push({
            id: activeContent.id,
            name:
              activeContent.kind === 'component' ? 'Component' : (activeContent as any).name,
            kind: activeContent.kind,
            active: true,
          });
        }
        for (const item of library) {
          entries.push({
            id: item.id,
            name: item.kind === 'component' ? 'Component' : (item as any).name,
            kind: item.kind,
            active: false,
          });
        }
        socket.emit('tool.result', {
          callId: data.callId,
          status: 'success',
          data: { count: entries.length, documents: entries },
        });
        break;
      }

      case "ui.slide.close": {
        const data = (serverEvent as any).data as { callId: string; id: string };
        const socket = getGlobalSocket();
        if (!socket) break;
        clearContent(data.id);
        socket.emit('tool.result', {
          callId: data.callId,
          status: 'success',
          data: { id: data.id },
        });
        break;
      }

      // Component tool UI events
      case "ui.component.create": {
        const data = (serverEvent as any).data;
        (async () => {
          const socket = getGlobalSocket();
          if (!socket) {
            logger.error('No socket available for tool.result');
            return;
          }

          try {
            const { getComponentManager, createComponentManager } = await import('@/app/lib/tools/ui/components/ComponentManager');
            
            let manager = getComponentManager();
            
            // Lazy initialization if needed
            if (!manager && typeof window !== 'undefined' && (window as any).Babel) {
              // Get experienceId from event data (preferred) or sessionStorage
              const experienceId = data.experienceId || sessionStorage.getItem('primer:experience-id');
              const sessionId = sessionStorage.getItem('primer:session-id');
              
              if (sessionId && experienceId) {
                manager = createComponentManager(experienceId, sessionId);
                logger.debug({ experienceId, sessionId }, 'ComponentManager lazily initialized');
              } else {
                logger.warn({ experienceId, sessionId }, 'Missing experienceId or sessionId for ComponentManager initialization');
              }
            }
            
            if (!manager) {
              // Check if Babel is loaded
              const babelLoaded = typeof window !== 'undefined' && !!(window as any).Babel;
              socket.emit('tool.result', {
                callId: data.callId,
                status: 'error',
                data: { 
                  error: babelLoaded 
                    ? 'Component manager not initialized. Missing experienceId or sessionId.' 
                    : 'Component manager not initialized. Ensure Babel has loaded.'
                }
              });
              return;
            }
            
            // Create callbacks that emit socket events
            const onEvent = (event: any) => {
              // Re-fetch socket in case it changed
              const currentSocket = getGlobalSocket();
              logger.info({ 
                event, 
                socketConnected: currentSocket?.connected,
                socketId: currentSocket?.id,
                hasSocket: !!currentSocket
              }, 'Component event callback invoked, forwarding via socket');
              
              if (!currentSocket?.connected) {
                logger.error({ hasSocket: !!currentSocket }, 'Socket not connected when trying to emit component event');
                return;
              }
              
              currentSocket.emit('component.event', {
                instanceId: event.instanceId,
                componentId: event.componentId,
                eventType: event.eventType,
                eventData: event.eventData,
                timestamp: event.timestamp
              }, (ack: any) => {
                // Acknowledgment callback (if server responds)
                logger.info({ ack }, 'Component event emit acknowledged');
              });
            };
            
            const onStateChange = (event: any) => {
              logger.debug({ event }, 'Component state changed, forwarding via socket');
              socket.emit('component.stateChange', {
                instanceId: event.instanceId,
                componentId: event.componentId,
                stateChanges: event.stateChanges,
                timestamp: event.timestamp
              });
            };
            
            // Show the component with event callbacks
            logger.info({ componentId: data.componentId, hasOnEvent: !!onEvent, hasOnStateChange: !!onStateChange }, 'Calling showComponent with callbacks');
            const instanceId = await manager.showComponent(
              data.componentId,
              data.initialState || {},
              onEvent,
              onStateChange
            );

            // Surface the component in the split-panel right pane. The
            // DocumentPanel looks the instance up by id from ComponentManager.
            showContent({
              kind: 'component',
              id: instanceId,
              componentId: data.componentId,
            });
            setDocumentVisible(true);

            socket.emit('tool.result', {
              callId: data.callId,
              status: 'success',
              data: {
                instanceId,
                componentId: data.componentId,
                message: `Component ${data.componentId} created successfully`
              }
            });

            logger.debug({ instanceId, componentId: data.componentId }, 'Component created and routed to DocumentPanel');
          } catch (error) {
            logger.error(error, 'Error creating component');
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'error',
              data: {
                error: error instanceof Error ? error.message : 'Failed to create component'
              }
            });
          }
        })();
        break;
      }

      case "ui.component.updateState": {
        const data = (serverEvent as any).data;
        (async () => {
          const socket = getGlobalSocket();
          if (!socket) {
            logger.error('No socket available for tool.result');
            return;
          }

          try {
            const { getComponentManager } = await import('@/app/lib/tools/ui/components/ComponentManager');
            const manager = getComponentManager();
            
            if (!manager) {
              socket.emit('tool.result', {
                callId: data.callId,
                status: 'error',
                data: { error: 'Component manager not initialized' }
              });
              return;
            }
            
            manager.updateComponentState(data.instanceId, data.stateUpdates);
            const newState = manager.getComponentState(data.instanceId);
            
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'success',
              data: {
                instanceId: data.instanceId,
                state: newState,
                message: 'Component state updated successfully'
              }
            });
            
            logger.debug({ instanceId: data.instanceId }, 'Component state updated');
          } catch (error) {
            logger.error(error, 'Error updating component state');
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'error',
              data: {
                error: error instanceof Error ? error.message : 'Failed to update component state'
              }
            });
          }
        })();
        break;
      }

      case "ui.component.getState": {
        const data = (serverEvent as any).data;
        (async () => {
          const socket = getGlobalSocket();
          if (!socket) {
            logger.error('No socket available for tool.result');
            return;
          }

          try {
            const { getComponentManager } = await import('@/app/lib/tools/ui/components/ComponentManager');
            const manager = getComponentManager();
            
            if (!manager) {
              socket.emit('tool.result', {
                callId: data.callId,
                status: 'error',
                data: { error: 'Component manager not initialized' }
              });
              return;
            }
            
            const state = manager.getComponentState(data.instanceId);
            
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'success',
              data: {
                instanceId: data.instanceId,
                state,
                message: 'Component state retrieved successfully'
              }
            });
            
            logger.debug({ instanceId: data.instanceId }, 'Component state retrieved');
          } catch (error) {
            logger.error(error, 'Error getting component state');
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'error',
              data: {
                error: error instanceof Error ? error.message : 'Failed to get component state'
              }
            });
          }
        })();
        break;
      }

      case "ui.component.clearCache": {
        const data = (serverEvent as any).data;
        (async () => {
          const socket = getGlobalSocket();
          if (!socket) {
            logger.error('No socket available for tool.result');
            return;
          }

          try {
            const { getComponentManager } = await import('@/app/lib/tools/ui/components/ComponentManager');
            const manager = getComponentManager();
            
            if (!manager) {
              socket.emit('tool.result', {
                callId: data.callId,
                status: 'error',
                data: { error: 'Component manager not initialized' }
              });
              return;
            }
            
            manager.clearComponentCache(data.componentId);
            
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'success',
              data: {
                componentId: data.componentId,
                message: `Cache cleared for component: ${data.componentId}. Next create will reload from disk.`
              }
            });
            
            logger.debug({ componentId: data.componentId }, 'Component cache cleared');
          } catch (error) {
            logger.error(error, 'Error clearing component cache');
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'error',
              data: {
                error: error instanceof Error ? error.message : 'Failed to clear component cache'
              }
            });
          }
        })();
        break;
      }

      // Component runtime events are handled directly by RealtimeController
      // for proper injection into the OpenAI Realtime conversation.
      // These cases are kept as no-ops for completeness but shouldn't be reached.
      case "component.event.forward":
      case "component.stateChange.forward":
        // Handled by RealtimeController's direct socket listener
        break;

      // Note tool UI events
      case "ui.note.sync": {
        const data = (serverEvent as any).data;
        (async () => {
          const socket = getGlobalSocket();
          if (!socket) {
            logger.error('No socket available for tool.result');
            return;
          }

          try {
            const { getNotesManager } = await import('@/app/lib/tools/ui/notes/NotesManager');
            const manager = getNotesManager();
            manager.syncFromStorage(data.notes || []);
            
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'success',
              data: { synced: true }
            });
            
            logger.debug({ noteCount: data.notes?.length || 0 }, 'Notes synced from server');
          } catch (error) {
            logger.error(error, 'Error syncing notes');
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'error',
              data: { error: error instanceof Error ? error.message : 'Failed to sync notes' }
            });
          }
        })();
        break;
      }

      case "ui.note.display": {
        const data = (serverEvent as any).data;
        (async () => {
          const socket = getGlobalSocket();
          if (!socket) {
            logger.error('No socket available for tool.result');
            return;
          }

          try {
            const { getNotesManager } = await import('@/app/lib/tools/ui/notes/NotesManager');
            const manager = getNotesManager();
            manager.displayNote(data.note);
            
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'success',
              data: { noteId: data.note.id }
            });
            
            logger.debug({ noteId: data.note.id }, 'Note displayed');
          } catch (error) {
            logger.error(error, 'Error displaying note');
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'error',
              data: { error: error instanceof Error ? error.message : 'Failed to display note' }
            });
          }
        })();
        break;
      }

      case "ui.note.hide": {
        const data = (serverEvent as any).data;
        (async () => {
          const socket = getGlobalSocket();
          if (!socket) {
            logger.error('No socket available for tool.result');
            return;
          }

          try {
            const { getNotesManager } = await import('@/app/lib/tools/ui/notes/NotesManager');
            const manager = getNotesManager();
            manager.hideNote(data.noteId);
            
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'success',
              data: { hidden: true }
            });
            
            logger.debug({ noteId: data.noteId }, 'Note hidden');
          } catch (error) {
            logger.error(error, 'Error hiding note');
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'error',
              data: { error: error instanceof Error ? error.message : 'Failed to hide note' }
            });
          }
        })();
        break;
      }

      case "ui.note.delete": {
        const data = (serverEvent as any).data;
        (async () => {
          const socket = getGlobalSocket();
          if (!socket) {
            logger.error('No socket available for tool.result');
            return;
          }

          try {
            const { getNotesManager } = await import('@/app/lib/tools/ui/notes/NotesManager');
            const manager = getNotesManager();
            manager.deleteNote(data.noteId);
            
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'success',
              data: { deleted: true }
            });
            
            logger.debug({ noteId: data.noteId }, 'Note deleted');
          } catch (error) {
            logger.error(error, 'Error deleting note');
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'error',
              data: { error: error instanceof Error ? error.message : 'Failed to delete note' }
            });
          }
        })();
        break;
      }

      case "ui.note.update": {
        const data = (serverEvent as any).data;
        (async () => {
          const socket = getGlobalSocket();
          if (!socket) {
            logger.error('No socket available for tool.result');
            return;
          }

          try {
            const { getNotesManager } = await import('@/app/lib/tools/ui/notes/NotesManager');
            const manager = getNotesManager();
            manager.updateNote(data.noteId, data.updates);
            
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'success',
              data: { updated: true }
            });
            
            logger.debug({ noteId: data.noteId, updates: Object.keys(data.updates) }, 'Note updated');
          } catch (error) {
            logger.error(error, 'Error updating note');
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'error',
              data: { error: error instanceof Error ? error.message : 'Failed to update note' }
            });
          }
        })();
        break;
      }

      case "ui.note.getScreenDimensions": {
        const data = (serverEvent as any).data;
        (async () => {
          const socket = getGlobalSocket();
          if (!socket) {
            logger.error('No socket available for tool.result');
            return;
          }

          try {
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'success',
              data: {
                width: window.innerWidth,
                height: window.innerHeight,
                safeArea: { top: 0, right: 0, bottom: 0, left: 0 }
              }
            });
            
            logger.debug({ width: window.innerWidth, height: window.innerHeight }, 'Screen dimensions sent');
          } catch (error) {
            logger.error(error, 'Error getting screen dimensions');
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'error',
              data: { error: error instanceof Error ? error.message : 'Failed to get screen dimensions' }
            });
          }
        })();
        break;
      }

      case "tool.response": {
        const data = (serverEvent as any).data;
        handleToolResponse(data);
        break;
      }

      default:
        break;
    }
  };

  const handleServerEventRef = useRef(handleServerEvent);
  handleServerEventRef.current = handleServerEvent;

  return handleServerEventRef;
}
