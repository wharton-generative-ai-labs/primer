// Detect Edge Runtime (Next.js middleware runs in Edge Runtime)
// Edge Runtime has limited Node.js API support
const isEdgeRuntime = typeof process !== 'undefined' && process.env.NEXT_RUNTIME === 'edge';

// Conditionally import pino only in non-Edge Runtime
// Use dynamic imports for ES module compatibility
let pino: any = null;
let pinoPromise: Promise<any> | null = null;
let env: typeof import('@/config/env').env | null = null;
let envPromise: Promise<typeof import('@/config/env')> | null = null;
let fs: typeof import('fs') | null = null;
let fsPromise: Promise<typeof import('fs')> | null = null;
let path: typeof import('path') | null = null;
let pathPromise: Promise<typeof import('path')> | null = null;

// Lazy async initialization for non-Edge Runtime
async function initNonEdgeModules() {
  if (isEdgeRuntime) {
    return;
  }
  
  if (!pino && !pinoPromise) {
    pinoPromise = import('pino').then(module => {
      pino = module.default;
      return pino;
    });
  }
  
  if (!env && !envPromise) {
    envPromise = import('@/config/env').then(module => {
      env = module.env;
      return module;
    });
  }
  
  if (!fs && !fsPromise) {
    fsPromise = import('fs').then(module => {
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
  
  // Wait for all to load
  await Promise.all([pinoPromise, envPromise, fsPromise, pathPromise]);
}

// Synchronous getter that initializes if needed (for Edge Runtime compatibility)
function getNodeEnvSync(): 'development' | 'production' | 'test' {
  if (isEdgeRuntime) {
    return (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development';
  }
  // In non-Edge Runtime, try to get from env if already loaded, otherwise use process.env
  return env?.NODE_ENV || (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development';
}

// Initialize modules for non-Edge Runtime (fire and forget - will be ready when needed)
if (!isEdgeRuntime) {
  initNonEdgeModules().catch(err => {
    console.error('Failed to initialize logger modules:', err);
  });
}

/**
 * Structured logger using Pino
 * 
 * Features:
 * - JSON structured logging for production (easy to parse/aggregate)
 * - Pretty printing for development (when safe to use)
 * - Debug logs only in non-production environments
 * - Error/warn logs always enabled
 * - Contextual logging with metadata
 * - Edge Runtime: falls back to console methods
 */
const isProduction = getNodeEnvSync() === 'production';
const isServer = typeof window === 'undefined' && typeof process !== 'undefined' && !isEdgeRuntime && typeof process.versions?.node !== 'undefined';
const isBrowser = typeof window !== 'undefined';

// pino-pretty uses worker threads which cause issues in Next.js server contexts
// Disable it when running in Next.js server contexts (API routes, server components, etc.)
// Only use pino-pretty in the custom server.ts context where worker threads work properly
// Next.js sets NEXT_RUNTIME in server contexts, or we can check for Next.js-specific globals
const isNextJsContext = isServer && (
  typeof process.env.NEXT_RUNTIME !== 'undefined' ||
  typeof (globalThis as any).__NEXT_DATA__ !== 'undefined'
);

const usePrettyTransport = !isProduction && isServer && !isNextJsContext;

// Edge Runtime logger (simple console fallback)
const edgeLogger = {
  debug: (obj: any, msg: string) => {
    if (!isProduction) {
      console.debug(`[DEBUG] ${msg}`, obj);
    }
  },
  info: (obj: any, msg: string) => {
    console.info(`[INFO] ${msg}`, obj);
  },
  warn: (obj: any, msg: string) => {
    console.warn(`[WARN] ${msg}`, obj);
  },
  error: (obj: any, msg: string) => {
    console.error(`[ERROR] ${msg}`, obj);
  },
  child: (bindings: Record<string, any>) => {
    const prefix = bindings.module ? `[${bindings.module}]` : '';
    return {
      debug: (obj: any, msg: string) => edgeLogger.debug(obj, `${prefix} ${msg}`),
      info: (obj: any, msg: string) => edgeLogger.info(obj, `${prefix} ${msg}`),
      warn: (obj: any, msg: string) => edgeLogger.warn(obj, `${prefix} ${msg}`),
      error: (obj: any, msg: string) => edgeLogger.error(obj, `${prefix} ${msg}`),
      child: (childBindings: Record<string, any>) => edgeLogger.child({ ...bindings, ...childBindings }),
    };
  },
};

// Initialize pino logger only in non-Edge Runtime
// This will be initialized asynchronously, so we start with edgeLogger
let logger: typeof edgeLogger | any = edgeLogger;

// Initialize pino logger asynchronously (non-blocking)
if (!isEdgeRuntime) {
  initNonEdgeModules().then(() => {
    if (pino) {
      // Check if file logging is enabled (via environment variable)
      const enableFileLogging = process.env.LOG_FILE_ENABLED === 'true';
      let fileLoggingSuccess = false;
      
      // If file logging is enabled and we're on the server
      if (enableFileLogging && isServer && fs && path) {
        try {
          // Set up log directory
          const storageRoot = env?.STORAGE_ROOT_PATH || path.join(process.cwd(), 'storage');
          const logDir = path.join(storageRoot, 'logs');
          
          // Create log directory if it doesn't exist (synchronous for simplicity)
          if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
          }
          
          // Create log file path with date
          const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
          const logFilePath = path.join(logDir, `app-${today}.log`);
          
          // Create file write stream
          const fileStream = fs.createWriteStream(logFilePath, { flags: 'a' });
          
          // Set up multiple streams (console + file)
          const streams = [];
          
          // Console stream (with pretty printing in dev)
          if (usePrettyTransport) {
            streams.push({
              level: isProduction ? 'info' : 'debug',
              stream: pino.transport({
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  translateTime: 'HH:MM:ss.l',
                  ignore: 'pid,hostname',
                },
              }),
            });
          } else {
            streams.push({
              level: isProduction ? 'info' : 'debug',
              stream: process.stdout,
            });
          }
          
          // File stream (JSON format)
          streams.push({
            level: 'debug', // Log everything to file
            stream: fileStream,
          });
          
          // Create logger with multiple streams
          logger = pino(
            {
              level: isProduction ? 'info' : 'debug',
              formatters: {
                level: (label: string) => {
                  return { level: label };
                },
              },
              base: {
                env: getNodeEnvSync(),
              },
            },
            pino.multistream(streams)
          );
          
          console.log(`[logger] File logging enabled: ${logFilePath}`);
          fileLoggingSuccess = true;
        } catch (error) {
          console.error('[logger] Failed to set up file logging, falling back to console only:', error);
        }
      }
      
      // If file logging is not enabled or setup failed, use regular console logger
      if (!fileLoggingSuccess) {
        logger = pino({
          level: isProduction ? 'info' : 'debug',
          // Browser configuration: pino automatically uses console methods in browser
          // No special config needed - pino handles browser/server automatically
          browser: isBrowser
            ? {
                asObject: false, // Use console methods (console.log, console.error, etc.) instead of JSON
              }
            : undefined,
          // Only use pino-pretty transport on server, and only when NOT in Next.js contexts
          // (pino-pretty uses worker threads which don't work in Next.js server-side rendering)
          transport: usePrettyTransport
            ? {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  translateTime: 'HH:MM:ss.l',
                  ignore: 'pid,hostname',
                },
              }
            : undefined, // Use default JSON output in production, Next.js contexts, or browser
          formatters: {
            level: (label: string) => {
              return { level: label };
            },
          },
          base: {
            env: getNodeEnvSync(),
          },
        });
      }
    }
  }).catch(err => {
    console.error('Failed to initialize pino logger, using console fallback:', err);
  });
}

/**
 * Logger interface that matches console API for easy migration
 * but provides structured logging capabilities
 */
export const log = {
  /**
   * Debug logs - only in non-production
   * Use for detailed debugging information
   */
  debug: (message: string, ...args: any[]) => {
    if (!isProduction) {
      logger.debug({ data: args.length === 1 ? args[0] : args }, message);
    }
  },

  /**
   * Info logs - always enabled
   * Use for important informational messages
   */
  info: (message: string, ...args: any[]) => {
    logger.info({ data: args.length === 1 ? args[0] : args }, message);
  },

  /**
   * Warning logs - always enabled
   * Use for warnings that don't stop execution
   */
  warn: (message: string, ...args: any[]) => {
    logger.warn({ data: args.length === 1 ? args[0] : args }, message);
  },

  /**
   * Error logs - always enabled
   * Use for errors and exceptions
   */
  error: (message: string, error?: Error | unknown, ...args: any[]) => {
    const errorData: any = { data: args.length === 1 ? args[0] : args };
    
    if (error instanceof Error) {
      errorData.error = {
        message: error.message,
        stack: error.stack,
        name: error.name,
      };
    } else if (error) {
      errorData.error = error;
    }
    
    logger.error(errorData, message);
  },

  /**
   * Create a child logger with context
   * Useful for adding metadata like module name, request ID, etc.
   */
  child: (bindings: Record<string, any>) => {
    return logger.child(bindings);
  },
};

/**
 * Create a module-specific logger
 * Usage: const logger = createModuleLogger('backend-agent');
 */
export function createModuleLogger(module: string) {
  return logger.child({ module });
}

export default logger;
