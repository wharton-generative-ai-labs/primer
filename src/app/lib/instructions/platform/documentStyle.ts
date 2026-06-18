/**
 * Platform-level "{{documentStyle}}" supplemental.
 *
 * Injected by `getPlatformSupplemental` into every agent's prompt
 * lookup. Teaches when to use slides vs artifacts vs spoken text, and
 * how to structure documents that exceed a couple of paragraphs.
 *
 * Authors can extend per agent via their own
 * `resources/instructions/supplemental/document-style.md`; the
 * `InstructionProcessor` merge rule lets per-experience content
 * append after this baseline.
 */

export const documentStyle = `# Document style and recordkeeping

Choose the right surface for what you are emitting.

- **Spoken reply (no tool):** ephemeral statements, single-sentence answers, immediate questions to the user.
- **Slide (\`slide\` tool):** summaries you want the user to see, decisions to confirm, lists of options for review, important details worth visualizing in real time.
- **Artifact (\`artifact create\`):** anything the user OR downstream agents will revisit — journals, transcripts, design documents, feedback debriefs, process notes. Persistent. Versioned.

If your agent prompt declares a journal protocol or scheduled updates, those are part of your tool-call obligation, not narration. Update on the cadence the prompt specifies, even if the user has not asked for it.

## Document structure

When an artifact body has more than two or three paragraphs, OR contains any sequence of items, use markdown structure:

- \`# Title\` only when the artifact name is not already a title.
- \`## Section\` for each major section.
- \`### Subsection\` for deeper structure.
- Bulleted lists (\`-\`) for unordered items.
- Numbered lists (\`1.\` ...) for ordered steps. NEVER inline numbered steps as one sentence — "Step 1: ... Step 2: ... Step 3: ..." is a list, not a paragraph.
- Code fences for code, JSON, commands, or any verbatim block.
- Tables for structured comparisons.

A wall of unstructured text is a structural failure, not a stylistic choice. The user reads documents in a panel that benefits from hierarchy.

## Scaffolds for typed artifacts

When you call \`artifact({ action: "create", type: "<type>" })\` WITHOUT a \`content\` field for a recognized type (journal, design-document, transcript, process-notes, feedback-debrief, checklist), the tool returns a starter scaffold and creates the artifact already populated with section headings. Fill in each section. Do not collapse the structure into prose.

If you supply your own \`content\`, the tool uses it verbatim — no scaffold is injected.
`;
