/**
 * @jest-environment node
 */
import JSZip from 'jszip';
import { detectWrapperFolder, extractZipToStorage, sanitizeZipEntryPath } from '../zip-utils';
import { StorageServiceFactory } from '@/app/lib/storage/StorageServiceFactory';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build an in-memory ZIP buffer from a map of path → content. */
async function buildZip(files: Record<string, string>): Promise<Buffer> {
  const zip = new JSZip();
  for (const [filePath, content] of Object.entries(files)) {
    zip.file(filePath, content);
  }
  const arrayBuffer = await zip.generateAsync({ type: 'arraybuffer' });
  return Buffer.from(arrayBuffer);
}

/** Minimal in-memory StorageService mock. */
function makeStorageMock() {
  const store = new Map<string, Buffer>();
  return {
    store,
    storeFile: jest.fn(async (p: string, buf: Buffer) => { store.set(p, buf); }),
    fileExists: jest.fn(async (p: string) => store.has(p)),
    getFileUrl: jest.fn((p: string) => `/mock/${p}`),
    deleteDirectory: jest.fn(async () => {}),
    // unused but required by the interface
    storeFileFromStream: jest.fn(),
    readFile: jest.fn(),
    readFileAsText: jest.fn(),
    deleteFile: jest.fn(),
    listFiles: jest.fn(async () => []),
    listDirectories: jest.fn(async () => []),
    getFileStats: jest.fn(async () => null),
    createDirectory: jest.fn(),
  };
}

// ---------------------------------------------------------------------------
// detectWrapperFolder
// ---------------------------------------------------------------------------

describe('detectWrapperFolder', () => {
  it('returns null for a flat ZIP (files at root)', () => {
    expect(detectWrapperFolder(['experience.json', 'assets/img.png'])).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(detectWrapperFolder([])).toBeNull();
  });

  it('returns null for a single root-level file', () => {
    expect(detectWrapperFolder(['experience.json'])).toBeNull();
  });

  it('detects a common wrapper folder', () => {
    const paths = [
      'my-experience/experience.json',
      'my-experience/assets/img.png',
      'my-experience/config/settings.json',
    ];
    expect(detectWrapperFolder(paths)).toBe('my-experience/');
  });

  it('detects a single-file wrapped ZIP', () => {
    expect(detectWrapperFolder(['wrapper/experience.json'])).toBe('wrapper/');
  });

  it('returns null when files are spread across multiple top-level folders', () => {
    const paths = ['folderA/experience.json', 'folderB/assets/img.png'];
    expect(detectWrapperFolder(paths)).toBeNull();
  });

  it('returns null when some files are at root and some are nested', () => {
    const paths = ['experience.json', 'my-experience/assets/img.png'];
    expect(detectWrapperFolder(paths)).toBeNull();
  });

  it('normalises Windows backslashes when detecting the wrapper', () => {
    const paths = ['wrapper\\experience.json', 'wrapper\\assets\\img.png'];
    expect(detectWrapperFolder(paths)).toBe('wrapper/');
  });

  it('ignores whitespace-only entries when determining the prefix', () => {
    // Whitespace entries are filtered out; the remaining entry is inside a wrapper
    expect(detectWrapperFolder(['   ', 'wrapper/experience.json'])).toBe('wrapper/');
  });
});

// ---------------------------------------------------------------------------
// extractZipToStorage – wrapper-folder detection (Hypothesis A)
// ---------------------------------------------------------------------------

describe('extractZipToStorage', () => {
  let storageMock: ReturnType<typeof makeStorageMock>;

  beforeEach(() => {
    storageMock = makeStorageMock();
    jest.spyOn(StorageServiceFactory, 'getInstance').mockReturnValue(storageMock as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('succeeds with a flat ZIP (experience.json at root)', async () => {
    const zip = await buildZip({
      'experience.json': JSON.stringify({ title: 'Test' }),
      'assets/img.png': 'fake-image',
    });

    const url = await extractZipToStorage(zip, { targetId: 'flat-test' });

    expect(url).toContain('experience.json');
    expect(storageMock.storeFile).toHaveBeenCalledWith(
      expect.stringContaining('experience.json'),
      expect.any(Buffer)
    );
  });

  it('succeeds with a macOS-style wrapped ZIP (all files under one folder)', async () => {
    const zip = await buildZip({
      'my-experience/experience.json': JSON.stringify({ title: 'Wrapped' }),
      'my-experience/assets/img.png': 'fake-image',
    });

    const url = await extractZipToStorage(zip, { targetId: 'wrapped-test' });

    expect(url).toContain('experience.json');
    // The wrapper folder should have been stripped; file stored at root level
    expect(storageMock.storeFile).toHaveBeenCalledWith(
      'wrapped-test/experience.json',
      expect.any(Buffer)
    );
    expect(storageMock.storeFile).toHaveBeenCalledWith(
      expect.stringContaining('assets/img.png'),
      expect.any(Buffer)
    );
  });

  it('strips macOS __MACOSX metadata before detecting the wrapper prefix', async () => {
    const zip = await buildZip({
      'my-experience/experience.json': JSON.stringify({ title: 'Wrapped' }),
      '__MACOSX/my-experience/._experience.json': 'macos-meta',
    });

    await expect(
      extractZipToStorage(zip, { targetId: 'macos-test' })
    ).resolves.toContain('experience.json');
  });

  it('throws when experience.json is missing from the ZIP', async () => {
    const zip = await buildZip({ 'assets/img.png': 'fake-image' });

    await expect(
      extractZipToStorage(zip, { targetId: 'missing-test' })
    ).rejects.toThrow('No experience.json found in root');
  });

  it('throws when experience.json is nested inside a subfolder within the wrapper', async () => {
    // Wrapper detected, but experience.json is still not at the effective root
    const zip = await buildZip({
      'wrapper/subdir/experience.json': JSON.stringify({ title: 'Deep' }),
      'wrapper/assets/img.png': 'fake-image',
    });

    await expect(
      extractZipToStorage(zip, { targetId: 'deep-test' })
    ).rejects.toThrow('No experience.json found in root');
  });

  it('succeeds and skips requireExperienceJson check when disabled', async () => {
    const zip = await buildZip({ 'data.json': '{}' });

    await expect(
      extractZipToStorage(zip, { targetId: 'no-check-test', requireExperienceJson: false })
    ).resolves.toContain('experience.json');
  });
});

// ---------------------------------------------------------------------------
// sanitizeZipEntryPath – regression guard for path traversal
// ---------------------------------------------------------------------------

describe('sanitizeZipEntryPath – path traversal regression', () => {
  const target = 'upload-id';

  it('accepts a normal file path', () => {
    expect(sanitizeZipEntryPath('experience.json', target)).toBe('experience.json');
  });

  it('accepts a nested path', () => {
    expect(sanitizeZipEntryPath('assets/img.png', target)).toMatch(/assets/);
  });

  it('rejects path traversal with ../', () => {
    expect(sanitizeZipEntryPath('../etc/passwd', target)).toBeNull();
  });

  it('rejects absolute paths', () => {
    expect(sanitizeZipEntryPath('/etc/passwd', target)).toBeNull();
  });

  it('replaces spaces with underscores', () => {
    expect(sanitizeZipEntryPath('my file.json', target)).toBe('my_file.json');
  });
});
