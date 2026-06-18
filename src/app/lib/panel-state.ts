/**
 * Persisted document panel snapshot for session resume (`panel-state.json`).
 * Shapes mirror the runtime `ActiveContent` union used by ArtifactContext so
 * the right pane can be restored without a live agent round-trip.
 */

export type PanelActiveContent =
  | {
      kind: 'document';
      id: string;
      name: string;
      content: string;
      artifactId?: string;
      type?: string;
    }
  | {
      kind: 'diagram';
      id: string;
      name: string;
      diagram: string;
    }
  | {
      kind: 'component';
      id: string;
      componentId: string;
    };

export interface PanelStateRecord {
  activeContent: PanelActiveContent | null;
  library: PanelActiveContent[];
  viewedContentId: string | null;
  activeChecklistId: string | null;
  updatedAt: string;
}
