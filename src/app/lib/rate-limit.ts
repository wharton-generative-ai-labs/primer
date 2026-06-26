/**
 * Simple in-memory rate limiter for Next.js API routes
 * 
 * Provides protection against:
 * - Brute force attacks
 * - DoS attacks
 * - API quota exhaustion
 * - Spam file uploads
 */

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum requests per window
  message?: string; // Custom error message
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes
    // Use unref() to allow Node.js to exit even if this timer is active
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
    
    // Allow Node.js to exit even if this timer is active (important for tests)
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime < now) {
        this.store.delete(key);
      }
    }
  }

  private getKey(identifier: string, configKey: string): string {
    return `${configKey}:${identifier}`;
  }

  check(identifier: string, config: RateLimitConfig): { allowed: boolean; remaining: number; resetTime: number } {
    const key = this.getKey(identifier, `${config.windowMs}:${config.max}`);
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || entry.resetTime < now) {
      // Create new entry or reset expired entry
      const resetTime = now + config.windowMs;
      this.store.set(key, {
        count: 1,
        resetTime
      });
      return {
        allowed: true,
        remaining: config.max - 1,
        resetTime
      };
    }

    // Entry exists and is still valid
    if (entry.count >= config.max) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime
      };
    }

    // Increment count
    entry.count++;
    return {
      allowed: true,
      remaining: config.max - entry.count,
      resetTime: entry.resetTime
    };
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

// Singleton instance
const rateLimiter = new RateLimiter();

// Predefined rate limit configurations
export const rateLimitConfigs = {
  // General API endpoints: 100 requests per 15 minutes
  api: {
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests. Please try again later.'
  },
  
  // File uploads: 10 requests per hour
  upload: {
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: 'Too many upload requests. Please try again later.'
  },
  
  // Authentication endpoints: 5 requests per 15 minutes
  auth: {
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many authentication attempts. Please try again later.'
  },
  
  // Strict rate limit for sensitive operations: 20 requests per 15 minutes
  strict: {
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: 'Rate limit exceeded. Please try again later.'
  }
} as const;

/**
 * Get client identifier from request
 * Uses IP address as fallback, can be extended to use user ID or session ID
 */
export function getClientIdentifier(request: Request): string {
  // Try to get IP from headers (useful when behind proxy)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0]?.trim() || realIp || 'unknown';
  
  return ip;
}

/**
 * Rate limit middleware for Next.js API routes
 * 
 * @example
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const identifier = getClientIdentifier(request);
 *   const result = rateLimit(identifier, rateLimitConfigs.upload);
 *   
 *   if (!result.allowed) {
 *     return NextResponse.json(
 *       { error: result.message },
 *       { 
 *         status: 429,
 *         headers: {
 *           'X-RateLimit-Limit': result.max.toString(),
 *           'X-RateLimit-Remaining': result.remaining.toString(),
 *           'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
 *         }
 *       }
 *     );
 *   }
 *   // ... rest of handler
 * }
 * ```
 */
export function rateLimit(
  identifier: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetTime: number; message: string; max: number } {
  const result = rateLimiter.check(identifier, config);
  
  return {
    ...result,
    message: config.message || 'Rate limit exceeded',
    max: config.max
  };
}
