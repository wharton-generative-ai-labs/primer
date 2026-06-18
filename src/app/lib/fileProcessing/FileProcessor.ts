import sharp from 'sharp';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { StorageService } from '../storage/StorageService';

interface FileAnalysis {
  type: string;
  content?: string;
  metadata: {
    size: number;
    format?: string;
    width?: number;
    height?: number;
    pages?: number;
    [key: string]: any;
  };
}

export class FileProcessor {
  constructor(private storage: StorageService) {}

  async processFile(filePath: string): Promise<FileAnalysis> {
    const buffer = await this.storage.readFile(filePath);
    const contentType = this.getContentType(filePath);
    
    switch (contentType.split('/')[0]) {
      case 'image':
        return this.processImage(buffer);
      case 'application':
        if (contentType === 'application/pdf') {
          return this.processPDF(buffer);
        } else if (
          contentType === 'application/msword' ||
          contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ) {
          return this.processWord(buffer);
        }
        break;
      case 'text':
        return this.processText(buffer);
    }

    throw new Error(`Unsupported file type: ${contentType}`);
  }

  private async processImage(buffer: Buffer): Promise<FileAnalysis> {
    const image = sharp(buffer);
    const metadata = await image.metadata();

    return {
      type: 'image',
      metadata: {
        size: buffer.length,
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        channels: metadata.channels,
        space: metadata.space
      }
    };
  }

  private async processPDF(buffer: Buffer): Promise<FileAnalysis> {
    const data = await pdfParse(buffer);

    return {
      type: 'pdf',
      content: data.text,
      metadata: {
        size: buffer.length,
        pages: data.numpages,
        info: data.info
      }
    };
  }

  private async processWord(buffer: Buffer): Promise<FileAnalysis> {
    const result = await mammoth.extractRawText({ buffer });

    return {
      type: 'document',
      content: result.value,
      metadata: {
        size: buffer.length
      }
    };
  }

  private async processText(buffer: Buffer): Promise<FileAnalysis> {
    const content = buffer.toString('utf-8');

    return {
      type: 'text',
      content,
      metadata: {
        size: buffer.length,
        encoding: 'utf-8'
      }
    };
  }

  private getContentType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'txt': 'text/plain',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp'
    };

    return mimeTypes[ext || ''] || 'application/octet-stream';
  }
} 