import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('readme-dialog');

interface ReadmeDialogProps {
  experienceId: string;
  experienceTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReadmeDialog({
  experienceId,
  experienceTitle,
  open,
  onOpenChange,
}: ReadmeDialogProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentDocPath, setCurrentDocPath] = useState<string | null>(null);

  useEffect(() => {
    if (open && experienceId) {
      fetchReadme();
    }
  }, [open, experienceId]);

  const fetchReadme = async (docPath?: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const url = docPath 
        ? `/api/experiences/${experienceId}/readme?docPath=${encodeURIComponent(docPath)}`
        : `/api/experiences/${experienceId}/readme`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('No README found for this experience.');
        } else {
          setError('Failed to load README.');
        }
        return;
      }
      
      const data = await response.json();
      setContent(data.content);
      setCurrentDocPath(docPath || null);
    } catch (err) {
      logger.error({ err, experienceId, docPath }, 'Failed to fetch README');
      setError('Failed to load README.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] bg-black/95 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {currentDocPath ? `${experienceTitle} - ${currentDocPath}` : `${experienceTitle} - README`}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[60vh] pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-white/70">Loading...</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-red-400">{error}</p>
            </div>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ node: _node, href, children, ...props }) => {
                    const isRelativeMarkdown = href?.endsWith('.md') && 
                      !href.startsWith('http://') && 
                      !href.startsWith('https://');
                    
                    if (isRelativeMarkdown) {
                      return (
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (href) fetchReadme(href);
                          }}
                          className="text-blue-400 hover:text-blue-300 underline cursor-pointer"
                          {...props}
                        >
                          {children}
                        </a>
                      );
                    }
                    
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 underline"
                        {...props}
                      >
                        {children}
                      </a>
                    );
                  },
                  h1: ({ node: _node, ...props }) => (
                    <h1 className="text-3xl font-bold mt-6 mb-4 text-white" {...props} />
                  ),
                  h2: ({ node: _node, ...props }) => (
                    <h2 className="text-2xl font-bold mt-5 mb-3 text-white" {...props} />
                  ),
                  h3: ({ node: _node, ...props }) => (
                    <h3 className="text-xl font-bold mt-4 mb-2 text-white" {...props} />
                  ),
                  p: ({ node: _node, ...props }) => (
                    <p className="mb-3 text-white/90 leading-relaxed" {...props} />
                  ),
                  ul: ({ node: _node, ...props }) => (
                    <ul className="list-disc list-inside mb-3 text-white/90 space-y-1" {...props} />
                  ),
                  ol: ({ node: _node, ...props }) => (
                    <ol className="list-decimal list-inside mb-3 text-white/90 space-y-1" {...props} />
                  ),
                  li: ({ node: _node, ...props }) => (
                    <li className="ml-4 text-white/90" {...props} />
                  ),
                  code: ({ node: _node, inline, ...props }: any) => {
                    if (inline) {
                      return (
                        <code
                          className="bg-white/10 text-blue-300 px-1.5 py-0.5 rounded text-sm font-mono"
                          {...props}
                        />
                      );
                    }
                    return (
                      <code
                        className="block bg-white/5 text-green-300 p-3 rounded text-sm font-mono overflow-x-auto"
                        {...props}
                      />
                    );
                  },
                  pre: ({ node: _node, ...props }) => (
                    <pre className="bg-white/5 p-3 rounded mb-3 overflow-x-auto" {...props} />
                  ),
                  blockquote: ({ node: _node, ...props }) => (
                    <blockquote
                      className="border-l-4 border-blue-500 pl-4 italic text-white/80 my-3"
                      {...props}
                    />
                  ),
                  hr: ({ node: _node, ...props }) => (
                    <hr className="border-white/20 my-6" {...props} />
                  ),
                  table: ({ node: _node, ...props }) => (
                    <div className="overflow-x-auto mb-3">
                      <table className="min-w-full border border-white/20" {...props} />
                    </div>
                  ),
                  th: ({ node: _node, ...props }) => (
                    <th className="border border-white/20 px-3 py-2 bg-white/10 text-left font-semibold" {...props} />
                  ),
                  td: ({ node: _node, ...props }) => (
                    <td className="border border-white/20 px-3 py-2" {...props} />
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
        </ScrollArea>
        
        {currentDocPath && (
          <div className="mt-2 pt-2 border-t border-white/10">
            <button
              onClick={() => fetchReadme()}
              className="text-sm text-blue-400 hover:text-blue-300 underline"
            >
              ← Back to README
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
