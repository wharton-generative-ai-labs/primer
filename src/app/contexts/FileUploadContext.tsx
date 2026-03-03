import React, { createContext, useContext, useState, useCallback } from 'react';

interface FileUploadState {
  isVisible: boolean;
  prompt?: string;
  functionCallId?: string;
}

interface FileUploadContextType {
  isFileUploadVisible: boolean;
  fileUploadPrompt?: string;
  functionCallId?: string;
  showFileUpload: (prompt?: string, callId?: string) => void;
  hideFileUpload: () => void;
}

// Create a default context value
const defaultContextValue: FileUploadContextType = {
  isFileUploadVisible: false,
  fileUploadPrompt: undefined,
  functionCallId: undefined,
  showFileUpload: () => {},
  hideFileUpload: () => {},
};

const FileUploadContext = createContext<FileUploadContextType>(defaultContextValue);

export function FileUploadProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FileUploadState>({
    isVisible: false,
    prompt: undefined,
    functionCallId: undefined
  });

  // Don't call useClientEvent here - it will be used directly in the FileUpload component

  const showFileUpload = useCallback((prompt?: string, callId?: string) => {
    setState({ isVisible: true, prompt, functionCallId: callId });
  }, [state]);

  const hideFileUpload = useCallback(() => {
    setState({ isVisible: false, prompt: undefined, functionCallId: undefined });
  }, [state]);

  return (
    <FileUploadContext.Provider
      value={{
        isFileUploadVisible: state.isVisible,
        fileUploadPrompt: state.prompt,
        functionCallId: state.functionCallId,
        showFileUpload,
        hideFileUpload
      }}
    >
      {children}
    </FileUploadContext.Provider>
  );
}

export function useFileUpload() {
  return useContext(FileUploadContext);
} 