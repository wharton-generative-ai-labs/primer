/**
 * Tests for the harness's `ToolContext` builder. The point of these tests is
 * to exercise the capability surface migrated tools rely on (scene,
 * workflowPhase, finishExperience), plus an end-to-end `executeTool` smoke
 * test for `scene` to confirm the dispatch wiring works after the migration.
 */

import { buildHarnessToolContext } from '../HarnessToolContext';
import { createState, type HarnessArtifact, type HarnessState } from '../state';
import type { Sink } from '../sink';
import type { AgentConfig } from '@/app/lib/types';
import type { WorkflowPhaseConfig } from '@/app/lib/workflow-phases';
import { executeTool } from '../tools';

const PHASES: WorkflowPhaseConfig[] = [
  { id: 'intro', title: 'Intro' },
  { id: 'design', title: 'Design' },
  { id: 'review', title: 'Review' },
];

function makeAgents(): Record<string, AgentConfig> {
  return {
    coach: {
      name: 'Coach',
      publicDescription: 'guides',
      downstreamAgents: [],
    } as unknown as AgentConfig,
  };
}

function makeSink(): { sink: Sink; events: any[] } {
  const events: any[] = [];
  const sink: Sink = {
    emit: (e) => events.push(e),
    close: async () => {},
  };
  return { sink, events };
}

function makeState(opts: { withPhases?: boolean } = {}): HarnessState {
  return createState(
    'exp1',
    makeAgents(),
    'coach',
    false,
    opts.withPhases ? { workflowPhases: PHASES } : {},
  );
}

/** Minimal harness artifact with rev-1 bootstrap (for tests that seed `state.artifacts` directly). */
function seedArtifact(p: Pick<HarnessArtifact, 'id' | 'name' | 'type' | 'content'>): HarnessArtifact {
  const createdAt = new Date().toISOString();
  return {
    ...p,
    currentRev: 1,
    revisions: [{ rev: 1, content: p.content, createdAt }],
  };
}

describe('buildHarnessToolContext - scene capabilities', () => {
  it('setScene mutates state.currentScene and reveals scene panel', () => {
    const state = makeState();
    const { sink } = makeSink();
    const ctx = buildHarnessToolContext({ state, sink, callId: 'c1' });
    expect(state.sceneVisible).toBe(false);
    expect(state.currentScene).toBeNull();

    ctx.setScene!('beach');
    expect(state.currentScene).toBe('beach');
    expect(state.sceneVisible).toBe(true);
  });

  it('showScene / hideScene toggle visibility without changing currentScene', () => {
    const state = makeState();
    state.currentScene = 'forest';
    const { sink } = makeSink();
    const ctx = buildHarnessToolContext({ state, sink, callId: 'c1' });

    ctx.hideScene!();
    expect(state.sceneVisible).toBe(false);
    expect(state.currentScene).toBe('forest');

    ctx.showScene!();
    expect(state.sceneVisible).toBe(true);
    expect(state.currentScene).toBe('forest');
  });

  it('getAvailableScenes returns []', () => {
    const state = makeState();
    const { sink } = makeSink();
    const ctx = buildHarnessToolContext({ state, sink, callId: 'c1' });
    expect(ctx.getAvailableScenes!()).toEqual([]);
  });
});

