/**
 * Analytics Run API Route
 *
 * Lightweight persistence layer for analytics job status.
 * Actual agent execution happens via Socket.IO (agent.run event in server.ts),
 * orchestrated by the useAnalyticsJobs hook on the client.
 *
 * Endpoints:
 *   GET  ?experienceId=…&jobId=…  — Retrieve a persisted job (e.g. after page reload)
 *   PUT  { experienceId, job }     — Persist / update a job record
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { StorageServiceFactory } from '@/app/lib/storage/StorageServiceFactory';
import { AnalyticsJobStatus } from '@/app/lib/types';
import { canManageClasses } from '@/app/lib/classAuth';
import path from 'path';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('analytics-run');

// ---------------------------------------------------------------------------
// File-based job store (persisted via StorageService)
// Jobs are stored at {experienceId}/analytics_jobs.json so they survive
// page reloads and provide an audit trail.
// ---------------------------------------------------------------------------

interface JobsFile {
  jobs: Record<string, AnalyticsJobStatus>;
}

function jobsFilePath(experienceId: string): string {
  return path.join(experienceId, 'analytics_jobs.json');
}

async function loadJobs(experienceId: string): Promise<JobsFile> {
  const storage = StorageServiceFactory.getInstance();
  const filePath = jobsFilePath(experienceId);
  try {
    if (await storage.fileExists(filePath)) {
      const raw = await storage.readFileAsText(filePath);
      return JSON.parse(raw) as JobsFile;
    }
  } catch (error) {
    logger.warn(error, 'Failed to load analytics_jobs.json, starting fresh');
  }
  return { jobs: {} };
}

async function saveJobs(experienceId: string, jobsFile: JobsFile): Promise<void> {
  const storage = StorageServiceFactory.getInstance();
  const filePath = jobsFilePath(experienceId);
  await storage.storeFile(filePath, Buffer.from(JSON.stringify(jobsFile, null, 2)));
}

// ---------------------------------------------------------------------------
// GET — retrieve a persisted job
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request });
    if (!token?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get('jobId');
    const experienceId = searchParams.get('experienceId');

    if (!jobId || !experienceId) {
      return NextResponse.json(
        { error: 'jobId and experienceId are required' },
        { status: 400 }
      );
    }

    const jobsFile = await loadJobs(experienceId);
    const job = jobsFile.jobs[jobId];

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({ job });
  } catch (error) {
    logger.error(error, 'GET error');
    return NextResponse.json({ error: 'Failed to get job status' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT — persist / update a job record
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest) {
  try {
    const token = await getToken({ req: request });
    if (!token?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { experienceId, job } = body as { experienceId: string; job: AnalyticsJobStatus };

    if (!experienceId || !job?.jobId) {
      return NextResponse.json(
        { error: 'experienceId and job (with jobId) are required' },
        { status: 400 }
      );
    }

    // Authorization check
    const canManage = await canManageClasses(experienceId, token.email);
    if (!canManage) {
      return NextResponse.json(
        { error: 'Not authorized to manage analytics for this experience' },
        { status: 403 }
      );
    }

    const jobsFile = await loadJobs(experienceId);
    jobsFile.jobs[job.jobId] = job;
    await saveJobs(experienceId, jobsFile);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(error, 'PUT error');
    return NextResponse.json({ error: 'Failed to persist job' }, { status: 500 });
  }
}
