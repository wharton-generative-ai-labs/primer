// src/components/CodeMirrorWrapper.tsx
// A wrapper component for CodeMirror 6 editor

import React, { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { oneDark } from '@codemirror/theme-one-dark';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { markdown } from '@codemirror/lang-markdown';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { useTheme } from 'next-themes';

// Light theme — GitHub-inspired palette
const oneLight = EditorView.theme({
    '&': { backgroundColor: '#ffffff', color: '#24292e' },
    '.cm-content': { caretColor: '#24292e' },
    '.cm-cursor': { borderLeftColor: '#24292e' },
    '.cm-gutters': {
        backgroundColor: '#f6f8fa',
        color: '#6e7781',
        border: 'none',
        borderRight: '1px solid #d0d7de',
    },
    '.cm-activeLineGutter': { backgroundColor: '#eaf1fb' },
    '.cm-activeLine': { backgroundColor: '#eaf1fb' },
    '.cm-selectionBackground, ::selection': { backgroundColor: '#b6d5f7 !important' },
    '.cm-focused .cm-selectionBackground': { backgroundColor: '#b6d5f7' },
    '.cm-line': { padding: '0 2px 0 6px' },
}, { dark: false });

const oneLightHighlightStyle = HighlightStyle.define([
    { tag: tags.keyword,             color: '#d73a49' },
    { tag: tags.operator,            color: '#d73a49' },
    { tag: tags.operatorKeyword,     color: '#d73a49' },
    { tag: tags.controlKeyword,      color: '#d73a49' },
    { tag: tags.definitionKeyword,   color: '#d73a49' },
    { tag: tags.moduleKeyword,       color: '#d73a49' },
    { tag: tags.comment,             color: '#6a737d', fontStyle: 'italic' },
    { tag: tags.string,              color: '#032f62' },
    { tag: tags.special(tags.string),color: '#032f62' },
    { tag: tags.number,              color: '#005cc5' },
    { tag: tags.bool,                color: '#005cc5' },
    { tag: tags.null,                color: '#005cc5' },
    { tag: tags.variableName,        color: '#24292e' },
    { tag: tags.definition(tags.variableName), color: '#6f42c1' },
    { tag: tags.function(tags.variableName),   color: '#6f42c1' },
    { tag: tags.definition(tags.propertyName), color: '#6f42c1' },
    { tag: tags.typeName,            color: '#e36209' },
    { tag: tags.className,           color: '#e36209' },
    { tag: tags.propertyName,        color: '#005cc5' },
    { tag: tags.attributeName,       color: '#6f42c1' },
    { tag: tags.tagName,             color: '#22863a' },
    { tag: tags.angleBracket,        color: '#24292e' },
    { tag: tags.punctuation,         color: '#24292e' },
    { tag: tags.bracket,             color: '#24292e' },
    { tag: tags.heading,             color: '#005cc5', fontWeight: 'bold' },
    { tag: tags.link,                color: '#032f62', textDecoration: 'underline' },
    { tag: tags.emphasis,            fontStyle: 'italic' },
    { tag: tags.strong,              fontWeight: 'bold' },
    { tag: tags.strikethrough,       textDecoration: 'line-through' },
    { tag: tags.meta,                color: '#6a737d' },
    { tag: tags.regexp,              color: '#032f62' },
]);

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
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';

    // Update onChange ref when it changes
    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    // Initialize editor — recreate when path or theme changes
    useEffect(() => {
        if (!editorRef.current) return;

        const languageExtension = getLanguageExtension(path);

        const state = EditorState.create({
            doc: value,
            extensions: [
                lineNumbers(),
                history(),
                keymap.of([...defaultKeymap, ...historyKeymap]),
                ...(isDark ? [oneDark] : [oneLight, syntaxHighlighting(oneLightHighlightStyle)]),
                EditorView.lineWrapping,
                languageExtension,
                EditorView.updateListener.of((update) => {
                    if (update.docChanged) {
                        const newValue = update.state.doc.toString();
                        onChangeRef.current(newValue);
                    }
                }),
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
    }, [path, isDark]); // Recreate editor when path or theme changes

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

