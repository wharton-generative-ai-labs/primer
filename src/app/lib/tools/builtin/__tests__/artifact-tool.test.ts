import { artifact } from '../artifact-tool';
import type { ToolContext } from '@/app/lib/tools/types';

jest.mock('@/lib/logger', () => ({
  createModuleLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

function makeContext(): ToolContext & {
  createArtifact: jest.Mock;
  updateArtifact: jest.Mock;
} {
  const created: any[] = [];
  const createArtifact = jest.fn(async (name: string, content: string, type: string) => {
    const a = { id: `art-${created.length + 1}`, name, content, type };
    created.push(a);
    return a;
  });
  return {
    experienceId: 'exp-1',
    functionCallId: 'fn-1',
    createArtifact,
    updateArtifact: jest.fn(async () => {}),
    listArtifacts: jest.fn(async () => []),
    deleteArtifact: jest.fn(async () => {}),
    getArtifact: jest.fn(async () => null),
  } as any;
}

describe('artifact create with scaffold synthesis', () => {
  it('synthesizes a scaffold when type is known and content is omitted', async () => {
    const ctx = makeContext();
    const result = await artifact(
      { action: 'create', name: 'Intake Journal', type: 'journal' } as any,
      ctx,
    );
    expect(result.status).toBe('success');
    expect(result.data.scaffolded).toBe(true);
    expect(result.data.scaffoldType).toBe('journal');
    expect(ctx.createArtifact).toHaveBeenCalledTimes(1);
    const [, content, type] = ctx.createArtifact.mock.calls[0];
    expect(type).toBe('journal');
    expect(content).toContain('# Intake Journal');
    expect(content).toContain('## Session Goal');
  });

  it('passes content through unchanged when supplied', async () => {
    const ctx = makeContext();
    await artifact(
      { action: 'create', name: 'Custom', type: 'journal', content: 'CUSTOM BODY' } as any,
      ctx,
    );
    const [, content] = ctx.createArtifact.mock.calls[0];
    expect(content).toBe('CUSTOM BODY');
  });

  it('does not flag non-scaffolded creates as scaffolded', async () => {
    const ctx = makeContext();
    const result = await artifact(
      { action: 'create', name: 'Plain', content: 'Hello' } as any,
      ctx,
    );
    expect(result.status).toBe('success');
    expect((result.data as any).scaffolded).toBeUndefined();
  });

  it('errors when content is omitted and type is unknown', async () => {
    const ctx = makeContext();
    const result = await artifact(
      { action: 'create', name: 'Mystery', type: 'mystery-type' } as any,
      ctx,
    );
    expect(result.status).toBe('error');
    expect(ctx.createArtifact).not.toHaveBeenCalled();
  });

  it('errors when content is omitted and no type is given', async () => {
    const ctx = makeContext();
    const result = await artifact(
      { action: 'create', name: 'Mystery' } as any,
      ctx,
    );
    expect(result.status).toBe('error');
  });

  it('checklist scaffold passes the existing "- [ ]" content guard', async () => {
    const ctx = makeContext();
    const result = await artifact(
      { action: 'create', name: 'Tasks', type: 'checklist' } as any,
      ctx,
    );
    expect(result.status).toBe('success');
    expect(result.data.scaffolded).toBe(true);
    const [, content] = ctx.createArtifact.mock.calls[0];
    expect(content).toContain('- [ ]');
  });

  it('rejects an explicit checklist content that has no checkboxes', async () => {
    const ctx = makeContext();
    const result = await artifact(
      { action: 'create', name: 'Tasks', type: 'checklist', content: 'no boxes here' } as any,
      ctx,
    );
    expect(result.status).toBe('error');
  });
});

// The realtime model (gpt-realtime-1.5 on the intake agent) repeatedly
// misroutes display calls as `artifact({action:'showArtifact'})` instead of
// the correct `slide({action:'showArtifact'})`, even with five anchoring
// fragments in the prompt. The tool's enum rejects the action regardless,
// but the fix here is to make the rejection message so actionable that the
// agent self-corrects on the very next turn rather than narrating "I'll
// move on" and stalling. Lock the wording so a future revert can't silently
// re-introduce the stall pattern.
//
// History: see `Experience Creator QA.md:546` and
// `experience_creator_qa_round1_fixes.plan.md` finding #4.
describe('artifact rejects slide-shaped actions with actionable error', () => {
  it("redirects action='showArtifact' to slide and echoes back the artifactId", async () => {
    const ctx = makeContext();
    const result = await artifact(
      { action: 'showArtifact', artifactId: 'design_document' } as any,
      ctx,
    );
    expect(result.status).toBe('error');
    const error = (result.data as { error: string }).error;
    expect(error).toMatch(/slide/);
    expect(error).toMatch(/showArtifact/);
    expect(error).toMatch(/design_document/);
    // The corrected call shape must be literally present so the agent can
    // copy-paste it on the next turn.
    expect(error).toMatch(
      /slide\(\{\s*action:\s*'showArtifact',\s*artifactId:\s*'design_document'\s*\}\)/,
    );
    // Storage-vs-display framing must remain so the agent learns the
    // tool boundary, not just the syntax.
    expect(error).toMatch(/storage/i);
    // No artifact CRUD calls should fire from a misroute.
    expect(ctx.createArtifact).not.toHaveBeenCalled();
  });

  it("redirects action='showArtifact' even when the model passes 'id' instead of 'artifactId'", async () => {
    const ctx = makeContext();
    const result = await artifact(
      { action: 'showArtifact', id: 'design_document' } as any,
      ctx,
    );
    expect(result.status).toBe('error');
    const error = (result.data as { error: string }).error;
    // Whichever field name the model used, the corrected call must echo
    // the same id back as `artifactId` (the field slide actually expects).
    expect(error).toMatch(
      /slide\(\{\s*action:\s*'showArtifact',\s*artifactId:\s*'design_document'\s*\}\)/,
    );
  });

  it("redirects the legacy action='show' (removed in the artifact/slide refactor) with both call shapes", async () => {
    const ctx = makeContext();
    const result = await artifact(
      { action: 'show', id: 'foo' } as any,
      ctx,
    );
    expect(result.status).toBe('error');
    const error = (result.data as { error: string }).error;
    expect(error).toMatch(/slide/);
    // When an id is present, prefer pointing at slide.showArtifact (the
    // common intent when the model regresses to the legacy `show`) and
    // mention slide.show as the alternative.
    expect(error).toMatch(
      /slide\(\{\s*action:\s*'showArtifact',\s*artifactId:\s*'foo'\s*\}\)/,
    );
    expect(error).toMatch(/slide\(\{\s*action:\s*'show'/);
  });

  it("falls back to the generic enum message for genuinely unknown actions (no slide reference)", async () => {
    const ctx = makeContext();
    const result = await artifact(
      { action: 'somethingElse' } as any,
      ctx,
    );
    expect(result.status).toBe('error');
    const error = (result.data as { error: string }).error;
    expect(error).toMatch(/Invalid action: somethingElse/);
    expect(error).toMatch(/list, get, create, edit, delete/);
    // Keep the slide redirect targeted at the two known misroutes only.
    expect(error).not.toMatch(/slide/);
  });
});
