import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { getCachedSession } from '@/lib/getCachedSession';
import { Permission } from '@/config/auth';
import { hasMergedPermission } from '@/config/user-storage';
import { getEffectiveUserEmail } from '@/lib/devAuth';
import { canAccessExperience } from '@/app/lib/classAuth';
import { checkDependencies } from '@/app/lib/modules/ModuleService';
import { getExperienceBootstrap } from '@/app/lib/experiences/getExperienceBootstrap';
import { validateExperienceForStart } from '@/app/lib/experiences/validateExperienceForStart';
import { getInitialSessionState } from '@/app/lib/sessions/getInitialSessionState';
import { createFreshSessionRow } from '@/app/lib/sessions/createFreshSessionRow';
import { EXPERIENCE_ID_RE } from '@/app/server-actions/_validation';
import { BuildingPanel } from '@/app/components/ExperienceBuildSequence';
import { createModuleLogger } from '@/lib/logger';

import PlayClient, { type PlayClientSessionPayload } from './PlayClient';
import PlayShell from './PlayShell';
import ValidationErrorScreen from './ValidationErrorScreen';

const logger = createModuleLogger('play-page');

interface PlayPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function getPreparingCopy(kind?: string): string {
  return kind === 'meta'
    ? 'Your experience creator is being prepared.'
    : 'Your experience is being prepared.';
}

function PlayErrorScreen({ message, kind }: { message: string; kind?: string }) {
  return (
    <PlayShell title={getPreparingCopy(kind)}>
      <div className="flex h-full flex-col items-center justify-center gap-8 px-4">
        <BuildingPanel mode={{ kind: 'error', message }} />
      </div>
    </PlayShell>
  );
}

/**
 * Server-rendered entry point for `/play/[id]`. Replaces the legacy
 * `'use client'` `AppWrapper` that ran a 5-step `useEffect` waterfall against
 * `/api/classes/check-access`, `/api/modules/check-dependencies`,
 * `/api/sessions/user`, and two `/api/storage/.../experience.json` reads
 * before the user saw anything.
 *
 * Now: auth + access + dependency check + `experience.json` bootstrap all
 * run in parallel on the server, errors render server-side via
 * {@link PlayErrorScreen}, and `PlayClient` receives the session lookup +
 * fresh-session-row creation as a single streamed `Promise` so its loading
 * checklist can light up the moment the bootstrap reaches it — no
 * artificial floor, no JS-driven dwell.
 */
