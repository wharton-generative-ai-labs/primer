import { NextRequest, NextResponse } from 'next/server';
import { getExperienceArtifactsFolder } from '@/app/lib/file-utils';
import { listArtifactRevisions, normalizeArtifactRecord } from '@/app/lib/artifacts/storage';
import { isBinaryFileType } from '@/app/lib/artifact-utils';
import { createModuleLogger } from '@/lib/logger';
import fs from 'fs/promises';
import path from 'path';

const logger = createModuleLogger('artifacts-list');

export async function GET(req: NextRequest) {
  const experienceId = req.headers.get('x-experience-id');
  const sessionId = req.headers.get('x-session-id');
  const expand = req.nextUrl.searchParams.get('expand');
  const includeRevisions = expand === 'revisions';

  try {
    if (!experienceId) {
      return NextResponse.json({ error: 'Experience ID is required' }, { status: 400 });
    }
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const artifactsFolder = await getExperienceArtifactsFolder(experienceId, sessionId);

    try {
      await fs.mkdir(artifactsFolder, { recursive: true });
    } catch (error) {
      logger.error({ err: error, artifactsFolder }, 'Error creating artifacts folder');
    }

    let files = await fs.readdir(artifactsFolder);
    files = files.filter(file => file.endsWith('.json'));

    const artifacts = await Promise.all(
      files.map(async (file) => {
        try {
          const filePath = path.join(artifactsFolder, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const record = normalizeArtifactRecord(JSON.parse(content));

          // Inline the content body for small text artifacts (markdown,
          // json, checklist, …) so single-pass consumers like the
          // ResultPhaseSurface tile and other tag-based readers don't have
          // to chase a per-id `/api/artifacts/<id>` fetch just to read a
          // few bytes of text. Binary types (png, pdf, …) stay
          // metadata-only — base64 in the list response would balloon
          // payload size and there's no caller that reads binary content
          // straight off the list.
          let inlinedContent: string | undefined;
          if (!isBinaryFileType(record.type || 'markdown')) {
            try {
              inlinedContent = await fs.readFile(
                path.join(artifactsFolder, record.filename),
                'utf-8',
              );
            } catch (contentErr) {
              // Tolerate per-artifact content read errors so a single
              // truncated/missing content file doesn't poison the whole
              // list response. Metadata still flows through.
              logger.error(
                { err: contentErr, file, filename: record.filename, artifactsFolder },
                'Error inlining artifact content; returning metadata only',
              );
            }
          }

          const recordWithContent = inlinedContent !== undefined
            ? { ...record, content: inlinedContent }
            : record;

          if (!includeRevisions) return recordWithContent;
          // ?expand=revisions: inline the revision metadata so the client
          // doesn't have to do N follow-up fetches to populate the library
          // and version switcher. Cheap (small JSON sidecars) and avoids the
          // chatty per-doc round-trip pattern.
          //
          // listArtifactRevisions returns { revisions, currentRev } | null;
          // unwrap so the wire shape is the array the frontend expects (the
          // ArtifactContext bootstrap path validates with Array.isArray and
          // would silently drop a wrapped object).
          const listed = await listArtifactRevisions({
            experienceId: experienceId!,
            sessionId: sessionId!,
            artifactId: record.id,
          });
          return { ...recordWithContent, revisions: listed?.revisions ?? [] };
        } catch (error) {
          logger.error({ err: error, file, artifactsFolder }, 'Error reading artifact metadata');
          return null;
        }
      })
    );

    const validArtifacts = artifacts.filter(artifact => artifact !== null);

    return NextResponse.json(validArtifacts);
  } catch (error) {
    logger.error({ 
      err: error, 
      experienceId: experienceId || 'unknown', 
      sessionId: sessionId || 'unknown' 
    }, 'Error listing artifacts');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list artifacts' },
      { status: 500 }
    );
  }
} 