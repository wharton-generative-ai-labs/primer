// Deterministic doc-history fixture for the HAL stub experience.
//
// Drives a fixed sequence of user prompts that should land HAL in
// `artifact.create` → `artifact.edit` → `artifact.edit` → `slide.showArtifact`,
// which is the canonical "Document revision testing" path documented in
// `storage/hal-test-stub/resources/instructions/agent/hal.md`.
//
// The harness's `artifact` handler is in-memory (see `tools.ts`), so this
// fixture verifies the *agent protocol* — the model picks the right tools,
// the right actions, and the right ids — not the on-disk rev pipeline.
// The on-disk pipeline is covered by the storage integration tests
// (`src/app/lib/artifacts/__tests__/storage.test.ts`); the live UI flow is
// covered by the RTL tests + the manual smoke in
// `ai_context/document-history.md`.
//
// Usage: `npm run harness:doc-history` (no flags). Set `HARNESS_DOC_HISTORY_VERBOSE=1`
// to keep stdout chatty; otherwise the harness runs in --silent mode and
// only the final summary is printed.

import './preamble';
import { Harness } from '../Harness';
import { stateSnapshot } from '../state';

const SCRIPT: ReadonlyArray<string> = [
  // 1. Initial draft. Asks for a doc by name + content so HAL has no excuse
  //    to skip the create step or pick a different tool.
  'Create a markdown artifact named "Demo Doc" with this content: "# Demo\\nFirst draft." Show it on the document panel.',
  // 2. First edit — exercises the rev-2 path.
  'Edit Demo Doc so its content reads: "# Demo\\nSecond draft."',
  // 3. Second edit — exercises rev-3 + lastAuthor refresh.
  'Edit Demo Doc one more time so its content reads: "# Demo\\nThird and final draft."',
  // 4. Confirm-via-show. Re-pinning the artifact to the document panel
  //    catches regressions where the agent edits but forgets to re-show.
  'Show the latest version of Demo Doc on the document panel.',
];

async function main() {
  const harness = new Harness();
  const verbose = process.env.HARNESS_DOC_HISTORY_VERBOSE === '1';

  await harness.boot({
    experienceId: 'hal-test-stub',
    silent: !verbose,
  });
  await harness.kickoff();

  for (const [i, line] of SCRIPT.entries()) {
    process.stdout.write(`\n[doc-history] turn ${i + 1}/${SCRIPT.length}: ${line}\n`);
    await harness.send(line);
  }

  const snap = stateSnapshot(harness.getState());
  process.stdout.write('\n[doc-history] final state snapshot:\n');
  process.stdout.write(JSON.stringify(snap, null, 2));
  process.stdout.write('\n');

  // Spot-check: harness `artifact` handler stores creations under
  // state.artifacts; if HAL didn't create anything, the rev pipeline path
  // never got a chance to fire. Exit non-zero so CI / scripted runs can
  // detect the regression.
  const artifactCount = snap.artifacts.length;
  if (artifactCount === 0) {
    process.stderr.write('[doc-history] FAIL: agent created zero artifacts — script did not exercise the rev path.\n');
    await harness.shutdown('doc-history-fail');
    process.exit(1);
  }

  process.stdout.write(`[doc-history] ok — ${artifactCount} artifact(s) created. session log → ${harness.getRunFile()}\n`);
  await harness.shutdown('doc-history-ok');
}

main().catch(async (e) => {
  process.stderr.write(`[doc-history] crash: ${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exit(1);
});
