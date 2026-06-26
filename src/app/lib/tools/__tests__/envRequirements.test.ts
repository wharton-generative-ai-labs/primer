/**
 * Tests for the tool env-requirements layer that backs both the pre-flight
 * gate and the runtime ToolRegistry filter.
 */

import { TOOL_ENV_KEYS, getToolEnvKey, isToolEnabled } from '../envRequirements';

describe('envRequirements', () => {
  it('exposes generateImages → OPENAI_API_KEY', () => {
    expect(TOOL_ENV_KEYS.generateImages).toBe('OPENAI_API_KEY');
    expect(getToolEnvKey('generateImages')).toBe('OPENAI_API_KEY');
  });

  it('returns undefined for tools without env requirements', () => {
    expect(getToolEnvKey('slide')).toBeUndefined();
  });

  it('treats tools without env requirements as enabled', () => {
    expect(isToolEnabled('slide', {})).toBe(true);
  });

  it('treats a tool as disabled when its required env key is missing', () => {
    expect(isToolEnabled('generateImages', {})).toBe(false);
    expect(isToolEnabled('generateImages', { OPENAI_API_KEY: '' })).toBe(false);
  });

  it('treats a tool as enabled when its required env key is set', () => {
    expect(isToolEnabled('generateImages', { OPENAI_API_KEY: 'oa-test' })).toBe(true);
  });
});
