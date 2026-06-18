import { createModuleLogger } from '@/lib/logger';
import { env } from '@/config/env';

const logger = createModuleLogger('backend-agent-toast');

/**
 * Get the socket server URL for internal backend-to-socket communication
 * In deployed environments, use NEXT_PUBLIC_SOCKET_SERVER_URL
 * In local development, use localhost with the configured port
 */
function getSocketServerUrl(): string {
  // In deployed environments, NEXT_PUBLIC_SOCKET_SERVER_URL should be set
  // This is the public URL of the server (e.g., https://your-app.onrender.com)
  const publicSocketUrl = env.NEXT_PUBLIC_SOCKET_SERVER_URL;
  
  if (publicSocketUrl) {
    // Use the public socket URL for internal communication in deployed environments
    // This works because the server can reach itself via its public URL
    return publicSocketUrl;
  }
  
  // Fallback to localhost for local development
  const port = env.PORT || '3000';
  return `http://localhost:${port}`;
}

// Function to send toast notification to frontend
export async function sendToastNotification(sessionId: string, message: string, type: 'default' | 'destructive' = 'default') {
  const baseUrl = getSocketServerUrl();
  const url = `${baseUrl}/api/toast`;
  
  logger.info({ 
    sessionId, 
    message, 
    type,
    baseUrl,
    url,
    env: {
      NODE_ENV: env.NODE_ENV,
      NEXT_PUBLIC_SOCKET_SERVER_URL: env.NEXT_PUBLIC_SOCKET_SERVER_URL,
      PORT: env.PORT
    }
  }, 'Attempting to send toast notification');
  
  try {
    const fetchStart = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        message,
        type
      })
    });
    const fetchDuration = Date.now() - fetchStart;

    if (!response.ok) {
      const responseText = await response.text().catch(() => 'Could not read response body');
      logger.error({ 
        status: response.status, 
        statusText: response.statusText,
        responseText,
        sessionId, 
        baseUrl,
        url,
        fetchDuration
      }, 'Failed to send toast notification - non-OK response');
    } else {
      logger.info({ message, baseUrl, url, fetchDuration }, 'Toast notification sent successfully');
    }
  } catch (error) {
    logger.error({ 
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : undefined,
      errorStack: error instanceof Error ? error.stack : undefined,
      baseUrl,
      url
    }, 'Error sending toast notification - fetch threw exception');
  }
}