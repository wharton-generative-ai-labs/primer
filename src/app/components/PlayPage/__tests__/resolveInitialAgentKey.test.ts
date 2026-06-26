import { resolveInitialAgentKey } from '../resolveInitialAgentKey';

describe('resolveInitialAgentKey', () => {
  const agents = { alpha: {}, beta: {}, gamma: {} };

  it('returns the authored initialAgent when provided', () => {
    expect(resolveInitialAgentKey(agents, 'gamma')).toBe('gamma');
  });

  it('prefers the authored initialAgent over the first agent key', () => {
    // Even though `alpha` is the first key, the explicit author choice wins.
    expect(resolveInitialAgentKey(agents, 'beta')).toBe('beta');
  });

  it('falls back to the first agent key when no authored initialAgent is set', () => {
    expect(resolveInitialAgentKey(agents)).toBe('alpha');
    expect(resolveInitialAgentKey(agents, undefined)).toBe('alpha');
    expect(resolveInitialAgentKey(agents, '')).toBe('alpha');
  });

  it('returns an empty string when neither source provides a key', () => {
    expect(resolveInitialAgentKey({})).toBe('');
    expect(resolveInitialAgentKey(undefined)).toBe('');
  });
});
