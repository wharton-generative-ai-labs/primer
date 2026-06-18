// Harness tool dispatch. Every handler here is a thin async wrapper that
// runs the real tool implementation against a `buildHarnessToolContext`-built
// `ToolContext` — so the harness and production share one source of truth for
// every tool's action vocabulary, arg validation, and response shape. The
// harness-specific bit is `HarnessToolContext.ts`, which adapts the canonical
// `ToolContext` capability surface onto `HarnessState`.
//
// Anything not registered here falls through to a generic stub that returns
// status: 'success' with a "noop (harness)" note. That way peripheral tools
// don't crash the loop; they just visibly do nothing. The current stubs:
// `sessionEvent`, `file`, `customComponent` — the harness models none of
// their underlying infrastructure (event log persistence, file uploads,
// dynamic component instantiation). Migrate them when the harness needs to.
//
// Adding a new tool: import the real handler, add a one-line wrapper below.
// If the real handler needs a `ToolContext` capability the harness doesn't
// expose yet, add it to `HarnessToolContext.ts` (mutating `HarnessState`
// directly). For tools that fire `ui.X.Y` socket events, extend the
// `buildSocketShim` switch in `HarnessToolContext.ts` to handle them.

import { HarnessState } from './state';
import type { Sink } from './sink';
import { buildHarnessToolContext } from './HarnessToolContext';
import { scene as realScene } from '@/app/lib/tools/builtin/scene-tool';
import { workflowPhase as realWorkflowPhase } from '@/app/lib/tools/builtin/workflow-phase-tool';
import { finishExperience as realFinishExperience } from '@/app/lib/tools/builtin/finish-experience-tool';
import { information as realInformation } from '@/app/lib/tools/builtin/information-tool';
import { note as realNote } from '@/app/lib/tools/builtin/note-tool';
import { artifact as realArtifact } from '@/app/lib/tools/builtin/artifact-tool';
import { checklist as realChecklist } from '@/app/lib/tools/builtin/checklist-tool';
import { observe as realObserve } from '@/app/lib/tools/builtin/observe-tool';
import { agent as realAgent } from '@/app/lib/tools/builtin/agent-tool';
import { toast as realToast } from '@/app/lib/tools/builtin/toast-tool';
import { sound as realSound } from '@/app/lib/tools/sound/sound';
import { slide as realSlide } from '@/app/lib/tools/ui/slides';

export interface ToolEnv {
  state: HarnessState;
  sink: Sink;
  callId: string;
}

// Aligns with @/app/lib/tools/types.ToolResponse — same shape, kept here as a
// re-export so the rest of the harness doesn't have to reach into the real
// tools package.
export type ToolResponse = { status: 'success' | 'error'; data?: any };
export type HarnessHandler = (args: any, env: ToolEnv) => ToolResponse | Promise<ToolResponse>;

const ok = (data?: any): ToolResponse => ({ status: 'success', data });
const err = (error: string): ToolResponse => ({ status: 'error', data: { error } });

const handlers: Record<string, HarnessHandler> = {
  /** `agent` dispatches through the real handler. The `delegate` action is
   * short-circuited here because the real delegate flow runs backend agents
   * via the delegation pipeline, which the harness doesn't model. `discover`
   * and `transfer` go through the real implementation, which gives us the
   * production-correct downstream-agent validation, name normalization, and
   * response shape — and which fires the existing harness state mutation
   * via `setQueuedAgentTransfer` on the harness context. */
  agent: async (args, env) => {
    if (args.action === 'delegate') {
      return err('delegate not supported in harness v1');
    }
    return realAgent(args, buildHarnessToolContext(env));
  },

  /** `toast` runs the real handler. The harness's `toast` capability emits a
   * `state.change` summary (the harness has no toast UI), so observers see
   * "toast: {title}" in the state feed. */
  toast: async (args, env) => realToast(args, buildHarnessToolContext(env)),

  /** `sound` runs the real handler. The harness's `playSound` records what
   * would have played as a `state.change` summary; `getAvailableSounds`
   * returns `[]` (the harness has no sound catalog). The LLM still gets the
   * production response shape so dispatch logic doesn't drift. */
  sound: async (args, env) => realSound(args, buildHarnessToolContext(env)),

  /** `slide` runs the real handler. The harness's `setDocumentVisible`
   * capability handles `hide`/`reveal` directly; `show`/`showArtifact`/
   * `list`/`close` ride the `ui.slide.*` socket-shim cases in
   * `HarnessToolContext`, which mirror the React-side handler one-for-one. */
  slide: async (args, env) => realSlide(args, buildHarnessToolContext(env)),

  async note(args, env) {
    return realNote(args, buildHarnessToolContext(env));
  },

  async information(args, env) {
    return realInformation(args, buildHarnessToolContext(env));
  },

  // Migrated. `listArtifacts/getArtifact/createArtifact/updateArtifact/
  // deleteArtifact` capabilities are backed by `state.artifacts`.
  async artifact(args, env) {
    return realArtifact(args, buildHarnessToolContext(env));
  },

  // Migrated. Reuses the artifact storage capabilities (checklists are
  // markdown artifacts of type 'checklist'). `showChecklist` flips
  // `activeChecklistId`/`documentVisible`/`documentTab`. Uses
  // `selectedAgentKey` and `agents` for tag-based agent filtering.
  async checklist(args, env) {
    return realChecklist(args, buildHarnessToolContext(env));
  },

  // Migrated. The real `observe` handler emits `ui.observe.request` and
  // awaits a synthesised reply from the socket shim — assembled directly
  // from `HarnessState` (layout, slides, notes, scene, conversation).
  async observe(args, env) {
    return realObserve(args, buildHarnessToolContext(env));
  },

  // Migrated to the shared real-tool handler. The harness no longer maintains
  // a parallel `scene` implementation; HarnessToolContext exposes setScene /
  // showScene / hideScene / getAvailableScenes / addCustomScene / removeCustomScene
  // and the real handler dispatches over those.
  scene(args, env) {
    return realScene(args, buildHarnessToolContext(env));
  },

  // Workflow-phase navigation. Real handler dispatches over
  // setWorkflowPhase / getCurrentWorkflowPhase / getWorkflowPhases /
  // getWorkflowPhaseState / suggestWorkflowPhaseReturn — all wired in
  // HarnessToolContext to call WorkflowPhaseManager.transition directly.
  workflowPhase(args, env) {
    return realWorkflowPhase(args, buildHarnessToolContext(env));
  },

  // Mark the entire experience complete. Idempotent; routes through the
  // manager's `finishExperience` op and emits EXPERIENCE_COMPLETED.
  finishExperience(args, env) {
    return realFinishExperience(args, buildHarnessToolContext(env));
  },

  // sound/toast/sessionEvent/file/customComponent fall through to the
  // generic unknown-tool path in executeTool, which emits a "stub tool"
  // warning — more useful than a silent ok() noop.
};

export async function executeTool(
  name: string,
  args: any,
  env: ToolEnv,
): Promise<ToolResponse> {
  const h = handlers[name];
  if (!h) {
    env.sink.emit({ kind: 'warn', message: `stub tool: ${name}`, detail: { args } });
    return ok({ note: `noop (${name} not implemented in harness)` });
  }
  try {
    return await h(args, env);
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}