describe('buildHarnessToolContext - workflow-phase capabilities', () => {
  it("setWorkflowPhase({ kind: 'complete' }) adds current phase to completedPhases", async () => {
    const state = makeState({ withPhases: true });
    const { sink } = makeSink();
    const ctx = buildHarnessToolContext({ state, sink, callId: 'c1' });

    expect(state.workflowPhaseState?.completedPhases).toEqual([]);
    const result = await ctx.setWorkflowPhase!({ kind: 'complete' });
    expect(result.result).toBe(true);
    expect(result.currentPhase).toBe('intro');
    expect(state.workflowPhaseState?.completedPhases).toEqual(['intro']);
    // Did not navigate.
    expect(state.workflowPhaseState?.currentPhase).toBe('intro');
  });

  it("setWorkflowPhase({ kind: 'advance' }) advances and consumes override", async () => {
    const state = makeState({ withPhases: true });
    const { sink } = makeSink();
    const ctx = buildHarnessToolContext({ state, sink, callId: 'c1' });

    // Set an override forward to 'review'.
    const setNextResult = await ctx.setWorkflowPhase!({
      kind: 'setNext',
      targetPhase: 'review',
    });
    expect(setNextResult.result).toBe(true);
    expect(state.workflowPhaseState?.nextPhaseOverride).toBe('review');

    // Advance — should consume the override and skip 'design'.
    const advanceResult = await ctx.setWorkflowPhase!({ kind: 'advance' });
    expect(advanceResult.result).toBe(true);
    expect(advanceResult.currentPhase).toBe('review');
    expect(state.workflowPhaseState?.currentPhase).toBe('review');
    expect(state.workflowPhaseState?.nextPhaseOverride).toBeUndefined();
  });

  it("setWorkflowPhase({ kind: 'advance' }) past last phase returns { result: false, message }", async () => {
    const state = makeState({ withPhases: true });
    // Manually drop into the last phase.
    state.workflowPhaseState = {
      currentPhase: 'review',
      furthestPhase: 'review',
      visited: ['intro', 'design', 'review'],
      completedPhases: [],
      snapshots: {},
    };
    const { sink } = makeSink();
    const ctx = buildHarnessToolContext({ state, sink, callId: 'c1' });

    const result = await ctx.setWorkflowPhase!({ kind: 'advance' });
    expect(result.result).toBe(false);
    expect(result.message).toContain('finishExperience');
  });

  it('getCurrentWorkflowPhase returns the right shape', () => {
    const state = makeState({ withPhases: true });
    const { sink } = makeSink();
    const ctx = buildHarnessToolContext({ state, sink, callId: 'c1' });

    const info = ctx.getCurrentWorkflowPhase!();
    expect(info).toEqual({
      id: 'intro',
      title: 'Intro',
      index: 0,
      total: 3,
      isCompleted: false,
      nextPhaseOverride: undefined,
      resolvedNextPhaseId: 'design',
    });
  });

  it('getCurrentWorkflowPhase returns null when no phases', () => {
    const state = makeState();
    const { sink } = makeSink();
    const ctx = buildHarnessToolContext({ state, sink, callId: 'c1' });
    expect(ctx.getCurrentWorkflowPhase!()).toBeNull();
  });

  it('finishExperience() sets experienceCompleted = true and is idempotent', async () => {
    const state = makeState({ withPhases: true });
    const { sink, events } = makeSink();
    const ctx = buildHarnessToolContext({ state, sink, callId: 'c1' });

    expect(state.experienceCompleted).toBe(false);
    const result = await ctx.finishExperience!('user agreed');
    expect(result.result).toBe(true);
    expect(state.experienceCompleted).toBe(true);
    const eventsBeforeSecondCall = state.workflowPhaseEvents.length;

    // Second call: idempotent — still result: true, no new manager events.
    const second = await ctx.finishExperience!('again');
    expect(second.result).toBe(true);
    expect(state.workflowPhaseEvents.length).toBe(eventsBeforeSecondCall);
    // Two state.change emissions: once for finish, once for the redundant call's
    // short-circuit path? Actually idempotent path returns without emitting —
    // verify only the first call emitted.
    const stateChangeEvents = events.filter((e) => e.kind === 'state.change');
    expect(stateChangeEvents.length).toBe(1);
  });

  it('finishExperience fails on a phase-less experience (matches real path)', async () => {
    // The tool is no longer registered for phase-less experiences (gating in
    // register.ts), so this branch is normally unreachable from the LLM. If
    // called directly through the context, the manager throws and the wrapper
    // surfaces `{ result: false }` — matching how the real realtime/backend
    // paths behave when there's no workflow state to operate on.
    const state = makeState();
    const { sink } = makeSink();
    const ctx = buildHarnessToolContext({ state, sink, callId: 'c1' });
    const result = await ctx.finishExperience!();
    expect(result.result).toBe(false);
    expect(state.experienceCompleted).toBe(false);
  });

  it('suggestWorkflowPhaseReturn emits a state.change marker without mutating state', () => {
    const state = makeState({ withPhases: true });
    const { sink, events } = makeSink();
    const ctx = buildHarnessToolContext({ state, sink, callId: 'c1' });
    const before = JSON.stringify(state.workflowPhaseState);
    ctx.suggestWorkflowPhaseReturn!('design', 'wants to revisit');
    expect(JSON.stringify(state.workflowPhaseState)).toBe(before);
    const marker = events.find(
      (e) =>
        e.kind === 'state.change' &&
        (e.summary as any)?.workflowSuggestReturn,
    );
    expect(marker).toBeDefined();
    expect((marker.summary as any).workflowSuggestReturn).toEqual({
      phase: 'design',
      reason: 'wants to revisit',
    });
  });
});

