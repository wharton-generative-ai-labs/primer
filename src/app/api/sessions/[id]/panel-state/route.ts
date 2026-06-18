import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

import { getCachedSession } from '@/lib/getCachedSession';
import { getEffectiveUserEmail } from '@/lib/devAuth';
import type { PanelStateRecord } from '@/app/lib/panel-state';
import type { SessionMetadata } from '@/app/lib/file-utils';
import {
  getSessionMetadataFilePath,
  getSessionPanelStateFilePath,
} from '@/app/lib/file-utils';
import { EXPERIENCE_ID_RE, SESSION_ID_RE } from '@/app/server-actions/_validation';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('panel-state-api');

async function assertSessionOwnership(
  experienceId: string,
  sessionId: string,
  userEmail: string,
): Promise<boolean> {
  const metadataPath = await getSessionMetadataFilePath(experienceId, sessionId);
  let metadata: SessionMetadata;
  try {
    const contents = await fs.readFile(metadataPath, 'utf8');
    metadata = JSON.parse(contents) as SessionMetadata;
  } catch {
    return false;
  }
  if (metadata.userEmail?.toLowerCase() !== userEmail.toLowerCase()) {
    return false;
  }
  return true;
}

async function atomicWriteJson(targetPath: string, payload: unknown): Promise<void> {
  const dir = path.dirname(targetPath);
  const tempPath = path.join(dir, `.${path.basename(targetPath)}.${randomUUID()}.tmp`);
  await fs.writeFile(tempPath, JSON.stringify(payload, null, 2));
  try {
    await fs.rename(tempPath, targetPath);
  } catch (err) {
    await fs.unlink(tempPath).catch(() => {});
    throw err;
  }
}

function loosePanelRecord(v: unknown): v is PanelStateRecord {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  if (!('activeContent' in o) || !('library' in o)) return false;
  if (typeof o.updatedAt !== 'string') return false;
  if (o.activeContent !== null && typeof o.activeContent !== 'object') {
    return false;
  }
  if (!Array.isArray(o.library)) return false;
  if (!('viewedContentId' in o) || !('activeChecklistId' in o)) return false;
  if (typeof o.viewedContentId !== 'string' && o.viewedContentId !== null) return false;
  if (typeof o.activeChecklistId !== 'string' && o.activeChecklistId !== null) return false;
  return true;
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: sessionId } = await ctx.params;
  const experienceId = _req.headers.get('x-experience-id');

  try {
    if (!experienceId || !EXPERIENCE_ID_RE.test(experienceId)) {
      return NextResponse.json({ error: 'Experience ID is required' }, { status: 400 });
    }
    if (!SESSION_ID_RE.test(sessionId)) {
      return NextResponse.json({ error: 'Invalid session id' }, { status: 400 });
    }

    const session = await getCachedSession();
    const userEmail = getEffectiveUserEmail(session?.user?.email);
    if (!userEmail) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const owns = await assertSessionOwnership(experienceId, sessionId, userEmail);
    if (!owns) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const panelPath = await getSessionPanelStateFilePath(experienceId, sessionId);
    try {
      const raw = await fs.readFile(panelPath, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      if (!loosePanelRecord(parsed)) {
        logger.warn({ panelPath }, 'panel-state.json shape invalid');
        return NextResponse.json(null, { status: 404 });
      }
      return NextResponse.json(parsed);
    } catch (err: unknown) {
      const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined;
      if (code === 'ENOENT') {
        return NextResponse.json(null, { status: 404 });
      }
      throw err;
    }
  } catch (error) {
    logger.error({ err: error, sessionId }, 'GET panel-state failed');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to read panel state' },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: sessionId } = await ctx.params;
  const experienceId = req.headers.get('x-experience-id');

  try {
    if (!experienceId || !EXPERIENCE_ID_RE.test(experienceId)) {
      return NextResponse.json({ error: 'Experience ID is required' }, { status: 400 });
    }
    if (!SESSION_ID_RE.test(sessionId)) {
      return NextResponse.json({ error: 'Invalid session id' }, { status: 400 });
    }

    const session = await getCachedSession();
    const userEmail = getEffectiveUserEmail(session?.user?.email);
    if (!userEmail) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const owns = await assertSessionOwnership(experienceId, sessionId, userEmail);
    if (!owns) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await req.json()) as unknown;
    if (!loosePanelRecord(body)) {
      return NextResponse.json({ error: 'Invalid panel state payload' }, { status: 400 });
    }

    const panelPath = await getSessionPanelStateFilePath(experienceId, sessionId);
    await fs.mkdir(path.dirname(panelPath), { recursive: true });
    await atomicWriteJson(panelPath, body);

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error({ err: error, sessionId }, 'PUT panel-state failed');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to write panel state' },
      { status: 500 },
    );
  }
}
