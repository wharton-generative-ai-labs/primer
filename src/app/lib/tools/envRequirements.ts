/**
 * Maps tool names to the environment variables their implementations need.
 *
 * Two layers consume this map:
 *
 * 1. The pre-flight gate
 *    ({@link import('@/app/lib/experiences/validateExperienceForStart').validateExperienceForStart})
 *    checks that every tool reachable from an agent's toolSet has its env
 *    key set, and blocks `/play/[id]` startup with a friendly message
 *    otherwise.
 *
 * 2. The {@link import('@/app/lib/ToolRegistry').ToolRegistry} skips
 *    registering a tool whose env key is missing, so an agent that
 *    bypasses the gate (or reaches the tool through a fallback path)
 *    can't call a tool that would crash at runtime.
 *
 * Add a row when introducing a new tool whose handler hits a service
 * controlled by something other than the orchestration LLM provider.
 */
export const TOOL_ENV_KEYS: Record<string, string> = {
  // The default image strategy is OpenAI's gpt-image-2 (see
  // `image-generator/image.ts`); users overriding `IMAGE_GENERATION_MODEL`
  // to a Gemini model need `GOOGLE_AI_API_KEY` at runtime, which the
  // Nano Banana strategy enforces directly.
  generateImages: 'OPENAI_API_KEY',
};

/**
 * Returns the env key required by `toolName`, or `undefined` if the tool
 * has no hard env dependency.
 */
export function getToolEnvKey(toolName: string): string | undefined {
  return TOOL_ENV_KEYS[toolName];
}

/**
 * Returns `true` when the tool either has no env requirement or its env
 * key is present in `env`.
 */
export function isToolEnabled(
  toolName: string,
  env: Record<string, string | undefined>,
): boolean {
  const key = TOOL_ENV_KEYS[toolName];
  if (!key) return true;
  const value = env[key];
  return Boolean(value && value.length > 0);
}
