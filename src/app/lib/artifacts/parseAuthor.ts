import type { NextRequest } from 'next/server';
import type { AuthorInput } from '@/app/lib/artifacts/types';

/**
 * Prefer `x-agent-key` when present (AI tool calls through the user's session).
 */
export function parseArtifactAuthorFromRequest(
  req: NextRequest,
  body: { userEmail?: string; userName?: string },
): AuthorInput {
  const agentKey = req.headers.get('x-agent-key');
  if (agentKey) {
    return { kind: 'agent', agentKey };
  }
  const email = body.userEmail || req.headers.get('x-user-email') || '';
  if (email) {
    return {
      kind: 'user',
      email,
      name: body.userName || req.headers.get('x-user-name') || undefined,
    };
  }
  return { kind: 'system' };
}