describe('executeTool - end-to-end through migrated scene path', () => {
  it("scene 'set' action mutates state via the shared real handler", async () => {
    const state = makeState();
    const { sink } = makeSink();

    const resp = await executeTool('scene', { action: 'set', scene: 'sunset' }, {
      state,
      sink,
      callId: 'c1',
    });
    expect(resp.status).toBe('success');
    expect(state.currentScene).toBe('sunset');
    expect(state.sceneVisible).toBe(true);
  });

  it("scene 'hide' action toggles sceneVisible off via the shared real handler", async () => {
    const state = makeState();
    state.currentScene = 'sunset';
    state.sceneVisible = true;
    const { sink } = makeSink();

    const resp = await executeTool('scene', { action: 'hide' }, {
      state,
      sink,
      callId: 'c1',
    });
    expect(resp.status).toBe('success');
    expect(state.sceneVisible).toBe(false);
    expect(state.currentScene).toBe('sunset');
  });

  it("scene 'discover' returns the (empty) scene catalog via the shared real handler", async () => {
    const state = makeState();
    const { sink } = makeSink();
    const resp = await executeTool('scene', { action: 'discover' }, {
      state,
      sink,
      callId: 'c1',
    });
    expect(resp.status).toBe('success');
    // The real scene tool returns the joined list as the data payload.
    expect(resp.data).toBe('');
  });

  it('workflowPhase nextPhase dispatches through the shared handler', async () => {
    const state = makeState({ withPhases: true });
    const { sink } = makeSink();
    const resp = await executeTool('workflowPhase', { action: 'nextPhase' }, {
      state,
      sink,
      callId: 'c1',
    });
    expect(resp.status).toBe('success');
    // nextPhase = complete + advance atomically: intro is now in completedPhases AND we've moved on.
    expect(state.workflowPhaseState?.completedPhases).toContain('intro');
    expect(state.workflowPhaseState?.currentPhase).not.toBe('intro');
  });

  it('finishExperience dispatches through the shared handler', async () => {
    const state = makeState({ withPhases: true });
    const { sink } = makeSink();
    const resp = await executeTool('finishExperience', { reason: 'done' }, {
      state,
      sink,
      callId: 'c1',
    });
    expect(resp.status).toBe('success');
    expect(state.experienceCompleted).toBe(true);
  });
});

describe('executeTool - information (migrated)', () => {
  it('save persists to state.information; get returns the value', async () => {
    const state = makeState();
    const { sink } = makeSink();
    const env = { state, sink, callId: 'c1' };

    const saveResp = await executeTool('information', { action: 'save', key: 'topic', value: 'hydraulics' }, env);
    expect(saveResp.status).toBe('success');
    expect(state.information.topic).toBe('hydraulics');

    const getResp = await executeTool('information', { action: 'get', key: 'topic' }, env);
    expect(getResp.status).toBe('success');
    expect(getResp.data).toEqual({ key: 'topic', value: 'hydraulics' });
  });

  it('discover returns "(no keys stored)" when empty, otherwise joined keys', async () => {
    const state = makeState();
    const { sink } = makeSink();
    const env = { state, sink, callId: 'c1' };

    const empty = await executeTool('information', { action: 'discover' }, env);
    expect(empty.data).toBe('(no keys stored)');

    state.information.a = '1';
    state.information.b = '2';
    const populated = await executeTool('information', { action: 'discover' }, env);
    expect(populated.data).toBe('a, b');
  });

  it('delete removes the key when present', async () => {
    const state = makeState();
    state.information.gone = 'soon';
    const { sink } = makeSink();
    const resp = await executeTool('information', { action: 'delete', key: 'gone' }, {
      state, sink, callId: 'c1',
    });
    expect(resp.status).toBe('success');
    expect('gone' in state.information).toBe(false);
  });
});

