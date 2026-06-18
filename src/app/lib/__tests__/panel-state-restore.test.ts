import {
  enrichPanelDocumentFromArtifacts,
  filterComponentEntriesFromPanel,
} from '@/app/lib/panel-state-restore';
import type { PanelActiveContent } from '@/app/lib/panel-state';

describe('panel-state-restore', () => {
  describe('enrichPanelDocumentFromArtifacts', () => {
    it('merges head artifact content when artifactId matches', () => {
      const doc: PanelActiveContent = {
        kind: 'document',
        id: 'slide-1',
        name: 'Stale',
        content: 'old',
        artifactId: 'a1',
      };
      const arts = [{ id: 'a1', name: 'Fresh title', content: 'new body', type: 'markdown', createdAt: '', updatedAt: '' }];
      const out = enrichPanelDocumentFromArtifacts(doc, arts);
      expect(out?.kind).toBe('document');
      if (out?.kind === 'document') {
        expect(out.content).toBe('new body');
        expect(out.name).toBe('Fresh title');
      }
    });

    it('passes through diagrams unchanged', () => {
      const d: PanelActiveContent = {
        kind: 'diagram',
        id: 'd1',
        name: 'Fig',
        diagram: 'graph LR',
      };
      expect(enrichPanelDocumentFromArtifacts(d, [])).toEqual(d);
    });
  });

  describe('filterComponentEntriesFromPanel', () => {
    it('drops components and invokes onSkip', () => {
      const items: PanelActiveContent[] = [
        { kind: 'document', id: '1', name: 'A', content: '' },
        { kind: 'component', id: 'c1', componentId: 'comp' },
      ];
      const skipped: string[] = [];
      const out = filterComponentEntriesFromPanel(items, (c) => skipped.push(c.componentId));
      expect(out).toHaveLength(1);
      expect(out[0].kind).toBe('document');
      expect(skipped).toEqual(['comp']);
    });
  });
});
