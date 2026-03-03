// src/components/CodeMirrorWrapper.tsx
// A wrapper component for CodeMirror 6 editor

import React, { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { oneDark } from '@codemirror/theme-one-dark';
import { markdown } from '@codemirror/lang-markdown';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';

interface CodeMirrorWrapperProps {
    value: string;
    path: string;
    onChange: (value: string) => void;
    height?: string;
    options?: {
        scrollBeyondLastLine?: boolean;
        minimap?: { enabled: boolean };
        wordWrap?: string;
        fontSize?: number;
        [key: string]: any;
    };
    className?: string;
}

// Get language extension based on file path
function getLanguageExtension(path: string) {
    const extension = path.split('.').pop()?.toLowerCase() || '';
    
    const extensionMap: Record<string, any> = {
        'md': markdown(),
        'markdown': markdown(),
        'js': javascript(),
        'javascript': javascript(),
        'jsx': javascript({ jsx: true }),
        'ts': javascript({ typescript: true }),
        'typescript': javascript({ typescript: true }),
        'tsx': javascript({ typescript: true, jsx: true }),
        'py': python(),
        'python': python(),
        'html': html(),
        'css': css(),
        'json': json(),
    };
    
    return extensionMap[extension] || [];
}

export const CodeMirrorWrapper: React.FC<CodeMirrorWrapperProps> = ({
    value,
    path,
    onChange,
    height = '100%',
    options = {},
    className = '',
}) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);

    // Update onChange ref when it changes
    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    // Initialize editor
    useEffect(() => {
        if (!editorRef.current) return;

        const languageExtension = getLanguageExtension(path);

        const state = EditorState.create({
            doc: value,
            extensions: [
                lineNumbers(),
                history(),
                keymap.of([...defaultKeymap, ...historyKeymap]),
                oneDark,
                EditorView.lineWrapping, // Enable word wrap
                languageExtension,
                EditorView.updateListener.of((update) => {
                    if (update.docChanged) {
                        const newValue = update.state.doc.toString();
                        onChangeRef.current(newValue);
                    }
                }),
                // Custom styling to match dark theme
                EditorView.theme({
                    '&': {
                        height: '100%',
                        fontSize: options.fontSize ? `${options.fontSize}px` : '16px',
                    },
                    '.cm-scroller': {
                        overflow: 'auto',
                        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                    },
                    '.cm-content': {
                        padding: '8px 0',
                    },
                }),
            ],
        });

        const view = new EditorView({
            state,
            parent: editorRef.current,
        });

        viewRef.current = view;

        return () => {
            view.destroy();
            viewRef.current = null;
        };
    }, [path]); // Recreate editor when path changes

    // Update content when value prop changes (but not from user input)
    useEffect(() => {
        if (viewRef.current) {
            const currentValue = viewRef.current.state.doc.toString();
            if (currentValue !== value) {
                viewRef.current.dispatch({
                    changes: {
                        from: 0,
                        to: currentValue.length,
                        insert: value,
                    },
                });
            }
        }
    }, [value]);

    return (
        <div 
            ref={editorRef} 
            className={className}
            style={{ 
                height: height,
                width: '100%',
                overflow: 'hidden',
            }}
        />
    );
};

export default CodeMirrorWrapper;

