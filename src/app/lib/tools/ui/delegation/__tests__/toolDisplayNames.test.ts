/**
 * Tests for tool display name humanization
 */

import { getToolDisplayName } from '../toolDisplayNames';

describe('getToolDisplayName', () => {
  describe('with action parameter (command/action pattern)', () => {
    it('should humanize artifact with create action', () => {
      expect(getToolDisplayName('artifact', 'create')).toBe('Creating artifact');
    });

    it('should humanize artifact with delete action', () => {
      expect(getToolDisplayName('artifact', 'delete')).toBe('Deleting artifact');
    });

    it('should humanize scene with set action', () => {
      expect(getToolDisplayName('scene', 'set')).toBe('Setting scene');
    });

    it('should humanize agent with transfer action', () => {
      expect(getToolDisplayName('agent', 'transfer')).toBe('Transferring agent');
    });

    it('should humanize agent with delegate action', () => {
      expect(getToolDisplayName('agent', 'delegate')).toBe('Delegating agent');
    });

    it('should humanize information with save action', () => {
      expect(getToolDisplayName('information', 'save')).toBe('Saving information');
    });
  });

  describe('without action parameter (simple tools with verb in name)', () => {
    it('should humanize validateComponent', () => {
      expect(getToolDisplayName('validateComponent')).toBe('Validating component');
    });

    it('should humanize deployArtifact', () => {
      expect(getToolDisplayName('deployArtifact')).toBe('Deploying artifact');
    });

    it('should humanize createExperience', () => {
      expect(getToolDisplayName('createExperience')).toBe('Creating experience');
    });

    it('should humanize deleteFile', () => {
      expect(getToolDisplayName('deleteFile')).toBe('Deleting file');
    });

    it('should humanize moveDirectory', () => {
      expect(getToolDisplayName('moveDirectory')).toBe('Moving directory');
    });

    it('should humanize listResources', () => {
      expect(getToolDisplayName('listResources')).toBe('Listing resources');
    });

    it('should humanize getResourceContent', () => {
      expect(getToolDisplayName('getResourceContent')).toBe('Getting resource content');
    });

    it('should humanize generateImage', () => {
      expect(getToolDisplayName('generateImage')).toBe('Generating image');
    });
  });

  describe('fallback for tools without verbs', () => {
    it('should fallback for sessionEvent', () => {
      expect(getToolDisplayName('sessionEvent')).toBe('Using sessionEvent');
    });

    it('should fallback for celebrate', () => {
      expect(getToolDisplayName('celebrate')).toBe('Using celebrate');
    });

    it('should recognize delegate as a verb', () => {
      expect(getToolDisplayName('delegate')).toBe('Delegating');
    });
  });

  describe('edge cases', () => {
    it('should handle unknown actions gracefully', () => {
      expect(getToolDisplayName('artifact', 'unknownAction')).toBe('Using artifact');
    });

    it('should handle single-word tool names', () => {
      expect(getToolDisplayName('toast')).toBe('Using toast');
    });

    it('should handle multi-word remainder after verb', () => {
      expect(getToolDisplayName('getResourceContent')).toBe('Getting resource content');
    });
  });
});