describe('executeTool - note (migrated)', () => {
  it("display action saves a Note into state.notes and reveals the notes tab", async () => {
    const state = makeState();
    const { sink } = makeSink();

    const resp = await executeTool('note', {
      action: 'display',
      content: 'remember the milk',
      color: 'pink',
    }, { state, sink, callId: 'c1' });

    expect(resp.status).toBe('success');
    const ids = Object.keys(state.notes);
    expect(ids.length).toBe(1);
    const note = state.notes[ids[0]];
    expect(note.content).toBe('remember the milk');
    expect(note.color).toBe('pink');
    expect(state.documentVisible).toBe(true);
    expect(state.documentTab).toBe('notes');
  });

  it('changeColor updates the stored note color', async () => {
    const state = makeState();
    const { sink } = makeSink();

    // Display a note first.
    await executeTool('note', { action: 'display', content: 'hello', color: 'yellow' }, {
      state, sink, callId: 'c1',
    });
    const noteId = Object.keys(state.notes)[0];

    const resp = await executeTool('note', { action: 'changeColor', noteId, color: 'green' }, {
      state, sink, callId: 'c2',
    });
    expect(resp.status).toBe('success');
    expect(state.notes[noteId].color).toBe('green');
  });

  it('delete removes the note from state.notes', async () => {
    const state = makeState();
    const { sink } = makeSink();

    await executeTool('note', { action: 'display', content: 'temporary', color: 'blue' }, {
      state, sink, callId: 'c1',
    });
    const noteId = Object.keys(state.notes)[0];

    const resp = await executeTool('note', { action: 'delete', noteId }, {
      state, sink, callId: 'c2',
    });
    expect(resp.status).toBe('success');
    expect(noteId in state.notes).toBe(false);
  });

  it('list returns all notes', async () => {
    const state = makeState();
    const { sink } = makeSink();
    await executeTool('note', { action: 'display', content: 'one' }, { state, sink, callId: 'c1' });
    await executeTool('note', { action: 'display', content: 'two' }, { state, sink, callId: 'c2' });

    const resp = await executeTool('note', { action: 'list' }, { state, sink, callId: 'c3' });
    expect(resp.status).toBe('success');
    expect(Array.isArray(resp.data)).toBe(true);
    expect(resp.data.length).toBe(2);
  });
});

