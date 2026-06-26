'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  FC,
  PropsWithChildren,
} from 'react';
import { WorkspaceLayout } from '@/app/lib/types';

/**
 * Visibility state for the document section. The final workspace arrangement
 * is derived from document visibility alone — scene is now a background layer
 * orthogonal to layout (see PrimerBackground.tsx).
 *
 * The active-document / library state is intentionally *not* here — that lives
 * in `ArtifactContext` since those are artifacts proper. This context owns the
 * *view* of what's shown, not the content itself.
 */

export type DocumentTab = 'active' | 'notes' | 'library' | 'checklist';

export interface LayoutContextValue {
  isDocumentVisible: boolean;
  setDocumentVisible: (visible: boolean) => void;
  showDocument: () => void;
  hideDocument: () => void;
  getWorkspaceLayout: () => WorkspaceLayout;

  documentTab: DocumentTab;
  setDocumentTab: (tab: DocumentTab) => void;
}

const LayoutContext = createContext<LayoutContextValue | undefined>(undefined);

export const LayoutProvider: FC<PropsWithChildren> = ({ children }) => {
  const [isDocumentVisible, setDocumentVisible] = useState(false);
  const [documentTab, setDocumentTab] = useState<DocumentTab>('active');

  const showDocument = useCallback(() => setDocumentVisible(true), []);
  const hideDocument = useCallback(() => setDocumentVisible(false), []);

  const getWorkspaceLayout = useCallback((): WorkspaceLayout => {
    return isDocumentVisible ? 'document-only' : 'chat-only';
  }, [isDocumentVisible]);

  const setDocumentTabAndReveal = useCallback((tab: DocumentTab) => {
    setDocumentTab(tab);
    setDocumentVisible(true);
  }, []);

  const value = useMemo<LayoutContextValue>(
    () => ({
      isDocumentVisible,
      setDocumentVisible,
      showDocument,
      hideDocument,
      getWorkspaceLayout,
      documentTab,
      setDocumentTab: setDocumentTabAndReveal,
    }),
    [isDocumentVisible, showDocument, hideDocument, getWorkspaceLayout, documentTab, setDocumentTabAndReveal]
  );

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
};

export function useLayout(): LayoutContextValue {
  const ctx = useContext(LayoutContext);
  if (!ctx) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return ctx;
}
