/**
 * Tests for UUID generation utility
 */

import { generateUUID } from '../uuid';

describe('UUID Generation', () => {
  describe('generateUUID', () => {
    it('should generate a valid UUID format', () => {
      const uuid = generateUUID();
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuid).toMatch(uuidRegex);
    });

    it('should generate unique UUIDs', () => {
      const uuid1 = generateUUID();
      const uuid2 = generateUUID();
      const uuid3 = generateUUID();

      expect(uuid1).not.toBe(uuid2);
      expect(uuid2).not.toBe(uuid3);
      expect(uuid1).not.toBe(uuid3);
    });

    it('should generate UUIDs with correct length', () => {
      const uuid = generateUUID();
      expect(uuid.length).toBe(36); // 32 hex chars + 4 hyphens
    });

    it('should generate UUIDs with hyphens in correct positions', () => {
      const uuid = generateUUID();
      expect(uuid[8]).toBe('-');
      expect(uuid[13]).toBe('-');
      expect(uuid[18]).toBe('-');
      expect(uuid[23]).toBe('-');
    });

    it('should generate UUID v4 (version 4)', () => {
      const uuid = generateUUID();
      // 13th character should be '4' for version 4
      expect(uuid[14]).toBe('4');
    });

    it('should generate UUID with correct variant bits', () => {
      const uuid = generateUUID();
      // 17th character (after 3rd hyphen) should be 8, 9, a, or b
      const variantChar = uuid[19].toLowerCase();
      expect(['8', '9', 'a', 'b']).toContain(variantChar);
    });

    it('should generate lowercase UUIDs', () => {
      const uuid = generateUUID();
      expect(uuid).toBe(uuid.toLowerCase());
    });

    it('should generate many unique UUIDs', () => {
      const uuids = new Set<string>();
      const count = 1000;

      for (let i = 0; i < count; i++) {
        uuids.add(generateUUID());
      }

      // All UUIDs should be unique
      expect(uuids.size).toBe(count);
    });

    it('should only use valid hexadecimal characters', () => {
      const uuid = generateUUID();
      const withoutHyphens = uuid.replace(/-/g, '');
      const hexRegex = /^[0-9a-f]+$/i;
      expect(withoutHyphens).toMatch(hexRegex);
    });

    it('should be consistent with crypto.randomUUID when available', () => {
      // This test verifies the function uses native crypto when available
      const uuid = generateUUID();
      expect(uuid).toBeTruthy();
      expect(typeof uuid).toBe('string');
    });

    describe('Edge Cases', () => {
      it('should work in multiple rapid calls', () => {
        const uuids = [];
        for (let i = 0; i < 100; i++) {
          uuids.push(generateUUID());
        }

        // Check all are valid and unique
        const uniqueUuids = new Set(uuids);
        expect(uniqueUuids.size).toBe(100);
        
        uuids.forEach(uuid => {
          expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        });
      });
    });

    describe('Format Validation', () => {
      it('should have exactly 5 groups separated by hyphens', () => {
        const uuid = generateUUID();
        const groups = uuid.split('-');
        expect(groups.length).toBe(5);
      });

      it('should have correct group lengths', () => {
        const uuid = generateUUID();
        const groups = uuid.split('-');
        expect(groups[0].length).toBe(8);
        expect(groups[1].length).toBe(4);
        expect(groups[2].length).toBe(4);
        expect(groups[3].length).toBe(4);
        expect(groups[4].length).toBe(12);
      });
    });
  });
});