describe('executeTool - artifact (migrated)', () => {
  it('create stores the artifact in state.artifacts', async () => {
    const state = makeState();
    const { sink } = makeSink();
    const resp = await executeTool('artifact', {
      action: 'create', name: 'plan', content: '# plan', type: 'markdown',
    }, { state, sink, callId: 'c1' });
    expect(resp.status).toBe('success');
    expect(resp.data.name).toBe('plan');
    const created = state.artifacts[resp.data.id];
    expect(created.content).toBe('# plan');
    expect(created.currentRev).toBe(1);
    expect(created.revisions).toHaveLength(1);
    expect(created.revisions[0].rev).toBe(1);
  });

  it('list returns all stored artifacts', async () => {
    const state = makeState();
    state.artifacts.a1 = seedArtifact({ id: 'a1', name: 'one', type: 'markdown', content: '1' });
    state.artifacts.a2 = seedArtifact({ id: 'a2', name: 'two', type: 'markdown', content: '2' });
    const { sink } = makeSink();
    const resp = await executeTool('artifact', { action: 'list' }, { state, sink, callId: 'c1' });
    expect(resp.status).toBe('success');
    expect(resp.data).toHaveLength(2);
  });

  it('edit updates the existing artifact content', async () => {
    const state = makeState();
    state.artifacts.a1 = seedArtifact({ id: 'a1', name: 'one', type: 'markdown', content: 'old' });
    const { sink } = makeSink();
    const resp = await executeTool('artifact', { action: 'edit', id: 'a1', content: 'new' }, {
      state, sink, callId: 'c1',
    });
    expect(resp.status).toBe('success');
    expect(state.artifacts.a1.content).toBe('new');
    expect(state.artifacts.a1.currentRev).toBe(2);
    expect(state.artifacts.a1.revisions).toHaveLength(2);
    expect(state.artifacts.a1.revisions[1].content).toBe('new');
  });

  it('edit with identical content is a no-op (no new revision)', async () => {
    const state = makeState();
    state.artifacts.a1 = seedArtifact({ id: 'a1', name: 'one', type: 'markdown', content: 'same' });
    const { sink, events } = makeSink();
    const resp = await executeTool('artifact', { action: 'edit', id: 'a1', content: 'same' }, {
      state, sink, callId: 'c1',
    });
    expect(resp.status).toBe('success');
    expect(state.artifacts.a1.currentRev).toBe(1);
    expect(state.artifacts.a1.revisions).toHaveLength(1);
    const bumps = events.filter(
      (e) => e.kind === 'state.change' && (e.summary as any)?.artifactUpdated,
    );
    expect(bumps.length).toBe(0);
  });

  it('delete removes the artifact', async () => {
    const state = makeState();
    state.artifacts.a1 = seedArtifact({ id: 'a1', name: 'one', type: 'markdown', content: '1' });
    const { sink } = makeSink();
    const resp = await executeTool('artifact', { action: 'delete', id: 'a1' }, {
      state, sink, callId: 'c1',
    });
    expect(resp.status).toBe('success');
    expect('a1' in state.artifacts).toBe(false);
  });

  it('get returns the requested artifact', async () => {
    const state = makeState();
    state.artifacts.a1 = seedArtifact({ id: 'a1', name: 'one', type: 'markdown', content: 'hi' });
    const { sink } = makeSink();
    const resp = await executeTool('artifact', { action: 'get', id: 'a1' }, {
      state, sink, callId: 'c1',
    });
    expect(resp.status).toBe('success');
    expect(resp.data.id).toBe('a1');
  });

  it('get with rev returns that revision snapshot', async () => {
    const state = makeState();
    const ts = new Date().toISOString();
    state.artifacts.a1 = {
      id: 'a1',
      name: 'one',
      type: 'markdown',
      content: 'v2',
      currentRev: 2,
      revisions: [
        { rev: 1, content: 'v1', createdAt: ts },
        { rev: 2, content: 'v2', createdAt: ts },
      ],
    };

    const { sink } = makeSink();
    const r1 = await executeTool('artifact', { action: 'get', id: 'a1', rev: 1 }, {
      state, sink, callId: 'c1',
    });
    expect(r1.status).toBe('success');
    expect(r1.data.content).toBe('v1');
    expect(r1.data.rev).toBe(1);

    const missing = await executeTool('artifact', { action: 'get', id: 'a1', rev: 99 }, {
      state, sink, callId: 'c2',
    });
    expect(missing.status).toBe('success');
    expect(missing.data).toBeNull();
  });
});

describe('executeTool - checklist (migrated)', () => {
  it('discover lists checklist artifacts', async () => {
    const state = makeState();
    state.artifacts.c1 = seedArtifact({
      id: 'c1',
      name: 'Tasks',
      type: 'checklist',
      content: '- [ ] one',
    });
    state.artifacts.a1 = seedArtifact({ id: 'a1', name: 'note', type: 'markdown', content: 'hi' });
    const { sink } = makeSink();

    const resp = await executeTool('checklist', { action: 'discover' }, {
      state, sink, callId: 'c1',
    });
    expect(resp.status).toBe('success');
    expect(resp.data.count).toBe(1);
    expect(resp.data.checklists[0].id).toBe('c1');
  });

  it('check toggles - [ ] to - [x] in the checklist artifact content', async () => {
    const state = makeState();
    state.artifacts.c1 = seedArtifact({
      id: 'c1',
      name: 'Tasks',
      type: 'checklist',
      content: '- [ ] alpha\n- [ ] beta',
    });
    const { sink } = makeSink();
    const resp = await executeTool('checklist', { action: 'check', itemText: 'alpha' }, {
      state, sink, callId: 'c1',
    });
    expect(resp.status).toBe('success');
    expect(state.artifacts.c1.content).toContain('- [x] alpha');
    expect(state.artifacts.c1.content).toContain('- [ ] beta');
  });

  it('showProgress flips the checklist tab on and reports progress numbers', async () => {
    const state = makeState();
    state.artifacts.c1 = seedArtifact({
      id: 'c1',
      name: 'Tasks',
      type: 'checklist',
      content: '- [x] one\n- [ ] two\n- [ ] three',
    });
    const { sink } = makeSink();
    const resp = await executeTool('checklist', { action: 'showProgress' }, {
      state, sink, callId: 'c1',
    });
    expect(resp.status).toBe('success');
    expect(resp.data.totalItems).toBe(3);
    expect(resp.data.completedItems).toBe(1);
    expect(state.activeChecklistId).toBe('c1');
    expect(state.documentVisible).toBe(true);
    expect(state.documentTab).toBe('checklist');
  });
});

