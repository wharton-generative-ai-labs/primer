// Detect Edge Runtime (Next.js middleware runs in Edge Runtime)
// Edge Runtime has limited Node.js API support (no fs, path, etc.)
// Note: Using process.env.NEXT_RUNTIME directly here is acceptable because:
// 1. This is a runtime detection check, not configuration
// 2. NEXT_RUNTIME is set by Next.js itself, not user configuration
// 3. This check happens before env module is fully initialized
const isEdgeRuntime = typeof process !== 'undefined' && process.env.NEXT_RUNTIME === 'edge';

// Conditionally import Node.js modules only in non-Edge Runtime
// Use dynamic imports for ES module compatibility
let fs: typeof import('fs/promises') | null = null;
let path: typeof import('path') | null = null;
let logger: ReturnType<typeof import('./logger').createModuleLogger> | null = null;
let env: typeof import('@/config/env').env | null = null;

let fsPromise: Promise<typeof import('fs/promises')> | null = null;
let pathPromise: Promise<typeof import('path')> | null = null;
let loggerPromise: Promise<typeof import('./logger')> | null = null;
let envPromise: Promise<typeof import('@/config/env')> | null = null;

// Lazy async initialization for non-Edge Runtime
async function initNonEdgeModules() {
  if (isEdgeRuntime) {
    return;
  }
  
  if (!fs && !fsPromise) {
    fsPromise = import('fs/promises').then(module => {
      fs = module;
      return module;
    });
  }
  
  if (!path && !pathPromise) {
    pathPromise = import('path').then(module => {
      path = module;
      return module;
    });
  }
  
  if (!logger && !loggerPromise) {
    loggerPromise = import('./logger').then(module => {
      logger = module.createModuleLogger('audit-logger');
      return module;
    });
  }
  
  if (!env && !envPromise) {
    envPromise = import('@/config/env').then(module => {
      env = module.env;
      return module;
    });
  }
  
  // Wait for all to load
  await Promise.all([fsPromise, pathPromise, loggerPromise]);
}

// Initialize modules for non-Edge Runtime (fire and forget)
if (!isEdgeRuntime) {
  initNonEdgeModules().catch(err => {
    console.error('Failed to initialize audit-logger modules:', err);
  });
}

// Edge Runtime logger (simple console fallback)
const edgeLogger = {
  error: (error: any, message: string, ...args: any[]) => {
    console.error(`[audit-logger] ${message}`, error, ...args);
  }
};

function getLogger() {
  if (isEdgeRuntime) {
    return edgeLogger;
  }
  // In non-Edge Runtime, logger will be initialized asynchronously
  // Return edgeLogger as fallback until logger is ready
  return logger || edgeLogger;
}

/**
 * Audit log event types
 */
export type AuditEventType =
  | 'auth.success'
  | 'auth.failure'
  | 'auth.logout'
  | 'authorization.failure'
  | 'admin.action'
  | 'file.upload'
  | 'file.upload.experience'
  | 'api.backend-agent'
  | 'api.analytics'
  | 'session.created'
  | 'session.resumed'
  | 'session.deleted';

/**
 * Audit log entry structure
 */
export interface AuditLogEntry {
  timestamp: string; // ISO8601
  event: AuditEventType;
  userId: string;
  ip: string;
  userAgent: string;
  details: Record<string, any>;
}

/**
 * Get the audit log directory path
 */
function getAuditLogDirectory(): string {
  if (isEdgeRuntime || !path || !env) {
    return ''; // Not available in Edge Runtime
  }
  const storageRoot = env.STORAGE_ROOT_PATH || path.join(process.cwd(), 'storage');
  return path.join(storageRoot, 'audit-logs');
}

/**
 * Get the audit log file path for today
 * Format: audit-logs/YYYY-MM-DD.jsonl
 */
function getAuditLogFilePath(): string {
  if (isEdgeRuntime || !path) {
    return ''; // Not available in Edge Runtime
  }
  const auditLogDir = getAuditLogDirectory();
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(auditLogDir, `${today}.jsonl`);
}

/**
 * Ensure the audit log directory exists
 */
async function ensureAuditLogDirectory(): Promise<void> {
  if (isEdgeRuntime || !fs) {
    return; // Skip in Edge Runtime
  }
  await initNonEdgeModules(); // Ensure modules are loaded
  const auditLogDir = getAuditLogDirectory();
  try {
    await fs!.mkdir(auditLogDir, { recursive: true });
  } catch (error) {
    getLogger().error(error, 'Failed to create audit log directory');
    throw error;
  }
}

/**
 * Extract IP address from request headers
 */
