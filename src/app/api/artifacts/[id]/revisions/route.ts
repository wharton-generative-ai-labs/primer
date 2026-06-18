import { NextRequest, NextResponse } from 'next/server';
import { createModuleLogger } from '@/lib/logger';
import { listArtifactRevisions, restoreArtifactRevision } from '@/app/lib/artifacts/storage';
import { parseArtifactAuthorFromRequest } from '@/app/lib/artifacts/parseAuthor';

const logger = createModuleLogger('artifacts-revisions');

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(req: NextRequest, context: Context) {
  try {
    const experienceId = req.headers.get('x-experience-id');
    const sessionId = req.headers.get('x-session-id');
    if (!experienceId) {
      return NextResponse.json({ error: 'Experience ID is required' }, { status: 400 });
    }
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const { id: artifactId } = await context.params;
    if (!artifactId) {
      return NextResponse.json({ error: 'Artifact ID is required' }, { status: 400 });
    }

    const result = await listArtifactRevisions({ experienceId, sessionId, artifactId });
    if (!result) {
      return NextResponse.json({ error: `Artifact ${artifactId} not found` }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    logger.error(error, 'list revisions');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list revisions' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest, context: Context) {
  try {
    const experienceId = req.headers.get('x-experience-id');
    const sessionId = req.headers.get('x-session-id');
    if (!experienceId) {
      return NextResponse.json({ error: 'Experience ID is required' }, { status: 400 });
    }
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const { id: artifactId } = await context.params;
    if (!artifactId) {
      return NextResponse.json({ error: 'Artifact ID is required' }, { status: 400 });
    }

    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }
    const action = body.action as string | undefined;
    const rev = body.rev as number | undefined;

    if (action !== 'restore' || rev === undefined || typeof rev !== 'number') {
      return NextResponse.json({ error: 'Expected { action: "restore", rev: number }' }, { status: 400 });
    }

    const authorInput = parseArtifactAuthorFromRequest(req, {
      userEmail: body.userEmail as string | undefined,
      userName: body.userName as string | undefined,
    });

    const { artifact, content } = await restoreArtifactRevision({
      experienceId,
      sessionId,
      artifactId,
      rev,
      author: authorInput,
    });

    // Restore appends a fresh rev so the revisions list grew by one entry.
    // Inline it so the client merges the artifact + new rev list atomically.
    // listArtifactRevisions returns { revisions, currentRev } | null; unwrap
    // to the array shape the frontend expects (the alternative crashes
    // VersionSwitcher with "revisions.find is not a function").
    const listed = await listArtifactRevisions({
      experienceId,
      sessionId,
      artifactId,
    });

    return NextResponse.json({
      artifact,
      content,
      revisions: listed?.revisions ?? [],
    });
  } catch (error) {
    logger.error(error, 'restore revision');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to restore revision' },
      { status: 500 },
    );
  }
}
