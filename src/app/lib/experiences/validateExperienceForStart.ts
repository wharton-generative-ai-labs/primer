import path from 'path';

import { ConfigAnalyzer, ValidationIssue } from '@/app/lib/ConfigAnalyzer';
import { ExperienceConfig } from '@/app/lib/types';
import { StorageServiceFactory } from '@/app/lib/storage/StorageServiceFactory';
import { expandToolSets } from '@/app/lib/tools/groups';
import { TOOL_ENV_KEYS } from '@/app/lib/tools/envRequirements';
import { env } from '@/config/env';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('validateExperienceForStart');

const PROVIDER_ENV_KEYS: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_AI_API_KEY',
};

export interface StartupValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
}

/**
 * Pre-flight validation that gates experience playback. Combines the
 * structural checks in {@link ConfigAnalyzer.validateConfig} with checks that
 * require server-side state — filesystem existence of referenced instruction
 * files and presence of provider API keys in `process.env`.
 *
 * `configText` is the verbatim `experience.json` payload (already loaded by
 * {@link getExperienceBootstrap}). Reusing it avoids a second storage read.
 */
export async function validateExperienceForStart(
  experienceId: string,
  configText: string,
): Promise<StartupValidationResult> {
  const analyzer = new ConfigAnalyzer();
  const issues: ValidationIssue[] = [];

  let parsed: ExperienceConfig;
  try {
    const analysis = await analyzer.analyze(configText);
    issues.push(...analysis.validation.issues);
    parsed = JSON.parse(configText);
  } catch (err) {
    logger.error({ err, experienceId }, 'Pre-flight analyzer failed');
    return {
      isValid: false,
      issues: [
        {
          severity: 'error',
          category: 'structure',
          message: 'experience.json could not be analyzed',
          suggestion: err instanceof Error ? err.message : String(err),
        },
      ],
    };
  }

  // Filesystem checks: instruction + supplemental + artifact files exist.
  const storage = StorageServiceFactory.getInstance();
  const fileChecks: Array<{ path: string; refPath: string }> = [];

  for (const [agentKey, rel] of Object.entries(parsed.resources?.instructions?.agent || {})) {
    if (typeof rel === 'string') {
      fileChecks.push({
        path: path.join(experienceId, rel),
        refPath: `resources.instructions.agent.${agentKey}`,
      });
    }
  }
  for (const [key, rel] of Object.entries(parsed.resources?.instructions?.supplemental || {})) {
    if (typeof rel === 'string') {
      fileChecks.push({
        path: path.join(experienceId, rel),
        refPath: `resources.instructions.supplemental.${key}`,
      });
    }
  }
  for (const artifact of parsed.resources?.artifacts || []) {
    if (artifact.file) {
      fileChecks.push({
        path: path.join(experienceId, artifact.file),
        refPath: `resources.artifacts[${artifact.name}].file`,
      });
    }
  }

  const existence = await Promise.all(
    fileChecks.map(({ path: p }) => storage.fileExists(p).catch(() => false)),
  );
  existence.forEach((exists, i) => {
    if (!exists) {
      issues.push({
        severity: 'error',
        category: 'references',
        message: `Referenced file does not exist: ${fileChecks[i].path}`,
        path: fileChecks[i].refPath,
      });
    }
  });

  // Env checks: each provider declared in aiConfigurations needs its API key.
  const requiredEnvKeys = new Map<string, string>();
  for (const ai of Object.values(parsed.aiConfigurations || {})) {
    if (!ai.provider) continue;
    const envKey = PROVIDER_ENV_KEYS[ai.provider];
    if (envKey) {
      requiredEnvKeys.set(envKey, `provider '${ai.provider}' declared in aiConfigurations`);
    }
  }

  // Env checks: tools with hard provider dependencies (e.g. generateImages →
  // GOOGLE_AI_API_KEY) need their env keys whenever any agent's toolSet
  // resolves to the tool, regardless of which providers aiConfigurations
  // declared.
  if (parsed.configVersion && parsed.configVersion >= 2) {
    const reachableTools = new Set<string>();
    for (const agent of Object.values(parsed.agents || {})) {
      if (!agent.toolSets || agent.toolSets.length === 0) continue;
      try {
        const tools = expandToolSets(agent.toolSets, parsed.toolSets);
        for (const t of tools) reachableTools.add(t);
      } catch {
        // Unknown toolSet name — already flagged by the analyzer.
      }
    }
    for (const toolName of reachableTools) {
      const envKey = TOOL_ENV_KEYS[toolName];
      if (envKey && !requiredEnvKeys.has(envKey)) {
        requiredEnvKeys.set(envKey, `tool '${toolName}' is reachable from at least one agent`);
      }
    }
  }

  for (const [envKey, reason] of requiredEnvKeys) {
    const value = (env as Record<string, string | undefined>)[envKey];
    if (!value || value.length === 0) {
      issues.push({
        severity: 'error',
        category: 'configuration',
        message: `'${envKey}' is not set (${reason})`,
        path: 'aiConfigurations',
        suggestion: `Set ${envKey} in the environment for this experience to run`,
      });
    }
  }

  const isValid = !issues.some(issue => issue.severity === 'error');
  return { isValid, issues };
}
