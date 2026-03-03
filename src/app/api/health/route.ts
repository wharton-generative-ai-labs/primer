import { NextResponse } from 'next/server';
import { StorageServiceFactory } from '@/app/lib/storage/StorageServiceFactory';
import { env } from '@/config/env';

/**
 * GET /api/health
 * Health check endpoint for monitoring and load balancer probes
 * Returns 200 if healthy, 503 if any critical service is unhealthy
 */
export async function GET() {
  const checks: Record<string, string | number> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: env.NEXT_PUBLIC_APP_VERSION || 'unknown',
    uptime: Math.floor(process.uptime()),
    environment: env.NODE_ENV,
  };

  let allHealthy = true;

  // Check storage service
  try {
    const storage = StorageServiceFactory.getInstance();
    // Try to list directories as a lightweight health check
    await storage.listDirectories('');
    checks.storage = 'ok';
  } catch {
    checks.storage = 'error';
    allHealthy = false;
  }

  // Check OpenAI API key configuration
  // Note: We don't make actual API calls to avoid costs, just verify config
  if (env.OPENAI_API_KEY && env.OPENAI_API_KEY.length > 0) {
    checks.openai = 'configured';
  } else {
    checks.openai = 'error';
    allHealthy = false;
  }

  // Check NextAuth configuration
  if (env.NEXTAUTH_SECRET && env.NEXTAUTH_SECRET.length >= 32) {
    checks.auth = 'configured';
  } else {
    checks.auth = 'error';
    allHealthy = false;
  }

  return NextResponse.json(checks, {
    status: allHealthy ? 200 : 503,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
