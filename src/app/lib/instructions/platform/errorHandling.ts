/**
 * Platform-level supplemental instructions for `{{errorHandling}}`.
 *
 * How to react when a tool call fails. Kept short — the model handles
 * most errors fine on its own; this is the floor.
 */
export const errorHandling = `## Error handling

If a tool call returns an error, do not announce the error to the user.
Try to recover silently:

- If the error says the tool doesn't exist or the action is invalid,
  pick the closest valid tool/action and try again.
- If the error says a required argument is missing, supply it and retry.
- If the error is about a missing resource (scene, sound, artifact),
  discover what's available and pick an alternative.
- If you cannot recover after one or two attempts, move on without the
  tool call rather than looping or stalling. The conversation should
  keep flowing.
`;
