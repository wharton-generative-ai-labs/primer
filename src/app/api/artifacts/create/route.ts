import { NextRequest, NextResponse } from 'next/server';
import { getSessionMetadataFilePath, SessionMetadata } from '@/app/lib/file-utils';
import fs from 'fs/promises';
import path from 'path';
import { createModuleLogger } from '@/lib/logger';
import { createArtifact, listArtifactRevisions } from '@/app/lib/artifacts/storage';
import { parseArtifactAuthorFromRequest } from '@/app/lib/artifacts/parseAuthor';
import {
  atomicWriteJson,
  mutateSessionMetadata,
  SessionMetadataNotFoundError,
} from '@/app/lib/sessions/mutateSessionMetadata';

const logger = createModuleLogger('artifacts-create');

export async function POST(req: NextRequest) {
  try {
    const experienceId = req.headers.get('x-experience-id');
    const sessionId = req.headers.get('x-session-id');

    if (!experienceId) {
      return NextResponse.json({ error: 'Experience ID is required' }, { status: 400 });
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const body = await req.json();
    const { name, content, type = 'markdown', agents, metadata, userName, userEmail } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (content === undefined) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Touch lastActivity through the per-session lock + atomic-rename helper.
    // A plain `fs.writeFile` here truncates the file first, so an interleaving
    // reader (e.g. the workflow-phase transition route) can land on an empty
    // file and 500 on `JSON.parse('')`. mutateSessionMetadata serializes
    // writes per session and renames over the target only when the new
    // contents are fully staged.
    const now = new Date().toISOString();
    try {
      await mutateSessionMetadata(experienceId, sessionId, async (metadata) => {
        metadata.lastActivity = now;
        return metadata;
      });
    } catch (error) {
      // Missing or truncated/empty session.json — recreate it. A SyntaxError
      // from `JSON.parse` on a zero-byte file falls into the same bucket as
      // ENOENT here: the side-effect (touching lastActivity) shouldn't
      // 500 artifact creation when the metadata is unrecoverable.
      const isMissing = error instanceof SessionMetadataNotFoundError;
      const isEmpty = error instanceof SyntaxError;
      if (!isMissing && !isEmpty) {
        throw error;
      }
      const sessionMetadataPath = await getSessionMetadataFilePath(experienceId, sessionId);
      const sessionMetadata: SessionMetadata = {
        sessionId,
        experienceId,
        startTime: now,
        lastActivity: now,
        userName: userName || undefined,
        userEmail: userEmail || undefined,
        events: [],
      };
      await fs.mkdir(path.dirname(sessionMetadataPath), { recursive: true });
      await atomicWriteJson(sessionMetadataPath, sessionMetadata);
    }

    const author = parseArtifactAuthorFromRequest(req, { userEmail, userName });

    const { artifact } = await createArtifact({
      experienceId,
      sessionId,
      name,
      content,
      type,
      agents,
      metadata,
      author,
    });

    // Inline the revisions sidecar so the client doesn't need a follow-up
    // fetch to render the LibraryView's per-doc rev rows.
    // listArtifactRevisions returns { revisions, currentRev } | null; unwrap
    // before responding so the client gets an array to .find / .map over
    // (otherwise VersionSwitcher crashes with "revisions.find is not a
    // function" the moment this response is merged into context state).
    const listed = await listArtifactRevisions({
      experienceId,
      sessionId,
      artifactId: artifact.id,
    });

    return NextResponse.json({ ...artifact, revisions: listed?.revisions ?? [] });
  } catch (error) {
    logger.error(error, 'Error creating artifact');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create artifact' },
      { status: 500 },
    );
  }
}
