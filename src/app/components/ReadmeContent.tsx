'use client';

import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('readme-content');

export interface ReadmeContentProps {
  experienceId: string;
  theme: 'light' | 'dark';
}

export function ReadmeContent({ experienceId, theme }: ReadmeContentProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchReadme() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/experiences/${experienceId}/readme`);
        if (!response.ok) {
          if (!cancelled) {
            setError(response.status === 404 ? 'No README found for this experience.' : 'Failed to load README.');
          }
          return;
        }
        const data = await response.json();
        if (!cancelled) {
          setContent(data.content ?? '');
        }
      } catch (err) {
        logger.error({ err, experienceId }, 'Failed to fetch README');
        if (!cancelled) {
          setError('Failed to load README.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    fetchReadme();
    return () => {
      cancelled = true;
    };
  }, [experienceId]);

  if (loading) {
    return <p className="text-muted-foreground py-4">Loading README…</p>;
  }

  if (error) {
    return <p className="text-destructive py-4">{error}</p>;
  }

  if (!content) {
    return null;
  }

  const isDark = theme === 'dark';
  const proseClass = isDark
    ? 'prose prose-invert prose-sm max-w-none'
    : 'prose prose-sm max-w-none text-slate-800';
  const headingClass = isDark ? 'text-white' : 'text-slate-900';
  const paragraphClass = isDark ? 'text-white/90' : 'text-slate-700';
  const listClass = isDark ? 'text-white/90' : 'text-slate-700';
  const inlineCodeClass = isDark
    ? 'bg-white/10 text-blue-300'
    : 'bg-slate-100 text-slate-800';
  const codeBlockClass = isDark
    ? 'bg-white/5 text-green-300'
    : 'bg-slate-100 text-slate-800';
  const preClass = isDark ? 'bg-white/5' : 'bg-slate-100';
  const linkClass = isDark
    ? 'text-blue-400 hover:text-blue-300 underline'
    : 'text-brand hover:text-penn-blue/80 underline';
  const hrClass = isDark ? 'border-white/20 my-6' : 'border-slate-200 my-6';
  const tableBorder = isDark ? 'border-white/20' : 'border-slate-200';
  const tableHeadBg = isDark ? 'bg-white/10' : 'bg-slate-100';
  const quoteClass = isDark
    ? 'border-l-4 border-blue-500 pl-4 italic text-white/80 my-3'
    : 'border-l-4 border-penn-blue pl-4 italic text-slate-600 my-3';

  return (
    <div className={proseClass}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, href, children, ...props }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass} {...props}>
              {children}
            </a>
          ),
          h1: ({ node: _node, ...props }) => (
            <h1 className={`text-3xl font-bold mt-6 mb-4 ${headingClass}`} {...props} />
          ),
          h2: ({ node: _node, ...props }) => (
            <h2 className={`text-2xl font-bold mt-5 mb-3 ${headingClass}`} {...props} />
          ),
          h3: ({ node: _node, ...props }) => (
            <h3 className={`text-xl font-bold mt-4 mb-2 ${headingClass}`} {...props} />
          ),
          p: ({ node: _node, ...props }) => (
            <p className={`mb-3 leading-relaxed ${paragraphClass}`} {...props} />
          ),
          ul: ({ node: _node, ...props }) => (
            <ul className={`list-disc list-inside mb-3 space-y-1 ${listClass}`} {...props} />
          ),
          ol: ({ node: _node, ...props }) => (
            <ol className={`list-decimal list-inside mb-3 space-y-1 ${listClass}`} {...props} />
          ),
          li: ({ node: _node, ...props }) => (
            <li className={`ml-4 ${listClass}`} {...props} />
          ),
          code: ({ node: _node, inline, ...props }: any) =>
            inline ? (
              <code className={`${inlineCodeClass} px-1.5 py-0.5 rounded text-sm font-mono`} {...props} />
            ) : (
              <code className={`block ${codeBlockClass} p-3 rounded text-sm font-mono overflow-x-auto`} {...props} />
            ),
          pre: ({ node: _node, ...props }) => (
            <pre className={`${preClass} p-3 rounded mb-3 overflow-x-auto`} {...props} />
          ),
          blockquote: ({ node: _node, ...props }) => (
            <blockquote className={quoteClass} {...props} />
          ),
          hr: ({ node: _node, ...props }) => <hr className={hrClass} {...props} />,
          table: ({ node: _node, ...props }) => (
            <div className="overflow-x-auto mb-3">
              <table className={`min-w-full border ${tableBorder}`} {...props} />
            </div>
          ),
          th: ({ node: _node, ...props }) => (
            <th className={`border ${tableBorder} ${tableHeadBg} px-3 py-2 text-left font-semibold`} {...props} />
          ),
          td: ({ node: _node, ...props }) => (
            <td className={`border ${tableBorder} px-3 py-2`} {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
