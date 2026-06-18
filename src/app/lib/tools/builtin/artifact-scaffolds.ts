/**
 * Starter scaffolds for known artifact types. When an agent calls
 * `artifact({ action: "create", type: "<type>" })` without a `content`
 * field, the artifact tool synthesizes content from the matching
 * scaffold so the new artifact already has section headings the agent
 * fills in.
 *
 * Scaffolds use `{{name}}` as the only substitution. Keep them
 * deliberately spare — the LLM authors the prose; we seed the
 * structure.
 */

export const ARTIFACT_SCAFFOLDS: Record<string, string> = {
  journal: [
    '# {{name}}',
    '',
    '## Session Goal',
    '',
    '_What I aim to accomplish in this conversation._',
    '',
    '## Current Understanding',
    '',
    "_What I know about the user's needs so far._",
    '',
    '## Strategic Plan',
    '',
    '_My approach for the next 1-3 interactions._',
    '',
    '## Key Observations',
    '',
    '_Important details about context, needs, misconceptions._',
    '',
    '## Decisions Made',
    '',
    '_Important choices and their rationale, when applicable._',
    '',
    '## Next Steps',
    '',
    '_What I need to clarify or explore next._',
    '',
  ].join('\n'),

  'design-document': [
    '# {{name}}',
    '',
    '## Note to Educator',
    '',
    '_Brief framing for the educator reviewing this document._',
    '',
    '## Overview',
    '',
    '_What this experience is, the template structure, learning level, what students will learn._',
    '',
    '## The Experience Flow',
    '',
    '### Setting the Scene',
    '',
    '_The mentor character introduces the topic and prepares the student for practice._',
    '',
    '### The Practice Session',
    '',
    '_What the student does in role and the challenges they encounter._',
    '',
    '### Wrapping Up',
    '',
    '_Feedback focus and next steps for continued learning._',
    '',
    '## Character Context',
    '',
    '### Mentor Context',
    '',
    '_Persona, setting, urgency, voice, teaching tactics, handoff framing._',
    '',
    '### Practice Character Context',
    '',
    '_Role, motivation, conflict, stakes, voice, behavioral tactics._',
    '',
    '### Feedback Character Context',
    '',
    '_Coaching persona, tone, evaluation framework._',
    '',
  ].join('\n'),

  transcript: [
    '# {{name}}',
    '',
    '## Participants',
    '',
    '- _Speaker A_',
    '- _Speaker B_',
    '',
    '## Conversation',
    '',
    '**Speaker A:** _line_',
    '',
    '**Speaker B:** _line_',
    '',
  ].join('\n'),

  'process-notes': [
    '# {{name}}',
    '',
    '## Inputs',
    '',
    '_Materials, transcripts, or upstream artifacts I read._',
    '',
    '## Decisions',
    '',
    '_What I chose to do and why._',
    '',
    '## Open Questions',
    '',
    '_Anything I deferred or flagged for the next agent._',
    '',
    '## Outputs',
    '',
    '_Artifacts produced, with IDs._',
    '',
  ].join('\n'),

  'feedback-debrief': [
    '# {{name}}',
    '',
    '## Self-Assessment Prompt',
    '',
    '_What I asked the student to reflect on first._',
    '',
    '## Strengths Observed',
    '',
    '_Two specific moments with quotes from the transcript._',
    '',
    '## Growth Areas',
    '',
    '_One or two with specific evidence._',
    '',
    '## Concrete Next Steps',
    '',
    '_Two or three actionable improvements._',
    '',
  ].join('\n'),

  checklist: [
    '# {{name}}',
    '',
    '- [ ] _First item_',
    '- [ ] _Second item_',
    '- [ ] _Third item_',
    '',
  ].join('\n'),
};

export function getScaffold(type: string, name: string): string | null {
  const tpl = ARTIFACT_SCAFFOLDS[type];
  if (!tpl) return null;
  return tpl.replace(/\{\{name\}\}/g, name);
}

export function isScaffoldedType(type: string): boolean {
  return type in ARTIFACT_SCAFFOLDS;
}
