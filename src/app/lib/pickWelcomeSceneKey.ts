/**
 * Picks the scene key used for the play-route welcome morph card image.
 * {@link import('@/app/lib/SceneManager').SceneManager} keys are file basenames
 * (e.g. `creator_welcome` from `resources/scenes/creator_welcome.jpg`).
 *
 * Priority:
 * 1. `creator_welcome` — Primer Experience Creator chalkboard ("Welcome to Primer").
 * 2. Names starting with `welcome` (e.g. `welcome`, `welcome_back`).
 * 3. Names containing `welcome` (e.g. `foo_welcome`).
 */
export function pickWelcomeSceneKey(available: string[]): string | undefined {
  const lower = (n: string) => n.toLowerCase();
  return (
    available.find((n) => lower(n) === "creator_welcome") ??
    available.find((n) => lower(n).startsWith("welcome")) ??
    available.find((n) => lower(n).includes("welcome"))
  );
}