export default async function PlayPage({ params, searchParams }: PlayPageProps) {
  const { id: experienceId } = await params;
  const search = await searchParams;
  const bypassValidation = search.bypassValidation === '1';

  // Front-line allowlist before `experienceId` reaches any `path.join`.
  if (!EXPERIENCE_ID_RE.test(experienceId)) {
    return (
      <PlayErrorScreen message="This Experience no longer exists. It may have been removed by its author." />
    );
  }

  const session = await getCachedSession();
  const userEmail = getEffectiveUserEmail(session?.user?.email);

  // Defense in depth: middleware already redirects unauthenticated users.
  if (!userEmail) {
    redirect(
      `/auth/signin?returnUrl=${encodeURIComponent(`/play/${experienceId}`)}`,
    );
  }

  const hasPlayPermission = hasMergedPermission(
    userEmail,
    Permission.PLAY_EXPERIENCE,
  );
  const canViewTechnical = hasMergedPermission(
    userEmail,
    Permission.VIEW_TECHNICAL,
  );

  const [accessResult, depsResult, bootstrapResult] = await Promise.allSettled([
    canAccessExperience(experienceId, userEmail, hasPlayPermission),
    checkDependencies(experienceId),
    getExperienceBootstrap(experienceId),
  ]);

  if (accessResult.status === 'rejected') {
    logger.error(
      { err: accessResult.reason, experienceId },
      'canAccessExperience failed',
    );
    return (
      <PlayErrorScreen message="We couldn't verify your access to this Experience. Please try again." />
    );
  }

  if (bootstrapResult.status === 'rejected') {
    logger.error(
      { err: bootstrapResult.reason, experienceId },
      'getExperienceBootstrap failed',
    );
    return (
      <PlayErrorScreen message="The Experience could not be loaded. Please try again." />
    );
  }

  const bootstrap = bootstrapResult.value;
  if (!bootstrap.ok) {
    switch (bootstrap.reason) {
      case 'not-found':
        return (
          <PlayErrorScreen message="This Experience no longer exists. It may have been removed by its author." />
        );
      case 'invalid':
        return (
          <PlayErrorScreen message="This Experience's configuration is invalid and cannot be loaded. Contact the author to repair the experience.json file." />
        );
      default: {
        const _exhaustive: never = bootstrap.reason;
        void _exhaustive;
        return (
          <PlayErrorScreen message="The Experience could not be loaded." />
        );
      }
    }
  }

  // Soft-fail dependency lookup: a missing modules manifest shouldn't lock
  // the user out of the experience.
  let missing: string[] = [];
  if (depsResult.status === 'fulfilled') {
    missing = depsResult.value;
  } else {
    logger.warn(
      { err: depsResult.reason, experienceId },
      'checkDependencies failed; treating as no missing modules',
    );
  }

  const access = accessResult.value;

  const experienceKind = bootstrap.bootstrap.kind;

  if (!access.canAccess) {
    return (
      <PlayErrorScreen
        message="You do not have access to this experience. Please contact your instructor if you believe this is an error."
        kind={experienceKind}
      />
    );
  }

  if (missing.length > 0) {
    return (
      <PlayErrorScreen
        message={`Missing required modules: ${missing.join(', ')}. Install them from the Module catalog on the home page.`}
        kind={experienceKind}
      />
    );
  }

  // Pre-flight gate: structural + filesystem + env-key validation. Skipped
  // when the user has clicked "Continue anyway" on a previous render.
  if (!bypassValidation) {
    try {
      const validation = await validateExperienceForStart(
        experienceId,
        bootstrap.bootstrap.configText,
      );
      if (!validation.isValid) {
        return (
          <ValidationErrorScreen
            experienceId={experienceId}
            issues={validation.issues}
          />
        );
      }
    } catch (err) {
      logger.error(
        { err, experienceId },
        'validateExperienceForStart failed; allowing play to proceed',
      );
    }
  }

  // `headers()` and `getCachedSession()` are RSC-only APIs. Capture the
  // values that `createFreshSessionRow` needs synchronously so the streamed
  // `sessionPromise` below — which keeps running while the response streams
  // to the client — doesn't try to invoke them after the RSC scope is gone.
  const requestHeaders = await headers();
  const userName = session?.user?.name || undefined;

  // Stream the session lookup + fresh-row creation unawaited. PlayClient
  // unwraps it inside a Suspense boundary via `use()`; while that's
  // pending, the BuildingPanel "all pending" fallback paints. This drops
  // the legacy 1.5 s `loadingFloor` — the checklist now reflects real work
  // (`getInitialSessionState` + `createFreshSessionRow` + ConfigLoader
  // phases) instead of a wall-clock dwell.
  //
  // Side-effects (createFreshSessionRow writes a row + audit entry) are
  // still gated behind the access/dependency checks above, so denied users
  // never leave phantom session rows. Errors propagate via the promise:
  // `use()` re-throws and `error.tsx` catches.
  const sessionPromise: Promise<PlayClientSessionPayload> = (async () => {
    const { previousSession } = await getInitialSessionState({
      experienceId,
      userEmail,
    });

    if (previousSession) {
      // Returning user → recovery dialog drives the choice client-side via
      // `chooseSessionAction`. Don't pre-create here.
      return { previousSession, preCreatedSessionId: null };
    }

    const preCreatedSessionId = await createFreshSessionRow({
      experienceId,
      userEmail,
      userName,
      requestHeaders,
    });
    return { previousSession: null, preCreatedSessionId };
  })();

  return (
    <PlayClient
      experienceId={experienceId}
      title={bootstrap.bootstrap.title}
      kind={bootstrap.bootstrap.kind}
      hasComponents={bootstrap.bootstrap.hasComponents}
      hasReadme={bootstrap.bootstrap.hasReadme}
      canViewTechnical={canViewTechnical}
      bootstrapConfigText={bootstrap.bootstrap.configText}
      sessionPromise={sessionPromise}
    />
  );
}
