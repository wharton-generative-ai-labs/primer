/**
 * Tests for the runtime ToolRegistry filter that drops tools whose required
 * env key is missing. Each scenario uses `jest.isolateModulesAsync` so the
 * registry singleton starts fresh and `process.env` mutations don't leak.
 */

const baseTool = {
  type: 'function' as const,
  name: 'generateImages',
  description: 'test',
  parameters: { type: 'object' as const, properties: {}, required: [] },
};

const noopHandler = async () => ({ status: 'success' as const });

describe('ToolRegistry env-gated registration', () => {
  it('skips tools whose required env key is unset', async () => {
    await jest.isolateModulesAsync(async () => {
      delete process.env.OPENAI_API_KEY;
      const { ToolRegistry } = await import('../ToolRegistry');
      const registry = ToolRegistry.getInstance();
      await registry.register(baseTool, noopHandler);
      expect(registry.getTool('generateImages')).toBeNull();
    });
  });

  it('registers tools whose required env key is set', async () => {
    await jest.isolateModulesAsync(async () => {
      process.env.OPENAI_API_KEY = 'oa-test';
      const { ToolRegistry } = await import('../ToolRegistry');
      const registry = ToolRegistry.getInstance();
      await registry.register(baseTool, noopHandler);
      expect(registry.getTool('generateImages')).not.toBeNull();
      delete process.env.OPENAI_API_KEY;
    });
  });

  it('still registers tools without env requirements', async () => {
    await jest.isolateModulesAsync(async () => {
      const { ToolRegistry } = await import('../ToolRegistry');
      const registry = ToolRegistry.getInstance();
      await registry.register(
        { ...baseTool, name: 'slide' },
        noopHandler,
      );
      expect(registry.getTool('slide')).not.toBeNull();
    });
  });
});
