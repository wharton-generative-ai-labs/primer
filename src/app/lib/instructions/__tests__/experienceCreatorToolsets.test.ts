/**
 * Toolset hygiene tests for the experience-creator's backend subagents.
 *
 * Background: in QA we observed builds where the experience-builder produced
 * a phaseless shell — `agents: {}`, no `resources/` directory, no
 * `workflowPhases`. Forensics on the resulting `experience.json` (e.g.
 * `storage/<id>/experience.json`) matched the literal output of
 * `createExperience` (`src/app/api/backend-agent/utils/context.ts:315-334`),
 * not `copyTemplate`. The mandatory build sequence in
 * `experience-builder.md` is `listTemplateExperiences -> copyTemplate ->
 * deployBuildArtifacts`, but the toolset still exposed `createExperience`
 * and the agent silently fell back to it under degradation or a transient
 * `copyTemplate` error.
 *
 * The structural fix removes `createExperience` from both backend toolsets
 * the experience-creator owns so the builder physically cannot take that
 * path. These tests pin the toolsets to keep the escape hatch closed.
 */

import fs from 'fs';
import path from 'path';

const EXPERIENCE_JSON_PATH = path.join(
  process.cwd(),
  'storage/experience-creator/experience.json',
);

interface ExperienceCreatorConfig {
  toolSets?: Record<string, string[]>;
}

function loadConfig(): ExperienceCreatorConfig {
  const raw = fs.readFileSync(EXPERIENCE_JSON_PATH, 'utf-8');
  return JSON.parse(raw) as ExperienceCreatorConfig;
}

describe('experience-creator toolset hygiene', () => {
  if (!fs.existsSync(EXPERIENCE_JSON_PATH)) {
    it.skip('skipped — experience.json not present in this checkout', () => {});
    return;
  }
  const cfg = loadConfig();
  const backendSubagentTools = cfg.toolSets?.['backend-subagent-tools'];
  const designAgentTools = cfg.toolSets?.['design-agent-tools'];

  it('declares both backend-subagent-tools and design-agent-tools', () => {
    expect(Array.isArray(backendSubagentTools)).toBe(true);
    expect(Array.isArray(designAgentTools)).toBe(true);
  });

  describe('backend-subagent-tools (used by experience-builder)', () => {
    it('does NOT include createExperience (forces copyTemplate path)', () => {
      // The build pipeline must always go through copyTemplate so the new
      // experience inherits workflowPhases, agents, scenes, and supplemental
      // files from the template. Exposing createExperience opens a silent
      // fallback that produces a phaseless shell.
      expect(backendSubagentTools).not.toContain('createExperience');
    });

    it('includes copyTemplate (the only sanctioned path to mint an experience)', () => {
      expect(backendSubagentTools).toContain('copyTemplate');
    });

    it('includes the canonical build deploy tool', () => {
      // deployBuildArtifacts is what discovers the six canonical slugs and
      // deploys them in one call (see deployBuildArtifacts in
      // src/app/lib/tools/experience/experience.ts). Without it the builder
      // would have to fall back to per-artifact deployArtifact calls and
      // re-introduce the UUID-fabrication failure mode.
      expect(backendSubagentTools).toContain('deployBuildArtifacts');
    });
  });

  describe('design-agent-tools (used by design-agent)', () => {
    it('does NOT include createExperience (design-agent only emits artifacts)', () => {
      // Defensive: design-agent has no legitimate reason to mint experiences.
      // Stripping the tool prevents a hypothetical regression where it tries.
      expect(designAgentTools).not.toContain('createExperience');
    });
  });
});
