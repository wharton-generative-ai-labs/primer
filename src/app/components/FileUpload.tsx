import { useFileUpload } from '@/app/contexts/FileUploadContext';
import { useClientEvent } from '@/app/contexts/ClientEventContext';
import { useExperienceUrl } from '@/app/hooks/useExperienceUrl';
import { getExistingSessionId } from '@/app/lib/session-utils';
import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { SUPPORTED_UPLOAD_ACCEPT } from '@/config/constants';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface FileUploadResponse {
  success: boolean;
  fileInfoUrl: string;
  uploadId: string;
  fileName: string;
  /** The user's original filename, before sanitization/dedupe. Use this in
   *  user-facing copy so they recognize what they attached. */
  originalName: string;
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

  // Reset upload state every time the modal closes. Without this, reopening
  // shows stale per-file progress rows from the previous session. Covers all
  // close paths (X, Escape, outside click, auto-close after success).
  useEffect(() => {
    if (!isFileUploadVisible) {
      setUploadProgress([]);
      setIsUploading(false);
    }
  }, [isFileUploadVisible]);

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

  const experienceId = getExperienceId();
  if (!experienceId) {
    return null;
  }

  // Block dismissals (X button, Escape, outside click) while an upload is in
  // flight so the user can't accidentally cancel a partial upload.
  const handleOpenChange = (open: boolean) => {
    if (!open && !isUploading) {
      hideFileUpload();
    }
  };

  return (
    <Dialog open={isFileUploadVisible} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
          {fileUploadPrompt && (
            <DialogDescription>{fileUploadPrompt}</DialogDescription>
          )}
        </DialogHeader>

        <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
          <input
            type="file"
            multiple
            accept={SUPPORTED_UPLOAD_ACCEPT}
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

                  // When the agent triggered the upload (file.requestUpload),
                  // we have a functionCallId and must reply with a
                  // function_call_output so the tool call resolves. When the
                  // user clicked the paperclip themselves, there is no pending
                  // tool call — we instead inject a user message so the active
                  // agent sees the new files and can react in conversation.
                  // For the user-visible message we use the human-readable
                  // names (e.g. "History Class Plan.docx") and trust the agent
                  // to call file.listUploaded if it needs URLs.
                  if (responses.length > 0) {
                    if (functionCallId) {
                      sendClientEvent({
                        type: "conversation.item.create",
                        item: {
                          type: "function_call_output",
                          call_id: functionCallId,
                          output: JSON.stringify(responses)
                        }
                      });
                    } else {
                      const names = responses.map(r => `"${r.originalName ?? r.fileName}"`).join(', ');
                      sendClientEvent({
                        type: "conversation.item.create",
                        item: {
                          type: "message",
                          role: "user",
                          content: [
                            {
                              type: "input_text",
                              text: `Attached ${names} to the chat`
                            }
                          ]
                        }
                      });
                    }
                    sendClientEvent({ type: "response.create" }, "trigger response");
                  }

                  if (errors.length > 0 && functionCallId) {
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

                  // Only notify the agent when this upload was a tool-call
                  // response. User-initiated uploads have no pending call to
                  // resolve — the user already sees the error in the modal.
                  if (functionCallId) {
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
                  }
                } finally {
                  setIsUploading(false);
                }
              }
            }}
          />
          <Button
            type="button"
            variant="default"
            disabled={isUploading}
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            Click to select files
          </Button>
          <p className="mt-2 text-muted-foreground">or drag and drop multiple files</p>

          {uploadProgress.length > 0 && (
            <div className="mt-4 space-y-3 text-left">
              {uploadProgress.map((progress) => (
                <div key={progress.fileName}>
                  <div className="mb-1 flex justify-between gap-2 text-sm text-foreground">
                    <span className="truncate">{progress.fileName}</span>
                    <span className="shrink-0">
                      {progress.status === 'error' ? (
                        <span className="text-destructive">Failed</span>
                      ) : (
                        `${Math.round(progress.progress)}%`
                      )}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-primary/20">
                    <div
                      className={cn(
                        'h-full transition-all',
                        progress.status === 'error' ? 'bg-destructive' : 'bg-primary'
                      )}
                      style={{ width: `${progress.progress}%` }}
                    />
                  </div>
                  {progress.error && (
                    <p className="mt-1 text-xs text-destructive">{progress.error}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 