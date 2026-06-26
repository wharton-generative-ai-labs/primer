import { useArtifact, Artifact as ArtifactType } from '@/app/contexts/ArtifactContext';
import { CodeMirrorWrapper } from '@/components/CodeMirrorWrapper';
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";

interface ArtifactProps {
  artifactId?: string;
  isVisible?: boolean;
  onClose?: () => void;
}

export function Artifact({ artifactId, isVisible = false, onClose }: ArtifactProps) {
  const {
    getArtifact,
    updateArtifact,
    isLoading: contextLoading,
    error: contextError
  } = useArtifact();

  const [currentArtifact, setCurrentArtifact] = useState<ArtifactType | null>(null);
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (artifactId && isVisible) {
      setIsLoading(true);
      getArtifact(artifactId)
        .then(artifact => {
          setCurrentArtifact(artifact);
          setContent(artifact?.content || '');
        })
        .catch(() => {
          // Silently fail - error state is already handled
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [artifactId, isVisible, getArtifact]);

  const handleSave = async () => {
    if (!currentArtifact) return;
    
    setIsSaving(true);
    setSaveError(null);
    
    try {
      await updateArtifact(currentArtifact.id, content);
      onClose?.();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save artifact');
    } finally {
      setIsSaving(false);
    }
  };


  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="rounded-lg shadow-2xl w-11/12 max-w-6xl max-h-[90vh] flex flex-col bg-black/50 backdrop-blur-lg">
        <div className="flex justify-between items-center p-4 border-b border-white/10">
          <div>
            <h2 className="text-xl font-semibold text-white">
              {currentArtifact?.name || 'Document'}
            </h2>
            {currentArtifact?.type && (
              <span className="text-sm text-white/70 ml-2">({currentArtifact.type})</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSave}
              disabled={isLoading || isSaving}
              variant="custom"
              size="sm"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
            <Button
              onClick={onClose}
              variant="custom"
              size="sm"
            >
              Close
            </Button>
          </div>
        </div>
        
        {contextError && (
          <div className="p-3 bg-franklin-red/10 text-franklin-red backdrop-blur-sm">
            {contextError}
          </div>
        )}
        
        {saveError && (
          <div className="p-3 bg-franklin-red/10 text-franklin-red backdrop-blur-sm">
            {saveError}
          </div>
        )}
        
        <div className="flex-grow h-[calc(90vh-6rem)] overflow-hidden">
          {isLoading || contextLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/30"></div>
            </div>
          ) : currentArtifact ? (
            <CodeMirrorWrapper
              value={content}
              path={currentArtifact.name || 'document.md'}
              onChange={(value) => setContent(value)}
              height="100%"
              options={{
                scrollBeyondLastLine: false,
                minimap: { enabled: false },
                wordWrap: 'on',
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-white/70">
              No artifact selected
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 