describe('executeTool - agent (migrated)', () => {
  function makeAgentsWithHandoff(): Record<string, AgentConfig> {
    return {
      coach: {
        name: 'Coach',
        publicDescription: 'guides',
        downstreamAgents: ['mentor'],
      } as unknown as AgentConfig,
      mentor: {
        name: 'Mentor',
        publicDescription: 'teaches',
        downstreamAgents: [],
      } as unknown as AgentConfig,
    };
  }

  it('discover lists all agents with current_agent flagged', async () => {
    const state = createState('exp1', makeAgentsWithHandoff(), 'coach', false, {});
    const { sink } = makeSink();
    const resp = await executeTool('agent', { action: 'discover' }, {
      state, sink, callId: 'c1',
    });
    expect(resp.status).toBe('success');
    expect(resp.data.current_agent).toBe('coach');
    expect(resp.data.count).toBe(2);
    const coach = resp.data.agents.find((a: any) => a.key === 'coach');
    const mentor = resp.data.agents.find((a: any) => a.key === 'mentor');
    expect(coach.is_current).toBe(true);
    expect(mentor.available_actions).toContain('transfer');
  });

  it('transfer queues the destination agent in HarnessState', async () => {
    const state = createState('exp1', makeAgentsWithHandoff(), 'coach', false, {});
    const { sink, events } = makeSink();
    const resp = await executeTool('agent', {
      action: 'transfer',
      destination: 'Mentor',
      rationale: 'mentor is the right next step',
      conversationContext: 'after orientation',
    }, { state, sink, callId: 'c1' });

    expect(resp.status).toBe('success');
    expect(resp.data.did_transfer).toBe(true);
    expect(resp.data.destination_agent).toBe('mentor');
    expect(state.pendingAgentTransfer).toBe('mentor');
    // The real handler emits a structured handoff via `addTranscriptHandoff`,
    // which the harness routes to the sink as an `agent.handoff` event.
    expect(events.find((e) => e.kind === 'agent.handoff')).toMatchObject({
      from: 'Coach',
      to: 'Mentor',
      rationale: 'mentor is the right next step',
    });
  });

  it('transfer to a non-downstream agent is rejected', async () => {
    const state = createState('exp1', {
      coach: { name: 'Coach', publicDescription: 'g', downstreamAgents: [] },
      stranger: { name: 'Stranger', publicDescription: 's', downstreamAgents: [] },
    } as unknown as Record<string, AgentConfig>, 'coach', false, {});
    const { sink } = makeSink();
    const resp = await executeTool('agent', {
      action: 'transfer',
      destination: 'Stranger',
      rationale: 'why not',
      conversationContext: 'because',
    }, { state, sink, callId: 'c1' });

    expect(resp.status).toBe('error');
    expect(state.pendingAgentTransfer).toBeNull();
  });

  it('delegate is short-circuited as "not supported in harness v1"', async () => {
    const state = createState('exp1', makeAgentsWithHandoff(), 'coach', false, {});
    const { sink } = makeSink();
    const resp = await executeTool('agent', {
      action: 'delegate',
      agentType: 'mentor',
    }, { state, sink, callId: 'c1' });

    expect(resp.status).toBe('error');
    expect(resp.data.error).toContain('not supported in harness');
  });
});

