import { ToolResponse } from '@/app/lib/tools/types';

export interface Slide {
  title: string;
  content: string;
}

export interface SlideToolContext {
  showSlide(title: string, content: string): { result: boolean };
  showExistingSlide(title: string): { result: boolean };
  getSlideContent(title: string): { result: boolean; content: string };
  hideSlide(id: string): void;
  hideAllSlides(): void;
  listSlides(): { titles: string[]; count: number };
  listActiveSlides(): { ids: string[]; count: number };
}

export interface SlideToolResponse extends ToolResponse {
  data: {
    result?: boolean;
    error?: string;
  };
}

