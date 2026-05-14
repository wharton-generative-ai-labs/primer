// Detect Edge Runtime (Next.js middleware runs in Edge Runtime)
// Edge Runtime has limited Node.js API support
const isEdgeRuntime = typeof process !== 'undefined' && process.env.NEXT_RUNTIME === 'edge';
const isNextBuildPhase = typeof process !== 'undefined' && (
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.env.npm_lifecycle_event === 'build' ||
  process.argv.some((arg) => arg.includes('next') && arg.includes('build'))
);

// For Edge Runtime, use process.env directly without validation
// For non-Edge Runtime, use zod for validation
let validatedEnv: any = null;
let initPromise: Promise<void> | null = null;

// Synchronous initialization function
async function initializeEnv() {
  if (validatedEnv !== null) {
    return; // Already initialized
  }

  // Edge Runtime: return env vars directly without validation
  if (isEdgeRuntime) {
    validatedEnv = {
      NODE_ENV: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY,
      PORT: process.env.PORT,
      ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
      NEXT_PUBLIC_SOCKET_SERVER_URL: process.env.NEXT_PUBLIC_SOCKET_SERVER_URL,
      NEXT_PUBLIC_SHOW_TEST_IFRAME: process.env.NEXT_PUBLIC_SHOW_TEST_IFRAME,
      STORAGE_ROOT_PATH: process.env.STORAGE_ROOT_PATH,
      USER_ROLE_MAPPINGS: process.env.USER_ROLE_MAPPINGS,
      NEXT_PUBLIC_DELEGATION_TIMEOUT_MS: process.env.NEXT_PUBLIC_DELEGATION_TIMEOUT_MS,
      MODULE_REGISTRY_URLS: process.env.MODULE_REGISTRY_URLS,
      MODULE_REGISTRY_TOKEN: process.env.MODULE_REGISTRY_TOKEN,
    };
    return;
  }

  // Non-Edge Runtime: use zod for validation
  try {
    const [zodModule, dotenvModule] = await Promise.all([
      import('zod'),
      import('dotenv')
    ]);

    const { z } = zodModule;

    // Load .env file if we're in Node.js environment
    const isNodeEnv = typeof window === 'undefined' && typeof process !== 'undefined';
    if (isNodeEnv) {
      try {
        dotenvModule.config({ quiet: true });
      } catch {
        // dotenv config failed, skip (env vars should be set in environment)
      }
    }

    const envSchema = z.object({
      // Required environment variables
      OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
      GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
      GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
      NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),
      
      // Optional environment variables with defaults
      NEXTAUTH_URL: z.union([z.string().url(), z.literal('')]).optional(),
      ANTHROPIC_API_KEY: z.string().optional(),
      GOOGLE_AI_API_KEY: z.string().optional(),
      PORT: z.string().optional().default('3000'),
      NODE_ENV: z.enum(['development', 'production', 'test']).optional().default('development'),
      
      // Optional feature flags and configuration
      ALLOWED_ORIGINS: z.string().optional(),
      NEXT_PUBLIC_SOCKET_SERVER_URL: z.string().url().optional(),
      NEXT_PUBLIC_SHOW_TEST_IFRAME: z.string().optional(),
      STORAGE_ROOT_PATH: z.string().optional(),
      USER_ROLE_MAPPINGS: z.string().optional(),
      
      // Agent configuration
      NEXT_PUBLIC_DELEGATION_TIMEOUT_MS: z.string().optional(), // Delegation timeout in milliseconds (default: 900000 = 15 min)
      
      // Module registry
      MODULE_REGISTRY_URLS: z.string().optional(), // Comma-separated list of module registry manifest URLs
      MODULE_REGISTRY_TOKEN: z.string().optional(), // GitHub PAT for accessing private module registries
    });

    // Check if we're on server without using process.versions (not available in Edge Runtime)
    const isServer = typeof window === 'undefined' && typeof process !== 'undefined' && !isEdgeRuntime;
    
    try {
      if (isServer) {
        // Full validation on server side
        validatedEnv = envSchema.parse(process.env);
      } else {
        // Browser: only return safe, public environment variables
        // Next.js injects NEXT_PUBLIC_* vars at build time
        validatedEnv = {
          NODE_ENV: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
          NEXT_PUBLIC_SOCKET_SERVER_URL: process.env.NEXT_PUBLIC_SOCKET_SERVER_URL,
          NEXT_PUBLIC_SHOW_TEST_IFRAME: process.env.NEXT_PUBLIC_SHOW_TEST_IFRAME,
          NEXT_PUBLIC_DELEGATION_TIMEOUT_MS: process.env.NEXT_PUBLIC_DELEGATION_TIMEOUT_MS,
        } as any;
      }
    } catch (error: unknown) {
      // Check if error is a ZodError
      if (z && error instanceof z.ZodError) {
        // Only show validation errors on server
        if (isServer) {
          const zodError = error as InstanceType<typeof z.ZodError>;
          const errorMessages = zodError.issues.map((err) => {
            const path = err.path.map(String).join('.');
            return `  - ${path}: ${err.message}`;
          }).join('\n');
          
          // Note: Using console.error here instead of logger because:
          // 1. This runs during early module initialization before logger is ready
          // 2. Logger depends on this env module, creating a circular dependency
          // 3. Environment validation errors must be visible immediately at startup
          // 4. These are critical configuration errors that should halt execution
          console.error('\n❌ Environment variable validation failed:\n');
          console.error(errorMessages);
          console.error('\nPlease check your .env file and ensure all required variables are set.\n');
          console.error('Required variables:');
          console.error('  - OPENAI_API_KEY');
          console.error('  - GOOGLE_CLIENT_ID');
          console.error('  - GOOGLE_CLIENT_SECRET');
          console.error('  - NEXTAUTH_SECRET (must be at least 32 characters)\n');
          
          // Avoid terminating Next.js build workers; enforce strict validation at runtime.
          if (
            !isNextBuildPhase &&
            typeof process !== 'undefined' &&
            typeof process.exit === 'function'
          ) {
            process.exit(1);
          } else {
            // Continue with a minimal env object during build or non-Node contexts.
            validatedEnv = {
              NODE_ENV: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
              NEXT_PUBLIC_SOCKET_SERVER_URL: process.env.NEXT_PUBLIC_SOCKET_SERVER_URL,
              NEXT_PUBLIC_SHOW_TEST_IFRAME: process.env.NEXT_PUBLIC_SHOW_TEST_IFRAME,
              NEXT_PUBLIC_DELEGATION_TIMEOUT_MS: process.env.NEXT_PUBLIC_DELEGATION_TIMEOUT_MS,
            } as any;
          }
        }
        // In browser, return a minimal safe object with public env vars.
        if (validatedEnv === null) {
          validatedEnv = {
            NODE_ENV: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
            NEXT_PUBLIC_SOCKET_SERVER_URL: process.env.NEXT_PUBLIC_SOCKET_SERVER_URL,
            NEXT_PUBLIC_SHOW_TEST_IFRAME: process.env.NEXT_PUBLIC_SHOW_TEST_IFRAME,
            NEXT_PUBLIC_DELEGATION_TIMEOUT_MS: process.env.NEXT_PUBLIC_DELEGATION_TIMEOUT_MS,
          } as any;
        }
      } else {
        throw error;
      }
    }
  } catch (err) {
    // Note: Using console.error here for the same reasons as above
    console.error('Failed to initialize env modules:', err);
    // Fallback to process.env
    validatedEnv = {
      NODE_ENV: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
    };
  }
}

// Start initialization immediately
if (!initPromise) {
  initPromise = initializeEnv();
}

// For Edge Runtime, initialize synchronously (it's already done)
if (isEdgeRuntime) {
  initializeEnv();
}

/**
 * Validated environment variables
 * Access this instead of process.env directly for type safety
 * 
 * Note: In non-Edge Runtime, this may return process.env values until validation completes.
 * For server.ts and other synchronous code, we need to ensure initialization completes.
 * The proxy will return process.env as fallback until validatedEnv is ready.
 */
export const env = new Proxy({} as any, {
  get(_target, prop) {
    // If validated env is ready, use it
    if (validatedEnv !== null) {
      return validatedEnv[prop];
    }
    // Otherwise, fallback to process.env (will be replaced once validation completes)
    // This is safe because validation happens quickly on module load
    return (process.env as any)[prop];
  }
});

// Export a function to ensure env is initialized (for server.ts)
export async function ensureEnvInitialized() {
  if (initPromise) {
    await initPromise;
  }
}
