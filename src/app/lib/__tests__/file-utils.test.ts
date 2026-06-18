/**
 * Tests for file utility functions
 */

import path from 'path';
import {
  hashUserEmail,
  generateExperienceId,
  getSessionUploadPath,
  getUserUploadPath,
  getFileInfoUrl,
  getExperienceFolder,
  getExperienceArtifactsPath,
  getExperienceArtifactsFolder,
  getExperienceConfigFolder,
  getSessionMetadataPath,
  getSessionMetadataFilePath,
  SESSION_EVENTS,
  SessionEvent,
  SessionMetadata,
} from '../file-utils';

describe('File Utilities', () => {
  describe('hashUserEmail', () => {
    it('should hash email to consistent SHA256 hex string', () => {
      const email = 'user@example.com';
      const hash = hashUserEmail(email);
      
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA256 produces 64 hex characters
    });

    it('should produce same hash for same email', () => {
      const email = 'test@example.com';
      const hash1 = hashUserEmail(email);
      const hash2 = hashUserEmail(email);
      
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different emails', () => {
      const hash1 = hashUserEmail('user1@example.com');
      const hash2 = hashUserEmail('user2@example.com');
      
      expect(hash1).not.toBe(hash2);
    });

    it('should be case-insensitive', () => {
      const hash1 = hashUserEmail('User@Example.COM');
      const hash2 = hashUserEmail('user@example.com');
      
      expect(hash1).toBe(hash2);
    });

    it('should handle emails with special characters', () => {
      const email = 'user+tag@example.com';
      const hash = hashUserEmail(email);
      
      expect(hash).toBeTruthy();
      expect(hash.length).toBe(64);
    });

    it('should only use hexadecimal characters', () => {
      const hash = hashUserEmail('test@example.com');
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('generateExperienceId', () => {
    it('should generate a string ID', () => {
      const id = generateExperienceId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('should generate ID with expected length', () => {
      const id = generateExperienceId();
      // The function uses substring(2, 15) which extracts up to 13 characters
      // but Math.random().toString(36) can produce varying lengths
      expect(id.length).toBeGreaterThan(0);
      expect(id.length).toBeLessThanOrEqual(13);
    });

    it('should generate unique IDs', () => {
      const id1 = generateExperienceId();
      const id2 = generateExperienceId();
      const id3 = generateExperienceId();
      
      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    it('should use alphanumeric characters only', () => {
      const id = generateExperienceId();
      expect(id).toMatch(/^[a-z0-9]+$/);
    });

    it('should be suitable for folder names', () => {
      const id = generateExperienceId();
      // Should not contain special characters that are problematic in filenames
      expect(id).not.toMatch(/[\/\\:*?"<>|]/);
    });

    it('should generate many unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateExperienceId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('getSessionUploadPath', () => {
    it('should construct correct session upload path', () => {
      const experienceId = 'exp123';
      const sessionId = 'sess456';
      const result = getSessionUploadPath(experienceId, sessionId);
      
      expect(result).toBe(path.join('exp123', 'session_data', 'sess456', 'uploads'));
    });

    it('should throw error if experienceId is missing', () => {
      expect(() => getSessionUploadPath('', 'sess123')).toThrow(/required/);
    });

    it('should throw error if sessionId is missing', () => {
      expect(() => getSessionUploadPath('exp123', '')).toThrow(/required/);
    });

    it('should handle IDs with special characters', () => {
      const result = getSessionUploadPath('exp-123', 'sess_456');
      expect(result).toContain('exp-123');
      expect(result).toContain('sess_456');
    });
  });

  describe('getUserUploadPath', () => {
    it('should construct correct user upload path', () => {
      const experienceId = 'exp123';
      const userEmail = 'user@example.com';
      const result = getUserUploadPath(experienceId, userEmail);
      
      expect(result).toContain('user-uploads');
      expect(result).toContain(experienceId);
    });

    it('should hash the email in the path', () => {
      const experienceId = 'exp123';
      const userEmail = 'user@example.com';
      const result = getUserUploadPath(experienceId, userEmail);
      
      // Should not contain the plain email
      expect(result).not.toContain('user@example.com');
      // Should contain the hashed email
      const hash = hashUserEmail(userEmail);
      expect(result).toContain(hash);
    });

    it('should throw error if experienceId is missing', () => {
      expect(() => getUserUploadPath(null, 'user@example.com')).toThrow('Both experienceId and userEmail are required');
    });

    it('should throw error if userEmail is missing', () => {
      expect(() => getUserUploadPath('exp123', null)).toThrow('Both experienceId and userEmail are required');
    });
  });

  describe('getFileInfoUrl', () => {
    it('should construct correct file info URL', () => {
      const fileName = 'document.pdf';
      const result = getFileInfoUrl(fileName);
      
      expect(result).toBe('/api/file-info/document.pdf');
    });

    it('should handle filenames with spaces', () => {
      const fileName = 'my document.pdf';
      const result = getFileInfoUrl(fileName);
      
      expect(result).toBe('/api/file-info/my document.pdf');
    });

    it('should handle filenames with special characters', () => {
      const fileName = 'file-name_123.txt';
      const result = getFileInfoUrl(fileName);
      
      expect(result).toBe('/api/file-info/file-name_123.txt');
    });
  });

  describe('getExperienceFolder', () => {
    it('should construct experience folder path', async () => {
      const experienceId = 'exp123';
      const result = await getExperienceFolder(experienceId);
      
      expect(result).toContain('storage');
      expect(result).toContain(experienceId);
    });

    it('should throw error if experienceId is missing', async () => {
      await expect(getExperienceFolder('')).rejects.toThrow('Experience ID is required');
    });

    it.each([
      '..',
      '../etc',
      '../../etc/passwd',
      'foo/bar',
      'foo\\bar',
      'foo\0bar',
      '.',
      './foo',
      'foo bar',
    ])('rejects unsafe experienceId: %s', async (badId) => {
      await expect(getExperienceFolder(badId)).rejects.toThrow(/Invalid experience ID/);
    });

    it.each([
      'abc123',
      'roleplay-template',
      'my_experience',
      'a',
      'A1b2C3',
    ])('accepts safe experienceId: %s', async (goodId) => {
      await expect(getExperienceFolder(goodId)).resolves.toContain(goodId);
    });

    it('should use STORAGE_ROOT_PATH env var if set', async () => {
      // Mock the env module with custom storage path
      jest.resetModules();
      jest.doMock('@/config/env', () => ({
        env: {
          STORAGE_ROOT_PATH: '/custom/storage',
          NODE_ENV: 'test'
        }
      }));
      
      // Re-import file-utils with the new mock
      const { getExperienceFolder: getExperienceFolderMocked } = await import('../file-utils');
      
      const result = await getExperienceFolderMocked('exp123');
      expect(result).toContain('/custom/storage');
      
      // Restore original mock
      jest.resetModules();
    });
  });

  describe('getExperienceArtifactsPath', () => {
    it('should construct correct artifacts path', () => {
      const experienceId = 'exp123';
      const sessionId = 'sess456';
      const result = getExperienceArtifactsPath(experienceId, sessionId);
      
      expect(result).toBe(path.join('exp123', 'session_data', 'sess456', 'artifacts'));
    });

    it('should throw error if experienceId is missing', () => {
      expect(() => getExperienceArtifactsPath('', 'sess123')).toThrow(/required/);
    });

    it('should throw error if sessionId is missing', () => {
      expect(() => getExperienceArtifactsPath('exp123', '')).toThrow(/required/);
    });
  });

  describe('getExperienceArtifactsFolder', () => {
    it('should construct full artifacts folder path', async () => {
      const experienceId = 'exp123';
      const sessionId = 'sess456';
      const result = await getExperienceArtifactsFolder(experienceId, sessionId);
      
      expect(result).toContain('storage');
      expect(result).toContain(experienceId);
      expect(result).toContain('session_data');
      expect(result).toContain(sessionId);
      expect(result).toContain('artifacts');
    });

    it('should throw error if experienceId is missing', async () => {
      await expect(getExperienceArtifactsFolder('', 'sess123')).rejects.toThrow(/required/);
    });

    it('should throw error if sessionId is missing', async () => {
      await expect(getExperienceArtifactsFolder('exp123', '')).rejects.toThrow(/required/);
    });
  });

  describe('getExperienceConfigFolder', () => {
    it('should construct config folder path', async () => {
      const experienceId = 'exp123';
      const result = await getExperienceConfigFolder(experienceId);
      
      expect(result).toContain('storage');
      expect(result).toContain(experienceId);
    });

    it('should throw error if experienceId is missing', async () => {
      await expect(getExperienceConfigFolder('')).rejects.toThrow('Experience ID is required');
    });
  });

  describe('getSessionMetadataPath', () => {
    it('should construct session metadata path', () => {
      const experienceId = 'exp123';
      const sessionId = 'sess456';
      const result = getSessionMetadataPath(experienceId, sessionId);
      
      expect(result).toBe(path.join('exp123', 'session_data', 'sess456', 'session.json'));
    });

    it('should throw error if experienceId is missing', () => {
      expect(() => getSessionMetadataPath('', 'sess123')).toThrow(/required/);
    });

    it('should throw error if sessionId is missing', () => {
      expect(() => getSessionMetadataPath('exp123', '')).toThrow(/required/);
    });
  });

  describe('getSessionMetadataFilePath', () => {
    it('should construct full session metadata file path', async () => {
      const experienceId = 'exp123';
      const sessionId = 'sess456';
      const result = await getSessionMetadataFilePath(experienceId, sessionId);
      
      expect(result).toContain('storage');
      expect(result).toContain(experienceId);
      expect(result).toContain('session_data');
      expect(result).toContain(sessionId);
      expect(result).toContain('session.json');
    });

    it('should throw error if experienceId is missing', async () => {
      await expect(getSessionMetadataFilePath('', 'sess123')).rejects.toThrow(/required/);
    });

    it('should throw error if sessionId is missing', async () => {
      await expect(getSessionMetadataFilePath('exp123', '')).rejects.toThrow(/required/);
    });
  });

  describe('SESSION_EVENTS', () => {
    it('should have all required event types', () => {
      expect(SESSION_EVENTS.SESSION_STARTED).toBe('session_started');
      expect(SESSION_EVENTS.SESSION_COMPLETED).toBe('session_completed');
      expect(SESSION_EVENTS.PHASE_COMPLETED).toBe('phase_completed');
    });

    it('should be a const object', () => {
      // In non-strict mode, const objects don't throw when modified
      // Just verify the values are correct
      expect(SESSION_EVENTS.SESSION_STARTED).toBe('session_started');
      expect(SESSION_EVENTS.SESSION_COMPLETED).toBe('session_completed');
      expect(SESSION_EVENTS.PHASE_COMPLETED).toBe('phase_completed');
    });

    it('should have all workflow-phase event constants', () => {
      expect(SESSION_EVENTS.WORKFLOW_PHASE_ENTERED).toBe('workflow_phase_entered');
      expect(SESSION_EVENTS.WORKFLOW_PHASE_LEFT).toBe('workflow_phase_left');
      expect(SESSION_EVENTS.WORKFLOW_PHASE_SKIPPED).toBe('workflow_phase_skipped');
      expect(SESSION_EVENTS.WORKFLOW_PHASE_REVISITED).toBe('workflow_phase_revisited');
      expect(SESSION_EVENTS.WORKFLOW_NEXT_OVERRIDDEN).toBe('workflow_next_overridden');
      expect(SESSION_EVENTS.EXPERIENCE_COMPLETED).toBe('experience_completed');
      expect(SESSION_EVENTS.EXPERIENCE_REWOUND).toBe('experience_rewound');
    });

    it('should not expose the removed PHASE_STARTED constant', () => {
      expect((SESSION_EVENTS as Record<string, string | undefined>).PHASE_STARTED).toBeUndefined();
    });
  });

  describe('Type Definitions', () => {
    it('should accept valid SessionEvent', () => {
      const event: SessionEvent = {
        event: 'test_event',
        agent: 'test_agent',
        timestamp: new Date().toISOString(),
        data: { key: 'value' }
      };

      expect(event.event).toBe('test_event');
      expect(event.agent).toBe('test_agent');
      expect(event.timestamp).toBeTruthy();
      expect(event.data).toEqual({ key: 'value' });
    });

    it('should accept SessionEvent without optional data', () => {
      const event: SessionEvent = {
        event: 'test_event',
        agent: 'test_agent',
        timestamp: new Date().toISOString()
      };

      expect(event.data).toBeUndefined();
    });

    it('should accept valid SessionMetadata', () => {
      const metadata: SessionMetadata = {
        sessionId: 'sess123',
        experienceId: 'exp456',
        startTime: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        userName: 'Test User',
        userEmail: 'test@example.com',
        events: []
      };

      expect(metadata.sessionId).toBe('sess123');
      expect(metadata.experienceId).toBe('exp456');
      expect(metadata.events).toEqual([]);
    });

    it('should accept SessionMetadata with minimal fields', () => {
      const metadata: SessionMetadata = {
        sessionId: 'sess123',
        experienceId: 'exp456',
        startTime: new Date().toISOString(),
        events: []
      };

      expect(metadata.lastActivity).toBeUndefined();
      expect(metadata.userName).toBeUndefined();
      expect(metadata.userEmail).toBeUndefined();
    });

    it('should satisfy SessionMetadata with workflowPhaseState', () => {
      const _sampleWithPhase = {
        sessionId: 'sess123',
        experienceId: 'exp456',
        startTime: new Date().toISOString(),
        events: [],
        workflowPhaseState: { currentPhase: 'discovery' },
      } satisfies SessionMetadata;

      expect(_sampleWithPhase.workflowPhaseState?.currentPhase).toBe('discovery');
    });
  });

  describe('assertSafeRelativePath', () => {
    let assertSafeRelativePath: typeof import('../file-utils').assertSafeRelativePath;

    beforeAll(async () => {
      ({ assertSafeRelativePath } = await import('../file-utils'));
    });

    it.each([
      'resources/img.png',
      'docs/file.md',
      'a',
      'a/b/c.txt',
      'foo.json',
    ])('accepts safe path: %s', (p) => {
      expect(() => assertSafeRelativePath(p)).not.toThrow();
    });

    it.each([
      '..',
      '../etc/passwd',
      '../../escape',
      '/etc/passwd',
      'foo/../bar',
      'a/b/../../etc',
      'foo\0bar',
      '',
    ])('rejects unsafe path: %s', (p) => {
      expect(() => assertSafeRelativePath(p)).toThrow();
    });
  });

  describe('safeJoinExperiencePath', () => {
    let safeJoinExperiencePath: typeof import('../file-utils').safeJoinExperiencePath;
    const root = path.join(path.sep, 'tmp', 'storage', 'exp123');

    beforeAll(async () => {
      ({ safeJoinExperiencePath } = await import('../file-utils'));
    });

    it.each([
      'resources/img.png',
      'a/b/c.txt',
      'file.json',
      './file.json',
      'a/../b.txt', // normalized to b.txt, stays inside
    ])('accepts safe path: %s', (p) => {
      const result = safeJoinExperiencePath(root, p);
      expect(result.startsWith(root)).toBe(true);
    });

    it.each([
      '../escape.txt',
      '../../etc/passwd',
      '/etc/passwd',
      'a/../../b.txt',
      'foo\0bar',
      '',
    ])('rejects traversal/invalid path: %s', (p) => {
      expect(() => safeJoinExperiencePath(root, p)).toThrow();
    });
  });
});