export function getClientIp(request: Request | { headers: Headers }): string {
  const headers = request.headers;
  const forwarded = headers.get('x-forwarded-for');
  const realIp = headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0]?.trim() || realIp || 'unknown';
  return ip;
}

/**
 * Extract user agent from request headers
 */
export function getUserAgent(request: Request | { headers: Headers }): string {
  return request.headers.get('user-agent') || 'unknown';
}

/**
 * Write an audit log entry to persistent storage
 * Logs are written to JSONL (JSON Lines) format, one entry per line
 * In Edge Runtime, this is a no-op (file operations not available)
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  // Edge Runtime: skip file operations (not available)
  if (isEdgeRuntime || !fs) {
    // In Edge Runtime, we could send to an API endpoint instead, but for now just skip
    // The audit log entry is still created and could be sent elsewhere if needed
    return;
  }
  
  try {
    await initNonEdgeModules(); // Ensure modules are loaded
    await ensureAuditLogDirectory();
    const logFilePath = getAuditLogFilePath();
    
    // Format as JSONL (one JSON object per line)
    const logLine = JSON.stringify(entry) + '\n';
    
    // Append to file (creates file if it doesn't exist)
    await fs!.appendFile(logFilePath, logLine, 'utf-8');
  } catch (error) {
    // Log error but don't throw - audit logging should not break the application
    getLogger().error(error, 'Failed to write audit log entry', { entry });
  }
}

/**
 * Log an audit event
 * Convenience function that creates an audit log entry and writes it
 */
export async function auditLog(
  event: AuditEventType,
  userId: string,
  request: Request | { headers: Headers },
  details: Record<string, any> = {}
): Promise<void> {
  const entry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    event,
    userId,
    ip: getClientIp(request),
    userAgent: getUserAgent(request),
    details,
  };
  
  await writeAuditLog(entry);
}

/**
 * Log authentication success
 */
export async function auditAuthSuccess(
  userId: string,
  request: Request | { headers: Headers },
  details: Record<string, any> = {}
): Promise<void> {
  await auditLog('auth.success', userId, request, details);
}

/**
 * Log authentication failure
 */
export async function auditAuthFailure(
  userId: string | null,
  request: Request | { headers: Headers },
  details: Record<string, any> = {}
): Promise<void> {
  await auditLog('auth.failure', userId || 'anonymous', request, details);
}

/**
 * Log authorization failure
 */
export async function auditAuthorizationFailure(
  userId: string,
  request: Request | { headers: Headers },
  details: Record<string, any> = {}
): Promise<void> {
  await auditLog('authorization.failure', userId, request, details);
}

/**
 * Log admin action
 */
export async function auditAdminAction(
  userId: string,
  request: Request | { headers: Headers },
  action: string,
  details: Record<string, any> = {}
): Promise<void> {
  await auditLog('admin.action', userId, request, {
    action,
    ...details,
  });
}

/**
 * Log file upload
 */
export async function auditFileUpload(
  userId: string,
  request: Request | { headers: Headers },
  details: Record<string, any> = {}
): Promise<void> {
  await auditLog('file.upload', userId, request, details);
}

/**
 * Log experience file upload
 */
export async function auditExperienceUpload(
  userId: string,
  request: Request | { headers: Headers },
  details: Record<string, any> = {}
): Promise<void> {
  await auditLog('file.upload.experience', userId, request, details);
}

/**
 * Log backend agent API call
 */
export async function auditBackendAgent(
  userId: string,
  request: Request | { headers: Headers },
  details: Record<string, any> = {}
): Promise<void> {
  await auditLog('api.backend-agent', userId, request, details);
}

/**
 * Log analytics API call
 */
export async function auditAnalytics(
  userId: string,
  request: Request | { headers: Headers },
  details: Record<string, any> = {}
): Promise<void> {
  await auditLog('api.analytics', userId, request, details);
}

/**
 * Log session creation
 */
export async function auditSessionCreated(
  userId: string,
  request: Request | { headers: Headers },
  details: Record<string, any> = {}
): Promise<void> {
  await auditLog('session.created', userId, request, details);
}

/**
 * Log session resumption (user chose "Continue" on the recovery dialog).
 */
export async function auditSessionResumed(
  userId: string,
  request: Request | { headers: Headers },
  details: Record<string, any> = {}
): Promise<void> {
  await auditLog('session.resumed', userId, request, details);
}

/**
 * Log session deletion
 */
export async function auditSessionDeleted(
  userId: string,
  request: Request | { headers: Headers },
  details: Record<string, any> = {}
): Promise<void> {
  await auditLog('session.deleted', userId, request, details);
}
