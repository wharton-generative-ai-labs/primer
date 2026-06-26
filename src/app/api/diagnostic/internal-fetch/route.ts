/**
 * Diagnostic endpoint to test internal fetch capability
 * 
 * This endpoint tests whether the backend can successfully fetch to itself
 * via the configured NEXT_PUBLIC_SOCKET_SERVER_URL. This helps diagnose
 * issues with delegation status and toast notifications in deployed environments.
 */

import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/config/env';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('diagnostic-internal-fetch');

/**
 * Get the socket server URL for internal backend-to-socket communication
 */
function getSocketServerUrl(): string {
  const publicSocketUrl = env.NEXT_PUBLIC_SOCKET_SERVER_URL;
  
  if (publicSocketUrl) {
    return publicSocketUrl;
  }
  
  const port = env.PORT || '3000';
  return `http://localhost:${port}`;
}

export async function GET(_request: NextRequest) {
  const results: any = {
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: env.NODE_ENV,
      NEXT_PUBLIC_SOCKET_SERVER_URL: env.NEXT_PUBLIC_SOCKET_SERVER_URL,
      PORT: env.PORT,
    },
    tests: []
  };

  const baseUrl = getSocketServerUrl();
  results.baseUrl = baseUrl;

  // Test 1: Fetch to the diagnostic ping endpoint
  logger.info({ baseUrl }, 'Starting internal fetch diagnostics');
  
  try {
    const pingUrl = `${baseUrl}/api/diagnostic/ping`;
    logger.info({ pingUrl }, 'Testing fetch to ping endpoint');
    
    const pingStart = Date.now();
    const pingResponse = await fetch(pingUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Internal-Diagnostic-Test',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });
    const pingDuration = Date.now() - pingStart;

    const pingResult: any = {
      test: 'ping',
      url: pingUrl,
      duration: pingDuration,
      status: pingResponse.status,
      statusText: pingResponse.statusText,
      ok: pingResponse.ok,
    };

    if (pingResponse.ok) {
      try {
        pingResult.body = await pingResponse.text();
      } catch (_e) {
        pingResult.bodyError = 'Could not read response body';
      }
    } else {
      try {
        pingResult.errorBody = await pingResponse.text();
      } catch (_e) {
        pingResult.bodyError = 'Could not read error response body';
      }
    }

    results.tests.push(pingResult);
    logger.info({ pingResult }, 'Ping test completed');
  } catch (error) {
    const errorResult = {
      test: 'ping',
      url: `${baseUrl}/api/diagnostic/ping`,
      error: true,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : undefined,
      errorStack: error instanceof Error ? error.stack : undefined,
    };
    results.tests.push(errorResult);
    logger.error({ errorResult }, 'Ping test failed with exception');
  }

  // Test 2: Test POST to socket-delegation-status endpoint
  try {
    const delegationUrl = `${baseUrl}/api/socket-delegation-status`;
    logger.info({ delegationUrl }, 'Testing fetch to delegation status endpoint');
    
    const delegationStart = Date.now();
    const delegationResponse = await fetch(delegationUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Internal-Diagnostic-Test',
      },
      body: JSON.stringify({
        sessionId: 'diagnostic-test-session',
        delegationId: 'diagnostic-test-delegation',
        status: 'Diagnostic test message',
        agentName: 'Diagnostic Agent',
      }),
      signal: AbortSignal.timeout(10000),
    });
    const delegationDuration = Date.now() - delegationStart;

    const delegationResult: any = {
      test: 'delegation-status',
      url: delegationUrl,
      duration: delegationDuration,
      status: delegationResponse.status,
      statusText: delegationResponse.statusText,
      ok: delegationResponse.ok,
    };

    if (delegationResponse.ok) {
      try {
        delegationResult.body = await delegationResponse.json();
      } catch (_e) {
        delegationResult.bodyError = 'Could not parse response body as JSON';
      }
    } else {
      try {
        delegationResult.errorBody = await delegationResponse.text();
      } catch (_e) {
        delegationResult.bodyError = 'Could not read error response body';
      }
    }

    results.tests.push(delegationResult);
    logger.info({ delegationResult }, 'Delegation status test completed');
  } catch (error) {
    const errorResult = {
      test: 'delegation-status',
      url: `${baseUrl}/api/socket-delegation-status`,
      error: true,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : undefined,
      errorStack: error instanceof Error ? error.stack : undefined,
    };
    results.tests.push(errorResult);
    logger.error({ errorResult }, 'Delegation status test failed with exception');
  }

  // Test 3: Test POST to toast endpoint
  try {
    const toastUrl = `${baseUrl}/api/toast`;
    logger.info({ toastUrl }, 'Testing fetch to toast endpoint');
    
    const toastStart = Date.now();
    const toastResponse = await fetch(toastUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Internal-Diagnostic-Test',
      },
      body: JSON.stringify({
        sessionId: 'diagnostic-test-session',
        message: 'Diagnostic test toast',
        type: 'default',
      }),
      signal: AbortSignal.timeout(10000),
    });
    const toastDuration = Date.now() - toastStart;

    const toastResult: any = {
      test: 'toast',
      url: toastUrl,
      duration: toastDuration,
      status: toastResponse.status,
      statusText: toastResponse.statusText,
      ok: toastResponse.ok,
    };

    if (toastResponse.ok) {
      try {
        toastResult.body = await toastResponse.json();
      } catch (_e) {
        toastResult.bodyError = 'Could not parse response body as JSON';
      }
    } else {
      try {
        toastResult.errorBody = await toastResponse.text();
      } catch (_e) {
        toastResult.bodyError = 'Could not read error response body';
      }
    }

    results.tests.push(toastResult);
    logger.info({ toastResult }, 'Toast test completed');
  } catch (error) {
    const errorResult = {
      test: 'toast',
      url: `${baseUrl}/api/toast`,
      error: true,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : undefined,
      errorStack: error instanceof Error ? error.stack : undefined,
    };
    results.tests.push(errorResult);
    logger.error({ errorResult }, 'Toast test failed with exception');
  }

  // Determine overall status
  const allTestsPassed = results.tests.every((test: any) => test.ok === true);
  results.summary = {
    allTestsPassed,
    totalTests: results.tests.length,
    passedTests: results.tests.filter((test: any) => test.ok === true).length,
    failedTests: results.tests.filter((test: any) => test.ok !== true).length,
  };

  logger.info({ results }, 'Internal fetch diagnostics completed');

  return NextResponse.json(results, { 
    status: allTestsPassed ? 200 : 500,
    headers: {
      'Cache-Control': 'no-store',
    }
  });
}
