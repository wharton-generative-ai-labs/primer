/**
 * Tests for artifact utility functions
 */

import {
  normalizeContentType,
  getFileExtensionForType,
  getMimeTypeForType,
  isBinaryFileType,
  createSafeFilename
} from '../artifact-utils';

describe('artifact-utils', () => {
  describe('normalizeContentType', () => {
    it('should normalize MIME types to short forms', () => {
      expect(normalizeContentType('text/jsx')).toBe('jsx');
      expect(normalizeContentType('text/tsx')).toBe('tsx');
      expect(normalizeContentType('text/markdown')).toBe('markdown');
      expect(normalizeContentType('application/javascript')).toBe('javascript');
      expect(normalizeContentType('application/typescript')).toBe('typescript');
      expect(normalizeContentType('text/html')).toBe('html');
      expect(normalizeContentType('text/css')).toBe('css');
      expect(normalizeContentType('application/json')).toBe('json');
      expect(normalizeContentType('image/png')).toBe('png');
      expect(normalizeContentType('image/jpeg')).toBe('jpeg');
    });

    it('should handle short forms as-is', () => {
      expect(normalizeContentType('jsx')).toBe('jsx');
      expect(normalizeContentType('tsx')).toBe('tsx');
      expect(normalizeContentType('markdown')).toBe('markdown');
      expect(normalizeContentType('javascript')).toBe('javascript');
    });

    it('should handle case insensitivity', () => {
      expect(normalizeContentType('TEXT/JSX')).toBe('jsx');
      expect(normalizeContentType('Text/Jsx')).toBe('jsx');
      expect(normalizeContentType('JSX')).toBe('jsx');
    });

    it('should trim whitespace', () => {
      expect(normalizeContentType('  text/jsx  ')).toBe('jsx');
      expect(normalizeContentType('  jsx  ')).toBe('jsx');
    });
  });

  describe('getFileExtensionForType', () => {
    it('should return correct extensions for MIME types', () => {
      expect(getFileExtensionForType('text/jsx')).toBe('jsx');
      expect(getFileExtensionForType('text/tsx')).toBe('tsx');
      expect(getFileExtensionForType('text/markdown')).toBe('md');
      expect(getFileExtensionForType('application/javascript')).toBe('js');
      expect(getFileExtensionForType('application/typescript')).toBe('ts');
    });

    it('should return correct extensions for short forms', () => {
      expect(getFileExtensionForType('jsx')).toBe('jsx');
      expect(getFileExtensionForType('tsx')).toBe('tsx');
      expect(getFileExtensionForType('markdown')).toBe('md');
      expect(getFileExtensionForType('javascript')).toBe('js');
      expect(getFileExtensionForType('typescript')).toBe('ts');
    });

    it('should handle image types', () => {
      expect(getFileExtensionForType('image/png')).toBe('png');
      expect(getFileExtensionForType('png')).toBe('png');
      expect(getFileExtensionForType('image/jpeg')).toBe('jpg');
      expect(getFileExtensionForType('jpeg')).toBe('jpg');
    });

    it('should default to txt for unknown types', () => {
      expect(getFileExtensionForType('unknown')).toBe('txt');
      expect(getFileExtensionForType('application/unknown')).toBe('txt');
    });
  });

  describe('getMimeTypeForType', () => {
    it('should convert short forms to proper MIME types', () => {
      expect(getMimeTypeForType('jsx')).toBe('text/jsx');
      expect(getMimeTypeForType('tsx')).toBe('text/tsx');
      expect(getMimeTypeForType('markdown')).toBe('text/markdown');
      expect(getMimeTypeForType('javascript')).toBe('application/javascript');
      expect(getMimeTypeForType('typescript')).toBe('application/typescript');
    });

    it('should preserve valid MIME types', () => {
      expect(getMimeTypeForType('text/jsx')).toBe('text/jsx');
      expect(getMimeTypeForType('text/tsx')).toBe('text/tsx');
      expect(getMimeTypeForType('text/markdown')).toBe('text/markdown');
      expect(getMimeTypeForType('application/javascript')).toBe('application/javascript');
    });

    it('should handle image types', () => {
      expect(getMimeTypeForType('png')).toBe('image/png');
      expect(getMimeTypeForType('image/png')).toBe('image/png');
      expect(getMimeTypeForType('jpeg')).toBe('image/jpeg');
      expect(getMimeTypeForType('image/jpeg')).toBe('image/jpeg');
    });

    it('should default to text/plain for unknown types', () => {
      expect(getMimeTypeForType('unknown')).toBe('text/plain');
    });
  });

  describe('isBinaryFileType', () => {
    it('should identify binary types from short forms', () => {
      expect(isBinaryFileType('png')).toBe(true);
      expect(isBinaryFileType('jpg')).toBe(true);
      expect(isBinaryFileType('jpeg')).toBe(true);
      expect(isBinaryFileType('gif')).toBe(true);
      expect(isBinaryFileType('pdf')).toBe(true);
      expect(isBinaryFileType('zip')).toBe(true);
    });

    it('should identify binary types from MIME types', () => {
      expect(isBinaryFileType('image/png')).toBe(true);
      expect(isBinaryFileType('image/jpeg')).toBe(true);
      expect(isBinaryFileType('image/gif')).toBe(true);
      expect(isBinaryFileType('application/pdf')).toBe(true);
      expect(isBinaryFileType('application/zip')).toBe(true);
    });

    it('should identify text types as non-binary', () => {
      expect(isBinaryFileType('jsx')).toBe(false);
      expect(isBinaryFileType('text/jsx')).toBe(false);
      expect(isBinaryFileType('markdown')).toBe(false);
      expect(isBinaryFileType('text/markdown')).toBe(false);
      expect(isBinaryFileType('javascript')).toBe(false);
    });
  });

  describe('createSafeFilename', () => {
    it('should convert spaces to underscores', () => {
      expect(createSafeFilename('my file name')).toBe('my_file_name');
    });

    it('should remove special characters', () => {
      expect(createSafeFilename('my@file#name')).toBe('my_file_name');
    });

    it('should convert to lowercase', () => {
      expect(createSafeFilename('MyFileName')).toBe('myfilename');
    });

    it('should handle multiple underscores', () => {
      expect(createSafeFilename('my___file___name')).toBe('my_file_name');
    });

    it('should trim leading/trailing underscores', () => {
      expect(createSafeFilename('_my_file_name_')).toBe('my_file_name');
    });

    it('should limit length', () => {
      const longName = 'a'.repeat(150);
      const result = createSafeFilename(longName, 100);
      expect(result.length).toBe(100);
    });

    it('should use fallback for empty names', () => {
      expect(createSafeFilename('')).toBe('untitled');
      expect(createSafeFilename('___')).toBe('untitled');
    });
  });
});
