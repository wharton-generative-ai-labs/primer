/**
 * Lint tests for the experience-builder agent's instruction file.
 *
 * Background: in QA Round 3 the orchestrator successfully fetched real
 * artifact slug ids (`mentor_prompt`, `mentor_scene`, ...) but then passed
 * fabricated UUIDs (`a93aff87-...`) to `agent.delegate({ artifactIds })`
 * — and the experience-builder happily relayed those UUIDs into
 * `deployArtifact`, where they 404'd. The most plausible cause was the
 * placeholder copy in `experience-builder.md` itself, which prompted the
 * model to assume artifact ids are UUIDs:
 *
 *   - `"artifactId": "[artifact-uuid]"`
 *   - `"artifactId": "mentor-prompt-artifact-id"`
 *   - `"artifactId": "mentor-scene-image-artifact-id"`
 *
 * These tests pin the file so we don't regress back to UUID-shaped
 * placeholders. Concrete slug examples (`mentor_prompt`, etc.) keep the
 * model anchored on the real shape.
 */

import fs from 'fs';
import path from 'path';

const PROMPT_PATH = path.join(
  process.cwd(),
  'storage/experience-creator/resources/instructions/agent/experience-builder.md',
);

function read(): string {
  if (!fs.existsSync(PROMPT_PATH)) {
    throw new Error(`fixture missing: ${PROMPT_PATH}`);
  }
  return fs.readFileSync(PROMPT_PATH, 'utf-8');
}

describe('experience-builder.md prompt hygiene', () => {
  const body = read();

  it('does not contain the [artifact-uuid] placeholder', () => {
    expect(body).not.toMatch(/\[artifact-uuid\]/);
  });

  it('does not contain the *-artifact-id placeholder pattern', () => {
    // `mentor-prompt-artifact-id`, `mentor-scene-image-artifact-id`, etc.
    expect(body).not.toMatch(/[a-z]+-artifact-id/);
  });

  it('does not refer to artifact ids as UUIDs', () => {
    // It IS legitimate to call template ids UUIDs (they are). But artifact
    // ids must never be described as UUIDs. Check for the two specific
    // legacy phrasings.
    expect(body).not.toMatch(/will be a UUID like .a1b2c3d4-uuid/);
    expect(body).not.toMatch(/artifact-uuid/);
  });

  it('shows concrete slug examples for the canonical build artifacts', () => {
    // These four slugs are the stable contract the Casting Director and
    // Image Generation Agent publish under. The prompt must call them out
    // as examples so the model uses them verbatim.
    expect(body).toContain('mentor_prompt');
    expect(body).toContain('practice_prompt');
    expect(body).toContain('feedback_prompt');
    expect(body).toContain('mentor_scene');
  });

  it('explicitly states that artifact ids are slugs not UUIDs', () => {
    // Anchor the model on the format. The text below ships in the
    // "Artifact Ids vs. Template Ids" subsection.
    expect(body).toMatch(/artifact ids? are slugs/i);
    expect(body).toMatch(/are NOT UUIDs/i);
  });

  describe('Voice Selection — canonical list must stay inline', () => {
    // QA Round 4 produced an experience with `voice: "emerald"` because the
    // prompt only referenced a few example voices and pointed at an external
    // `voices.md` reference. The agent hallucinated values not in the list.
    // The canonical OpenAI Realtime voice list now ships INLINE in this
    // file so the agent never has to remember it. Keep it that way.
    const CANONICAL_VOICES = [
      'alloy',
      'ash',
      'ballad',
      'coral',
      'echo',
      'sage',
      'shimmer',
      'verse',
      'marin',
      'cedar',
    ];

    it.each(CANONICAL_VOICES)(
      'lists "%s" as an allowed voice',
      (voice) => {
        // The full list ships as a markdown table row like `| \`alloy\`   | us, female |`.
        // Match the backticked voice token to avoid false positives on prose.
        const re = new RegExp('`' + voice + '`');
        expect(body).toMatch(re);
      },
    );

    it('explicitly tells the agent NOT to invent voice names', () => {
      // The "do not invent" sentence is the load-bearing guardrail. If it
      // disappears the model drifts again.
      expect(body).toMatch(/do not invent/i);
    });

    it('calls out emerald (the QA Round 4 hallucination) as forbidden', () => {
      // Naming the specific bad value gives the model a concrete negative
      // example to refuse, which is more reliable than abstract guidance.
      expect(body).toMatch(/emerald/);
    });
  });
});

const EXPERIENCE_JSON_PATH = path.join(
  process.cwd(),
  'storage/experience-creator/experience.json',
);

describe('experience-creator/experience.json build phase coldStart hygiene', () => {
  const cfg = JSON.parse(fs.readFileSync(EXPERIENCE_JSON_PATH, 'utf-8'));
  const buildPhase = cfg.workflowPhases?.find((p: any) => p.id === 'build');
  const coldStart: string = buildPhase?.promptFragments?.coldStart ?? '';

  it('build phase exists with a coldStart fragment', () => {
    expect(buildPhase).toBeDefined();
    expect(coldStart.length).toBeGreaterThan(0);
  });

  it('reinforces slug-format guidance for artifactIds passed to experience-builder', () => {
    // The orchestrator must tell the experience-builder which artifacts to
    // deploy. If the coldStart is silent on the slug-vs-UUID distinction
    // (or, worse, suggests UUIDs), the model fabricates UUIDs. Guard
    // against that drift.
    expect(coldStart).toMatch(/slug/i);
    expect(coldStart).not.toMatch(/\[artifact-uuid\]/);
  });
});
