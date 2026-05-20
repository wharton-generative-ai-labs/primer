import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import type { ArtifactRevisionMeta, Author } from './types';

export function getRevisionDir(artifactsFolder: string, contentFilename: string): string {
  const parsed = path.parse(contentFilename);
  return path.join(artifactsFolder, `${parsed.name}.revisions`);
}

export function hashContent(data: Buffer | string): string {
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function revisionMetaPath(revDir: string, rev: number): string {
  return path.join(revDir, `rev-${rev}.json`);
}

function revisionContentPath(revDir: string, rev: number, isBinary: boolean): string {
  const ext = isBinary ? 'bin' : 'md';
  return path.join(revDir, `rev-${rev}.${ext}`);
}

export async function revisionDirExists(
  artifactsFolder: string,
  contentFilename: string,
): Promise<boolean> {
  const revDir = getRevisionDir(artifactsFolder, contentFilename);
  try {
    const stat = await fs.stat(revDir);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const tmp = path.join(dir, `.${base}.${process.pid}.${Date.now()}.tmp`);
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8');
  await fs.rename(tmp, filePath);
}

async function writeFileAtomic(targetPath: string, data: Buffer | string): Promise<void> {
  const dir = path.dirname(targetPath);
  const base = path.basename(targetPath);
  const tmp = path.join(dir, `.${base}.${process.pid}.${Date.now()}.tmp`);
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, targetPath);
}

export async function writeRevisionSnapshot(params: {
  revDir: string;
  rev: number;
  artifactId: string;
  contentBuffer: Buffer;
  isBinary: boolean;
  author: Author;
  workflowPhaseId?: string;
  parentRev: number | null;
  message?: string;
}): Promise<ArtifactRevisionMeta> {
  const {
    revDir,
    rev,
    artifactId,
    contentBuffer,
    isBinary,
    author,
    workflowPhaseId,
    parentRev,
    message,
  } = params;

  await fs.mkdir(revDir, { recursive: true });

  const hash = hashContent(contentBuffer);
  const createdAt = new Date().toISOString();

  const meta: ArtifactRevisionMeta = {
    rev,
    artifactId,
    contentHash: hash,
    author,
    workflowPhaseId,
    parentRev,
    createdAt,
    message,
  };

  const metaPath = revisionMetaPath(revDir, rev);
  const bodyPath = revisionContentPath(revDir, rev, isBinary);

  await writeJsonAtomic(metaPath, meta);
  await writeFileAtomic(bodyPath, contentBuffer);

  return meta;
}

export async function readRevisionMeta(revDir: string, rev: number): Promise<ArtifactRevisionMeta | null> {
  const metaPath = revisionMetaPath(revDir, rev);
  try {
    const raw = await fs.readFile(metaPath, 'utf-8');
    return JSON.parse(raw) as ArtifactRevisionMeta;
  } catch {
    return null;
  }
}

export async function readRevisionContent(
  revDir: string,
  rev: number,
  isBinary: boolean,
): Promise<Buffer> {
  const bodyPath = revisionContentPath(revDir, rev, isBinary);
  return fs.readFile(bodyPath);
}

export async function listRevisionNumbers(revDir: string): Promise<number[]> {
  try {
    const entries = await fs.readdir(revDir);
    const revs: number[] = [];
    for (const name of entries) {
      const m = /^rev-(\d+)\.json$/.exec(name);
      if (m) {
        revs.push(Number.parseInt(m[1], 10));
      }
    }
    revs.sort((a, b) => a - b);
    return revs;
  } catch {
    return [];
  }
}

export async function listRevisionMetas(
  artifactsFolder: string,
  contentFilename: string,
): Promise<ArtifactRevisionMeta[]> {
  const revDir = getRevisionDir(artifactsFolder, contentFilename);
  const nums = await listRevisionNumbers(revDir);
  const metas: ArtifactRevisionMeta[] = [];
  for (const rev of nums) {
    const meta = await readRevisionMeta(revDir, rev);
    if (meta) {
      metas.push(meta);
    }
  }
  return metas;
}
