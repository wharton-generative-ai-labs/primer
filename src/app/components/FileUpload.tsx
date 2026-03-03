import { useFileUpload } from '@/app/contexts/FileUploadContext';
import { useClientEvent } from '@/app/contexts/ClientEventContext';
import { useExperienceUrl } from '@/app/hooks/useExperienceUrl';
import { getExistingSessionId } from '@/app/lib/session-utils';
import { useState } from 'react';
import { Button } from "@/components/ui/button";

export interface FileUploadResponse {
  success: boolean;
  fileInfoUrl: string;
  uploadId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

export interface FileUploadError {
  error: string;
}

interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
}

interface UploadResult {
  responses: FileUploadResponse[];
  errors: string[];
}

export async function uploadFiles(
  files: File[],
  experienceId: string,
  onProgress?: (fileName: string, progress: number) => void
): Promise<UploadResult> {
  const responses: FileUploadResponse[] = [];
  const errors: string[] = [];

  // Check for active session
  const sessionId = getExistingSessionId();
  if (!sessionId) {
    return { 
      responses: [], 
      errors: ['No active session. File uploads require an active experience session.'] 
    };
  }

  for (const file of files) {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();
      await new Promise<void>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable && onProgress) {
            const progress = (event.loaded / event.total) * 100;
            onProgress(file.name, progress);
          }
        });

        xhr.addEventListener('load', async () => {
          if (xhr.status === 200) {
            try {
              const data = JSON.parse(xhr.responseText);
              if (!data.success) {
                reject(new Error(data.error || 'Upload failed'));
                return;
              }
              responses.push(data as FileUploadResponse);
              resolve();
            } catch (_error) {
              reject(new Error('Invalid response from server'));
            }
          } else {
            reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error occurred'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload aborted'));
        });

        xhr.open('POST', '/api/user-upload');
        xhr.setRequestHeader('x-experience-id', experienceId);
        xhr.setRequestHeader('x-session-id', sessionId);
        xhr.send(formData);
      });
    } catch (error) {
      errors.push(`Failed to upload ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return { responses, errors };
}

export function FileUpload() {
  const { isFileUploadVisible, fileUploadPrompt, hideFileUpload, functionCallId } = useFileUpload();
  const { sendClientEvent } = useClientEvent();
  const { getExperienceId } = useExperienceUrl();
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleProgress = (fileName: string, progress: number) => {
    setUploadProgress(prev => {
      const fileIndex = prev.findIndex(p => p.fileName === fileName);
      if (fileIndex === -1) {
        return [...prev, { fileName, progress, status: 'uploading' }];
      }
      const newProgress = [...prev];
      newProgress[fileIndex] = { ...newProgress[fileIndex], progress, status: 'uploading' };
      return newProgress;
    });
  };

  const getOverallProgress = () => {
    if (uploadProgress.length === 0) return 0;
    const total = uploadProgress.reduce((sum, file) => sum + file.progress, 0);
    return total / uploadProgress.length;
  };

  if (!isFileUploadVisible) {
    return null;
  }

  const experienceId = getExperienceId();
  if (!experienceId) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-black/30 backdrop-blur-lg p-6 rounded-lg shadow-2xl max-w-lg w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">Upload Files</h2>
          <Button
            onClick={hideFileUpload}
            disabled={isUploading}
            variant="custom"
            size="sm"
          >
            Close
          </Button>
        </div>
        
        {fileUploadPrompt && (
          <p className="mb-4 text-white/90">{fileUploadPrompt}</p>
        )}

        <div className="border-2 border-dashed border-white/10 rounded-lg p-8 text-center">
          <input
            type="file"
            multiple
            className="hidden"
            id="file-upload"
            disabled={isUploading}
            onChange={async (e) => {
              const files = Array.from(e.target.files || []);
              if (files.length > 0) {
                setIsUploading(true);
                setUploadProgress(files.map(file => ({
                  fileName: file.name,
                  progress: 0,
                  status: 'pending'
                })));

                try {
                  const { responses, errors } = await uploadFiles(files, experienceId, handleProgress);
                  
                  // Update progress for successful uploads
                  setUploadProgress(prev => 
                    prev.map(p => {
                      const wasSuccessful = responses.some(r => r.fileName === p.fileName);
                      const error = errors.find(e => e.includes(p.fileName));
                      return {
                        ...p,
                        status: error ? 'error' : wasSuccessful ? 'complete' : p.status,
                        progress: wasSuccessful ? 100 : p.progress,
                        error: error
                      };
                    })
                  );

                  // Send function call output event
                  if (responses.length > 0) {
                    sendClientEvent({
                      type: "conversation.item.create",
                      item: {
                        type: "function_call_output",
                        call_id: functionCallId,
                        output: JSON.stringify(responses)
                      }
                    });
                    sendClientEvent({ type: "response.create" }, "trigger response");
                  }

                  if (errors.length > 0) {
                    sendClientEvent({
                      type: "conversation.item.create",
                      item: {
                        type: "function_call_output",
                        call_id: functionCallId,
                        output: JSON.stringify({
                          error: errors.join('\n'),
                          status: 'error'
                        })
                      }
                    });
                  }
                  
                  // Only auto-close if all uploads were successful
                  if (errors.length === 0) {
                    setTimeout(hideFileUpload, 1000);
                  }
                } catch (error) {
                  // Handle any unexpected errors
                  setUploadProgress(prev => 
                    prev.map(p => ({
                      ...p,
                      status: 'error',
                      error: 'An unexpected error occurred'
                    }))
                  );
                  
                  sendClientEvent({
                    type: "conversation.item.create",
                    item: {
                      type: "function_call_output",
                      call_id: functionCallId,
                      output: JSON.stringify({
                        error: error instanceof Error ? error.message : 'An unexpected error occurred',
                        status: 'error'
                      })
                    }
                  });
                } finally {
                  setIsUploading(false);
                }
              }
            }}
          />
          <Button
            variant="custom"
            size="sm"
            className={`${isUploading ? 'pointer-events-none opacity-50' : ''}`}
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <div className="flex flex-col items-center">
              <span>Click to select files</span>
              
            </div>
          </Button>
          <div className="mt-2 text-xs text-white/70">or drag and drop multiple files</div>

          {uploadProgress.length > 0 && (
            <div className="mt-4 space-y-2">
              {/* Overall progress */}
              <div className="mb-4">
                <div className="flex justify-between text-sm text-white/90 mb-1">
                  <span>Overall Progress</span>
                  <span>{Math.round(getOverallProgress())}%</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2.5">
                  <div
                    className="bg-bay-blue h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${getOverallProgress()}%` }}
                  />
                </div>
              </div>

              {/* Individual file progress */}
              {uploadProgress.map((progress) => (
                <div key={progress.fileName} className="text-left">
                  <div className="flex justify-between text-sm text-white/90 mb-1">
                    <span className="truncate max-w-[200px]">{progress.fileName}</span>
                    <span className="ml-2">
                      {progress.status === 'error' ? (
                        <span className="text-franklin-red">Failed</span>
                      ) : (
                        `${Math.round(progress.progress)}%`
                      )}
                    </span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        progress.status === 'error' 
                          ? 'bg-franklin-red' 
                          : progress.status === 'complete'
                            ? 'bg-impact-purple'
                            : 'bg-bay-blue'
                      }`}
                      style={{ width: `${progress.progress}%` }}
                    />
                  </div>
                  {progress.error && (
                    <p className="text-xs text-franklin-red mt-1">{progress.error}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 