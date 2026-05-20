import { NextRequest, NextResponse } from 'next/server';
import { createModuleLogger } from '@/lib/logger';
import { deleteArtifact, readArtifactHead } from '@/app/lib/artifacts/storage';

const logger = createModuleLogger('artifacts');

type Context = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(req: NextRequest, context: Context) {
  let id: string | undefined;

  try {
    const experienceId = req.headers.get('x-experience-id');
    const sessionId = req.headers.get('x-session-id');

    if (!experienceId) {
      return NextResponse.json({ error: 'Experience ID is required' }, { status: 400 });
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const params = await context.params;
    id = params.id;
    if (!id) {
      return NextResponse.json({ error: 'Artifact ID is required' }, { status: 400 });
    }

    const artifact = await readArtifactHead({ experienceId, sessionId, artifactId: id });
    if (!artifact) {
      logger.error({ artifactId: id }, 'Artifact metadata not found');
      return NextResponse.json({ error: `Artifact ${id} not found` }, { status: 404 });
    }

    return NextResponse.json(artifact);
  } catch (error) {
    logger.error({ err: error, artifactId: id || 'unknown' }, 'Error reading artifact');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to read artifact' },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, context: Context) {
  let id: string | undefined;

  try {
    const experienceId = req.headers.get('x-experience-id');
    const sessionId = req.headers.get('x-session-id');

    if (!experienceId) {
      return NextResponse.json({ error: 'Experience ID is required' }, { status: 400 });
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const params = await context.params;
    id = params.id;
    if (!id) {
      return NextResponse.json({ error: 'Artifact ID is required' }, { status: 400 });
    }

    await deleteArtifact({ experienceId, sessionId, artifactId: id });

    return NextResponse.json({ success: true, message: `Artifact ${id} deleted successfully` });
  } catch (error) {
    logger.error({ err: error, artifactId: id || 'unknown' }, 'Error deleting artifact');
    const message = error instanceof Error ? error.message : 'Failed to delete artifact';
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
