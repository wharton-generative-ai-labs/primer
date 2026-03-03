import { ToolResponse } from '@/app/lib/tools/types';

export interface MermaidToolContext {
  showMermaidDiagram: (title: string, diagram: string) => { result: boolean };
  hideDiagram: () => { result: boolean };
}

export interface MermaidManager {
  showMermaidDiagram: (title: string, diagram: string) => { result: boolean };
  hideDiagram: () => { result: boolean };
}

export interface MermaidToolResponse extends ToolResponse {
  data: {
    result?: boolean;
    error?: string;
  };
}