describe('executeTool - toast (migrated)', () => {
  it('emits a state.change summary the harness feed can render', async () => {
    const state = makeState();
    const { sink, events } = makeSink();
    const resp = await executeTool('toast', {
      action: 'show',
      message: 'Saved!',
      type: 'default',
    }, { state, sink, callId: 'c1' });

    expect(resp.status).toBe('success');
    const toastEvent = events.find(
      (e) => e.kind === 'state.change' && (e.summary as any).toast,
    );
    expect((toastEvent!.summary as any).toast).toEqual({
      title: 'Saved!',
      variant: 'default',
    });
  });

  it("destructive variant lands as 'destructive' in the summary", async () => {
    const state = makeState();
    const { sink, events } = makeSink();
    await executeTool('toast', {
      action: 'show',
      message: 'Save failed',
      type: 'destructive',
    }, { state, sink, callId: 'c1' });

    const toastEvent = events.find(
      (e) => e.kind === 'state.change' && (e.summary as any).toast,
    );
    expect((toastEvent!.summary as any).toast.variant).toBe('destructive');
  });
});

describe('executeTool - sound (migrated)', () => {
  it('discover returns an empty list (harness has no sound catalog)', async () => {
    const state = makeState();
    const { sink } = makeSink();
    const resp = await executeTool('sound', { action: 'discover' }, {
      state, sink, callId: 'c1',
    });
    expect(resp.status).toBe('success');
    expect(resp.data.availableSounds).toEqual([]);
  });

  it('play emits a sound state.change summary the harness feed can render', async () => {
    const state = makeState();
    const { sink, events } = makeSink();
    const resp = await executeTool('sound', {
      action: 'play',
      name: 'success.mp3',
      volume: 0.5,
      loop: false,
    }, { state, sink, callId: 'c1' });

    expect(resp.status).toBe('success');
    const soundEvent = events.find(
      (e) => e.kind === 'state.change' && (e.summary as any).sound,
    );
    expect((soundEvent!.summary as any).sound).toEqual({
      name: 'success.mp3',
      volume: 0.5,
      loop: false,
    });
  });

  it('play without name returns an error', async () => {
    const state = makeState();
    const { sink } = makeSink();
    const resp = await executeTool('sound', { action: 'play' }, {
      state, sink, callId: 'c1',
    });
    expect(resp.status).toBe('error');
  });
});

describe('executeTool - slide (migrated)', () => {
  it('show creates an active slide and reveals the document panel', async () => {
    const state = makeState();
    const { sink } = makeSink();
    const resp = await executeTool('slide', {
      action: 'show',
      title: 'Welcome',
      content: '# Welcome\n\nLet us begin.',
    }, { state, sink, callId: 'c1' });

    expect(resp.status).toBe('success');
    expect(resp.data.slideId).toBeDefined();
    expect(state.activeSlide).not.toBeNull();
    expect(state.activeSlide!.title).toBe('Welcome');
    expect(state.documentVisible).toBe(true);
    expect(state.documentTab).toBe('active');
  });

  it('show pushes the existing active slide to the library before installing the new one', async () => {
    const state = makeState();
    const { sink } = makeSink();
    await executeTool('slide', { action: 'show', title: 'First', content: 'one' }, {
      state, sink, callId: 'c1',
    });
    const firstId = state.activeSlide!.id;
    await executeTool('slide', { action: 'show', title: 'Second', content: 'two' }, {
      state, sink, callId: 'c2',
    });

    expect(state.activeSlide!.title).toBe('Second');
    expect(state.slideLibrary).toHaveLength(1);
    expect(state.slideLibrary[0].id).toBe(firstId);
  });

  it('showArtifact pulls content from an existing artifact', async () => {
    const state = makeState();
    const { sink } = makeSink();
    await executeTool('artifact', {
      action: 'create',
      name: 'pitch.md',
      content: '# Pitch\nMain points.',
      type: 'md',
    }, { state, sink, callId: 'c0' });
    const artifactId = Object.keys(state.artifacts)[0];

    const resp = await executeTool('slide', {
      action: 'showArtifact',
      artifactId,
    }, { state, sink, callId: 'c1' });

    expect(resp.status).toBe('success');
    expect(state.activeSlide!.content).toContain('Main points');
    expect(state.activeSlide!.artifactId).toBe(artifactId);
  });

  it('list returns the library plus the active slide marked (active)', async () => {
    const state = makeState();
    const { sink } = makeSink();
    await executeTool('slide', { action: 'show', title: 'A', content: 'a' }, {
      state, sink, callId: 'c1',
    });
    await executeTool('slide', { action: 'show', title: 'B', content: 'b' }, {
      state, sink, callId: 'c2',
    });

    const resp = await executeTool('slide', { action: 'list' }, {
      state, sink, callId: 'c3',
    });
    expect(resp.status).toBe('success');
    expect(resp.data.slides.map((s: any) => s.title)).toEqual(['A', 'B (active)']);
  });

  it('close removes the active slide when its id matches', async () => {
    const state = makeState();
    const { sink } = makeSink();
    await executeTool('slide', { action: 'show', title: 'Bye', content: 'bye' }, {
      state, sink, callId: 'c1',
    });
    const id = state.activeSlide!.id;

    const resp = await executeTool('slide', { action: 'close', id }, {
      state, sink, callId: 'c2',
    });
    expect(resp.status).toBe('success');
    expect(state.activeSlide).toBeNull();
  });

  it('hide / reveal toggle documentVisible without changing the active slide', async () => {
    const state = makeState();
    const { sink } = makeSink();
    await executeTool('slide', { action: 'show', title: 'A', content: 'a' }, {
      state, sink, callId: 'c1',
    });
    const id = state.activeSlide!.id;

    await executeTool('slide', { action: 'hide' }, { state, sink, callId: 'c2' });
    expect(state.documentVisible).toBe(false);
    expect(state.activeSlide!.id).toBe(id);

    await executeTool('slide', { action: 'reveal' }, { state, sink, callId: 'c3' });
    expect(state.documentVisible).toBe(true);
    expect(state.activeSlide!.id).toBe(id);
  });
});

