import { parseChecklistItems } from '../parseChecklist';

describe('parseChecklistItems', () => {
    it('parses a simple list with mixed checked / unchecked items', () => {
        const md = `# Build Progress

- [ ] Initiating build
- [x] Creating character prompts
- [ ] Generating visual assets
`;
        expect(parseChecklistItems(md)).toEqual([
            { text: 'Initiating build', done: false },
            { text: 'Creating character prompts', done: true },
            { text: 'Generating visual assets', done: false },
        ]);
    });

    it('treats uppercase X as checked', () => {
        const md = '- [X] Already done';
        expect(parseChecklistItems(md)).toEqual([
            { text: 'Already done', done: true },
        ]);
    });

    it('ignores non-list lines (headings, prose, blank lines)', () => {
        const md = `## Heading

Some prose explaining the section.

- [ ] One

Another paragraph.

- [x] Two
`;
        expect(parseChecklistItems(md)).toEqual([
            { text: 'One', done: false },
            { text: 'Two', done: true },
        ]);
    });

    it('accepts both -[] and *[] bullet styles with leading whitespace', () => {
        const md = `  - [ ] One
  * [x] Two
`;
        expect(parseChecklistItems(md)).toEqual([
            { text: 'One', done: false },
            { text: 'Two', done: true },
        ]);
    });

    it('returns an empty list when content has no checklist items', () => {
        expect(parseChecklistItems('just plain text')).toEqual([]);
    });
});
