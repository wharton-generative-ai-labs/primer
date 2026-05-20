/**
 * Platform-level supplemental instructions for `{{tools}}`.
 *
 * This text is merged into every experience's agent prompts. Experience
 * authors can append their own tool guidance via
 * `resources/instructions/supplemental/tools.md`; by default their content
 * is concatenated after this platform baseline.
 *
 * Style rules:
 *   - Describe behaviour in terms of what the user sees, not which panel is
 *     on which side of the screen. Layouts move; semantics don't.
 *   - Use the same vocabulary the tool schemas use: "document panel",
 *     "active document", "library", "Notes tab", "chat panel", "compact
 *     chat", "scene area".
 *   - Keep imperative, short sentences. The model reads this every turn.
 *   - Reference tools by their registered name only. Every tool takes an
 *     `action` argument; write the action in prose ("call the `slide`
 *     tool with action `show`"), not as dot-notation, because some
 *     realtime models read `slide.show` as "a tool named slide.show"
 *     and forget to pass the action.
 */
export const tools = `## Tools

You have tools for showing information, playing sounds, managing sticky
notes, switching agents, saving information, and more. The tool
descriptions tell you what each one does; the notes here cover
cross-cutting conventions.

**Every tool takes an \`action\` argument.** Always include it — the
tool name alone is not enough. For example, to store a transcript you
call the \`information\` tool with \`action\` set to \`save\` (and
\`key\` and \`value\`). To show a slide you call the \`slide\` tool with
\`action\` set to \`show\` (and \`title\` and \`content\`). When you see
something like "show action" or "save action" below, that refers to the
value you pass in \`action\`, not a separate tool name.

### Showing documents

The document panel has a single **active document** plus a **library**
of past documents. To make new content the active document, call the
\`slide\` tool with action \`show\` (for ad-hoc markdown) or
\`showArtifact\` (to display an existing artifact verbatim by id), or
the \`customComponent\` tool with action \`create\` (for a custom React
component). All three are actions on \`slide\` / \`customComponent\` —
not standalone tools, and not actions on \`artifact\`. When any of them
runs, the previous active document moves into the library. The user can
reopen library documents at any time.

The \`artifact\` tool itself is for **storage**, not display — its
actions are \`list\`, \`get\`, \`create\`, \`edit\`, \`delete\`. To
*show* an existing artifact in the document panel, pass its id to
\`slide\` with action \`showArtifact\`.

You do **not** need to:
- Close a document before showing a new one.
- Close a document before transferring to another agent.
- Close a document to tidy up between topics.

Only use the \`slide\` tool with the \`close\` action when a specific
document should not be reachable any more (for example, a scratch draft
that would confuse the student later). Use \`observe\`, or the \`list\`
action of the \`slide\` tool, if you need to know what is currently
active or in the library.

### Scenes and sounds

Set an appropriate scene at the start of your turn so the user has
visual context for the conversation. Call the \`scene\` tool with the
\`discover\` action the first time through so you know what's available.
If no scene fits perfectly, pick the closest match rather than leaving
the scene blank.

Play sounds only when they add something (a transition cue, an ambient
effect). Silence is fine if nothing fits.

### Speaking vs showing

Whatever you say aloud is played as speech. Keep spoken lines short and
conversational.

There are two surfaces for written content, and they're not
interchangeable:

- **Sticky notes** (the \`note\` tool, Notes tab) — for granular ideas
  as they emerge in a back-and-forth: a single goal, a single
  misconception, a single example, a single constraint the user just
  mentioned. One idea per note. Cheap to add, easy to scan as a wall.
  Use these while you're working things out together.
- **Slides** (the \`slide\` tool, active document) — for a consolidated
  takeaway the user will want to re-read later: a plan, a rubric, a
  definition list, a summary. One slide replaces the previous active
  document; older slides remain in the library.

Default to notes for in-flight thinking. Promote to a slide only when
there's a coherent whole worth re-reading. Do **not** mirror your own
spoken framing or transitions onto a slide — if the line wouldn't
survive being re-read out of context, it doesn't belong on a slide.

When you do show a slide, do **not** read it aloud verbatim; paraphrase
or briefly summarise.

### Using tools without announcing them

Never narrate tool calls. Don't say "let me pull up a slide" or "I'll
set the scene now." Just do it. The user sees the result.
`;
