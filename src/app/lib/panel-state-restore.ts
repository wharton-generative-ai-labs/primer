import type { PanelActiveContent } from '@/app/lib/panel-state';

/** Minimal artifact head fields needed to refresh persisted doc panel bodies. */
export interface ArtifactHeadForPanel {
  id: string;
  name: string;
  content: string;
}

export function enrichPanelDocumentFromArtifacts(
  content: PanelActiveContent | null,
  artifactsSnapshot: ArtifactHeadForPanel[],
): PanelActiveContent | null {
  if (!content) return null;
  if (content.kind !== 'document') return content;
  if (!content.artifactId) return content;
  const art = artifactsSnapshot.find((a) => a.id === content.artifactId);
  if (!art) return content;
  return {
    ...content,
    content: art.content,
    name: art.name ?? content.name,
  };
}

export function filterComponentEntriesFromPanel(
  items: PanelActiveContent[],
  onSkip?: (item: PanelActiveContent & { kind: 'component' }) => void,
): PanelActiveContent[] {
  const out: PanelActiveContent[] = [];
  for (const item of items) {
    if (item.kind === 'component') {
      onSkip?.(item);
      continue;
    }
    out.push(item);
  }
  return out;
}
