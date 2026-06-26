/**
 * Main editor pane component for displaying and editing file content
 */

import React, { useState } from 'react';
import { Save, AlertTriangle, FileSearch, Code } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { CodeMirrorWrapper } from '@/components/CodeMirrorWrapper';
import { ConfigInspectorPanel } from '../../ConfigInspectorPanel';
import { SaveStatus } from '../types';

interface EditorPaneProps {
  experienceId: string;
  selectedPath: string;
  content: string;
  loading: boolean;
  saveStatus: SaveStatus;
  error: string | null;
  hasUnsavedChanges: boolean;
  contentType: string;
  fileUrl: string;
  isText: boolean;
  fileTree: unknown[];
  onContentChange: (value: string) => void;
  onSave: () => void;
  onErrorDismiss: () => void;
  onReloadFile: () => void;
}

type ViewMode = 'code' | 'inspect';

export function EditorPane({
  experienceId,
  selectedPath,
  content,
  loading,
  saveStatus,
  error,
  hasUnsavedChanges,
  contentType,
  fileUrl,
  isText,
  fileTree,
  onContentChange,
  onSave,
  onErrorDismiss,
  onReloadFile
}: EditorPaneProps) {
  const isExperienceJson = selectedPath.endsWith('experience.json');
  const [viewMode, setViewMode] = useState<ViewMode>('code');

  const handleUpgradeComplete = () => {
    // Switch back to code view and reload the file
    setViewMode('code');
    onReloadFile();
  };
  if (!selectedPath) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-muted/20">
        {error ? (
          <div className="max-w-md p-4 bg-franklin-red/10 border border-franklin-red/20 rounded-lg text-center">
            <AlertTriangle size={24} className="mx-auto mb-2 text-franklin-red" />
            <h3 className="text-lg font-medium text-foreground mb-2">Error Loading Resources</h3>
            <div className="text-foreground/90 whitespace-pre-wrap break-words">
              {error}
            </div>
            <Button 
              onClick={onErrorDismiss}
              variant="customDestructive"
              size="sm"
            >
              Dismiss
            </Button>
          </div>
        ) : (
          fileTree.length > 0 ? (
            <p className="text-muted-foreground italic">Select a file to edit</p>
          ) : (
            <div className="text-center">
              <p className="text-muted-foreground mb-2">Loading resources...</p>
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-muted-foreground/30 mx-auto"></div>
            </div>
          )
        )}
      </div>
    );
  }

  return (
    <>
      <div className="border-b border-border px-4 py-3 flex justify-between items-center bg-muted/30">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground truncate">{selectedPath}</h3>
          {error && (
            <div className="flex items-center text-franklin-red text-sm mt-1">
              <AlertTriangle size={16} className="mr-1" />
              {error}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 ml-4">
          {isExperienceJson && (
            <>
              <Button
                onClick={() => setViewMode('code')}
                variant={viewMode === 'code' ? 'customOutlineActive' : 'customOutline'}
                size="sm"
              >
                <Code className="size-5" />
                Code
              </Button>
              <Button
                onClick={() => setViewMode('inspect')}
                variant={viewMode === 'inspect' ? 'customOutlineActive' : 'customOutline'}
                size="sm"
              >
                <FileSearch className="size-5" />
                Inspect
              </Button>
            </>
          )}
          {isText && (
            <Button
              onClick={onSave}
              disabled={viewMode === 'inspect' || !hasUnsavedChanges || saveStatus === 'saving'}
              variant={saveStatus === 'saved' ? 'customGreen' : saveStatus === 'error' ? 'customDestructive' : 'custom'}
              size="sm"
            >
              <Save className="size-5" />
              {saveStatus === 'saving' ? 'Saving...' :
                saveStatus === 'saved' ? 'Saved!' :
                  saveStatus === 'error' ? 'Error' :
                    'Save'}
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 flex flex-col overflow-auto">
        {isExperienceJson && viewMode === 'inspect' ? (
          <ConfigInspectorPanel 
            configContent={content}
            experienceId={experienceId}
            onClose={() => setViewMode('code')}
            onUpgradeComplete={handleUpgradeComplete}
          />
        ) : loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-foreground">Loading...</div>
          </div>
        ) : isText ? (
          <CodeMirrorWrapper
            value={content}
            path={selectedPath}
            onChange={onContentChange}
            height="100%"
            options={{
              scrollBeyondLastLine: false,
              minimap: { enabled: false },
              wordWrap: 'on',
              fontSize: 16,
            }}
            className="z-[100]"
          />
        ) : contentType.startsWith('image/') ? (
          <div className="flex items-center justify-center h-full p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={fileUrl} 
              alt={selectedPath}
              className="max-w-full max-h-full object-contain"
              style={{ width: 'auto', height: 'auto' }}
            />
          </div>
        ) : contentType.startsWith('audio/') || selectedPath.endsWith('.mp3') ? (
          <div className="flex items-center justify-center h-full p-4">
            <div className="w-full max-w-md p-4 bg-muted/50 rounded-lg">
              <audio 
                controls 
                className="w-full"
                src={fileUrl}
              >
                Your browser does not support the audio element.
              </audio>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full p-4">
            <div className="text-center">
              <p className="text-muted-foreground mb-2">This file type cannot be displayed in the editor</p>
              <a 
                href={fileUrl}
                download
                className="text-cobalt hover:underline"
              >
                Download File
              </a>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

