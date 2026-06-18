import { NextRequest, NextResponse } from 'next/server';
import { createModuleLogger } from '@/lib/logger';
import { listArtifactRevisions, updateArtifact } from '@/app/lib/artifacts/storage';
import { parseArtifactAuthorFromRequest } from '@/app/lib/artifacts/parseAuthor';

const logger = createModuleLogger('artifacts-update');

type Context = {
  params: Promise<{
    id: string;
  }>;
};

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

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'Artifact ID is required' }, { status: 400 });
    }

    const body = await req.json();
    const { content, metadata, userName, userEmail } = body;

    if (content === undefined) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const author = parseArtifactAuthorFromRequest(req, { userEmail, userName });

    const result = await updateArtifact({
      experienceId,
      sessionId,
      artifactId: id,
      content,
      metadata,
      author,
    });

    if (result.noop) {
      return NextResponse.json({
        ...result.artifact,
        content: result.content,
        noop: true,
      });
    }

    // Inline revisions so the client merges artifact + rev list in one shot
    // (used by ArtifactContext.mergeArtifactUpdate to keep the LibraryView
    // tile rev rows fresh without an extra request).
    // listArtifactRevisions returns { revisions, currentRev } | null; unwrap
    // before responding — VersionSwitcher.tsx calls .find on this list and
    // crashes if it gets the wrapper object back.
    const listed = await listArtifactRevisions({
      experienceId,
      sessionId,
      artifactId: id,
    });

    return NextResponse.json({
      ...result.artifact,
      content: result.content,
      revisions: listed?.revisions ?? [],
    });
  } catch (error) {
    logger.error(error, 'Error updating artifact');
    const message = error instanceof Error ? error.message : 'Failed to update artifact';
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
