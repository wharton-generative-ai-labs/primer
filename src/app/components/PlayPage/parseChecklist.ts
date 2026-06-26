/**
 * Parses a markdown checklist body (`- [ ] ...` / `- [x] ...`) into an
 * ordered list of items. Used by the build-phase surface to render a live
 * checklist sourced from a phase-public checklist artifact maintained by
 * the orchestrator agent.
 *
 * Lines that don't match the checklist pattern are ignored — authors can
 * include intro paragraphs, headings, or comments in the same artifact
 * without polluting the rendered list.
 */
export interface ChecklistItem {
    text: string;
    done: boolean;
}

const ITEM_RE = /^\s*[-*]\s*\[([ xX])\]\s*(.+?)\s*$/;

export function parseChecklistItems(content: string): ChecklistItem[] {
    const items: ChecklistItem[] = [];
    for (const line of content.split('\n')) {
        const match = ITEM_RE.exec(line);
        if (match) {
            items.push({ text: match[2], done: match[1].toLowerCase() === 'x' });
        }
    }
    return items;
}
