import { ARTIFACT_SCAFFOLDS, getScaffold, isScaffoldedType } from '../artifact-scaffolds';

describe('artifact scaffolds', () => {
  it('lists every known type', () => {
    expect(Object.keys(ARTIFACT_SCAFFOLDS).sort()).toEqual([
      'checklist',
      'design-document',
      'feedback-debrief',
      'journal',
      'process-notes',
      'transcript',
    ]);
  });

  it('substitutes the name placeholder', () => {
    const out = getScaffold('journal', 'Intake Journal');
    expect(out).toContain('# Intake Journal');
    expect(out).not.toContain('{{name}}');
  });

  it('returns null for unknown types', () => {
    expect(getScaffold('unknown-type', 'Something')).toBeNull();
  });

  it('isScaffoldedType matches the table', () => {
    expect(isScaffoldedType('journal')).toBe(true);
    expect(isScaffoldedType('unknown')).toBe(false);
  });

  it('every non-checklist scaffold contains at least one ## section header', () => {
    for (const type of Object.keys(ARTIFACT_SCAFFOLDS)) {
      if (type === 'checklist') continue;
      const out = getScaffold(type, 'Test')!;
      expect(out).toMatch(/\n## /);
    }
  });

  it('checklist scaffold contains markdown checkboxes (artifact-tool requires "- [ ]" for type=checklist)', () => {
    const out = getScaffold('checklist', 'Tasks')!;
    expect(out).toContain('- [ ]');
  });

  it('substitutes every {{name}} occurrence (not just the first)', () => {
    // Synthetic check: pass a scaffold-like template that has multiple
    // placeholders. Since ARTIFACT_SCAFFOLDS only uses {{name}} once at the
    // top, this guards against future scaffolds that mention the name multiple
    // times — getScaffold uses a global regex.
    const customMap = ARTIFACT_SCAFFOLDS as Record<string, string>;
    const original = customMap.journal;
    const dual = '# {{name}}\n\n## {{name}} continued';
    customMap.journal = dual;
    try {
      const out = getScaffold('journal', 'Repeat')!;
      expect(out).toBe('# Repeat\n\n## Repeat continued');
    } finally {
      customMap.journal = original;
    }
  });
});