describe('executeTool - observe (migrated)', () => {
  it('returns the synthesised UI snapshot from state', async () => {
    const state = makeState();
    state.currentScene = 'beach';
    state.sceneVisible = true;
    state.activeSlide = { id: 's1', title: 'Welcome', content: '# hi' };
    state.documentVisible = true;
    state.documentTab = 'active';

    const { sink } = makeSink();
    const resp = await executeTool('observe', {}, { state, sink, callId: 'c1' });
    expect(resp.status).toBe('success');
    expect(resp.data.layout.arrangement).toBe('document-only');
    expect(resp.data.scene.current).toBe('beach');
    expect(resp.data.activeDocument).toEqual({ id: 's1', name: 'Welcome', kind: 'document' });
    expect(resp.data.conversation.currentAgent).toEqual({ key: 'coach', name: 'Coach' });
  });

  it('includes currentRev and focusedRev on artifact-backed slides', async () => {
    const state = makeState();
    const { sink } = makeSink();
    await executeTool(
      'artifact',
      { action: 'create', name: 'Doc', content: '# v1', type: 'markdown' },
      { state, sink, callId: 'c0' },
    );
    const artifactId = Object.keys(state.artifacts)[0];
    await executeTool('artifact', { action: 'edit', id: artifactId, content: '# v2' }, {
      state, sink, callId: 'c0b',
    });
    state.activeSlide = {
      id: 'slide1',
      title: 'Doc',
      content: '# v2',
      artifactId,
    };
    state.documentVisible = true;

    const resp = await executeTool('observe', {}, { state, sink, callId: 'c1' });
    expect(resp.status).toBe('success');
    expect(resp.data.activeDocument).toMatchObject({
      id: 'slide1',
      name: 'Doc',
      kind: 'artifact',
      currentRev: 2,
      focusedRev: 2,
    });
  });

  it('reflects notes added via the migrated note tool', async () => {
    const state = makeState();
    const { sink } = makeSink();
    await executeTool('note', { action: 'display', content: 'reminder', color: 'yellow' }, {
      state, sink, callId: 'c1',
    });

    const resp = await executeTool('observe', {}, { state, sink, callId: 'c2' });
    expect(resp.status).toBe('success');
    expect(resp.data.notes.count).toBe(1);
    expect(resp.data.notes.items[0]).toMatchObject({
      title: 'reminder',
      color: 'yellow',
    });
  });
});
