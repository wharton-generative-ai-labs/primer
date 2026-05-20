import { NextRequest, NextResponse } from 'next/server';
import { createModuleLogger } from '@/lib/logger';
import { getRevisionEntry } from '@/app/lib/artifacts/storage';

const logger = createModuleLogger('artifacts-revision-single');

type Context = {
  params: Promise<{ id: string; rev: string }>;
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

    const { id: artifactId, rev: revStr } = await context.params;
    const rev = Number.parseInt(revStr, 10);
    if (!artifactId || Number.isNaN(rev)) {
      return NextResponse.json({ error: 'Artifact ID and valid revision number required' }, { status: 400 });
    }

    const entry = await getRevisionEntry({ experienceId, sessionId, artifactId, rev });
    if (!entry) {
      return NextResponse.json({ error: 'Revision not found' }, { status: 404 });
    }

    return NextResponse.json({
      revision: entry.revisionMeta,
      content: entry.content,
    });
  } catch (error) {
    logger.error(error, 'get revision');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to read revision' },
      { status: 500 },
    );
  }
}
