import { Experience, AgentOperation, SceneOperation, ExperienceOperation, MatterCompilerContext } from './types';
import { VALID_VOICES, isValidVoice } from '@/app/lib/voices';

function assertValidAgentVoice(voice: unknown): void {
  // An undefined/empty voice is allowed: legacy templates leave it blank
  // and the realtime layer falls back to the default. We only block
  // explicit-but-unsupported values like "emerald" sneaking onto disk.
  if (voice === undefined || voice === '') {
    return;
  }
  if (!isValidVoice(voice)) {
    const supported = Array.from(VALID_VOICES).sort().join(', ');
    throw new Error(
      `Invalid voice "${String(voice)}". Supported voices: ${supported}.`,
    );
  }
}

/**
 * Guard against malformed `workflowPhases` patches sneaking onto disk via
 * `modifyExperience`. The build agent has been observed JSON.parsing a
 * design-agent artifact with phases shaped
 * `{ title, description, objectives, prompts, activities }` (no `id`,
 * no `initialAgent`, no `promptFragments`) and merging it verbatim — once
 * persisted, the next `loadWorkflowPhases` blew up with
 * `Duplicate workflow phase id: "undefined".` and the experience couldn't
 * advance. We refuse to write at all rather than corrupt the file.
 *
 * Cross-field rule (added after a regression): when either
 * `workflowPhases` or `initialWorkflowPhase` appears in the patch, we also
 * verify that the *merged* `initialWorkflowPhase` (patch ∪ existing) names
 * one of the merged phase ids. The original failure mode was a phase rename
 * (`mentor` → `mentor-phase`, …) that left the existing
 * `initialWorkflowPhase: "mentor"` orphaned; the runtime validator caught it
 * but only at `nextPhase` time, surfacing as a generic 500 to the user.
 */
function assertValidWorkflowPhasesPatch(
  data: ExperienceOperation['data'],
  mergedExperience: Record<string, unknown>,
  mergedAgentKeys: Set<string>,
): void {
  const dataRecord = data as Record<string, unknown>;
  const patchHasPhases = dataRecord.workflowPhases !== undefined;
  const patchHasInitial = dataRecord.initialWorkflowPhase !== undefined;

  // Title-only and other unrelated patches are no-ops here.
  if (!patchHasPhases && !patchHasInitial) {
    return;
  }

  // Per-phase shape validation only runs when the patch touches
  // workflowPhases. The original guard against the design-agent's
  // {title, description, objectives, ...} shape lives here.
  if (patchHasPhases) {
    const phasesRaw = dataRecord.workflowPhases;
    if (!Array.isArray(phasesRaw)) {
      throw new Error(
        `Invalid workflowPhases patch: workflowPhases must be an array, got ${typeof phasesRaw}.`,
      );
    }

    const seenIds = new Set<string>();
    phasesRaw.forEach((phase, index) => {
      if (!phase || typeof phase !== 'object') {
        throw new Error(
          `Workflow phase at index ${index} must be an object, got ${typeof phase}.`,
        );
      }
      const p = phase as Record<string, unknown>;
      const id = p.id;
      if (typeof id !== 'string' || id.length === 0) {
        throw new Error(
          `Workflow phase at index ${index} is missing required "id" field (must be a non-empty string).`,
        );
      }
      if (seenIds.has(id)) {
        throw new Error(`Duplicate workflow phase id "${id}".`);
      }
      seenIds.add(id);

      if (
        p.initialAgent !== undefined &&
        (typeof p.initialAgent !== 'string' ||
          !mergedAgentKeys.has(p.initialAgent))
      ) {
        throw new Error(
          `Workflow phase "${id}" references unknown initialAgent "${String(p.initialAgent)}".`,
        );
      }
      if (
        p.reentryAgent !== undefined &&
        (typeof p.reentryAgent !== 'string' ||
          !mergedAgentKeys.has(p.reentryAgent))
      ) {
        throw new Error(
          `Workflow phase "${id}" references unknown reentryAgent "${String(p.reentryAgent)}".`,
        );
      }

      // satisfiedBy shape validation — symmetric with the runtime loader's
      // check (loadWorkflowPhases) so the build agent can't persist a
      // malformed patch that would only blow up at next load.
      const objectivesRaw = p.objectives;
      if (Array.isArray(objectivesRaw)) {
        objectivesRaw.forEach((o, oi) => {
          if (!o || typeof o !== 'object') return;
          const obj = o as Record<string, unknown>;
          const sb = obj.satisfiedBy;
          if (sb === undefined) return;
          if (!sb || typeof sb !== 'object') {
            throw new Error(
              `Workflow phase "${id}" objective at index ${oi}: satisfiedBy must be an object.`,
            );
          }
          const trigger = sb as Record<string, unknown>;
          const kind = trigger.kind;
          if (kind === 'delegateSuccess') {
            if (typeof trigger.agentType !== 'string' || trigger.agentType.length === 0) {
              throw new Error(
                `Workflow phase "${id}" objective at index ${oi}: satisfiedBy.delegateSuccess requires a non-empty "agentType" string.`,
              );
            }
          } else if (kind === 'artifactPopulated') {
            if (typeof trigger.slug !== 'string' || trigger.slug.length === 0) {
              throw new Error(
                `Workflow phase "${id}" objective at index ${oi}: satisfiedBy.artifactPopulated requires a non-empty "slug" string.`,
              );
            }
          } else {
            throw new Error(
              `Workflow phase "${id}" objective at index ${oi}: unknown satisfiedBy kind "${String(kind)}" (expected "delegateSuccess" or "artifactPopulated").`,
            );
          }
        });
      }
    });
  }

  // Cross-field consistency: initialWorkflowPhase (whether from the patch or
  // already on disk) must name one of the merged phase ids. We skip the
  // check when initialWorkflowPhase is undefined (runtime falls back to
  // phases[0].id) and when there are no phases to validate against.
  const mergedInitial = mergedExperience.initialWorkflowPhase;
  if (typeof mergedInitial !== 'string') {
    return;
  }
  const mergedPhases = mergedExperience.workflowPhases;
  const mergedPhaseIds = Array.isArray(mergedPhases)
    ? new Set(
        mergedPhases
          .map((p) =>
            p && typeof p === 'object'
              ? (p as Record<string, unknown>).id
              : undefined,
          )
          .filter((id): id is string => typeof id === 'string'),
      )
    : new Set<string>();
  if (mergedPhaseIds.size === 0) {
    return;
  }
  if (!mergedPhaseIds.has(mergedInitial)) {
    const idsList = Array.from(mergedPhaseIds).join(', ');
    throw new Error(
      `initialWorkflowPhase "${mergedInitial}" does not match any declared workflow phase id (got: ${idsList}). Either rename a phase to "${mergedInitial}" or set initialWorkflowPhase to one of the declared ids.`,
    );
  }
}

export class MatterCompiler {
  private static instance: MatterCompiler;

  private constructor() {}

  static getInstance(): MatterCompiler {
    if (!MatterCompiler.instance) {
      MatterCompiler.instance = new MatterCompiler();
    }
    return MatterCompiler.instance;
  }

  async getExperience(context: MatterCompilerContext, experienceId: string): Promise<Experience> {
    if (!context.getResourceContent) {
      throw new Error('getResourceContent not available in context');
    }
    
    const content = await context.getResourceContent(experienceId, 'experience.json');
    if (!content.isText) {
      throw new Error('Experience file is not text');
    }
    return JSON.parse(content.content);
  }

  async saveExperience(context: MatterCompilerContext, experienceId: string, experience: Experience): Promise<void> {
    if (!context.createFile) {
      throw new Error('createFile not available in context');
    }
    
    await context.createFile(experienceId, 'experience.json', JSON.stringify(experience, null, 2));
  }

  async modifyExperience(context: MatterCompilerContext, experienceId: string, operation: ExperienceOperation): Promise<void> {
    const experience = await this.getExperience(context, experienceId);
    const now = new Date().toISOString();

    // Merge the operation data
    const updatedExperience = { ...experience, ...operation.data };

    // Validate the patch BEFORE writing. Reject malformed `workflowPhases`
    // arrays so we never persist phases without `id` or with broken agent
    // references, and reject patches that leave `initialWorkflowPhase`
    // pointing at a phase id that doesn't exist in the merged config — see
    // assertValidWorkflowPhasesPatch for context.
    const mergedAgentKeys = new Set(Object.keys(updatedExperience.agents ?? {}));
    assertValidWorkflowPhasesPatch(
      operation.data,
      updatedExperience as unknown as Record<string, unknown>,
      mergedAgentKeys,
    );
    
    // Auto-set metadata fields
    // If created doesn't exist, set it (this is a new experience or old one without metadata)
    if (!updatedExperience.created) {
      updatedExperience.created = now;
    }
    
    // If author fields don't exist and we have userInfo, set them
    if (!updatedExperience.author && (context as any).userInfo?.name) {
      updatedExperience.author = (context as any).userInfo.name;
    }
    if (!updatedExperience.authorEmail && (context as any).userInfo?.email) {
      updatedExperience.authorEmail = (context as any).userInfo.email;
    }
    
    // Always update lastModified
    updatedExperience.lastModified = now;
    
    await this.saveExperience(context, experienceId, updatedExperience);
  }

  async modifyAgent(context: MatterCompilerContext, experienceId: string, operation: AgentOperation): Promise<void> {
    const experience = await this.getExperience(context, experienceId);
    const { type, id, data, setAsInitial } = operation;

    switch (type) {
      case 'create':
        if (!data) {
          throw new Error('Data required for agent creation');
        }
        assertValidAgentVoice(data.voice);
        experience.agents[id] = {
          name: data.name || '',
          voice: data.voice || '',
          publicDescription: data.publicDescription || '',
          downstreamAgents: data.downstreamAgents || []
        };
        break;

      case 'modify':
        if (!experience.agents[id]) {
          throw new Error(`Agent ${id} not found`);
        }
        if (data) {
          assertValidAgentVoice(data.voice);
          experience.agents[id] = { ...experience.agents[id], ...data };
        }
        break;

      case 'delete':
        if (!experience.agents[id]) {
          throw new Error(`Agent ${id} not found`);
        }
        delete experience.agents[id];
        if (experience.initialAgent === id) {
          experience.initialAgent = Object.keys(experience.agents)[0] || '';
        }
        break;
    }

    if (setAsInitial) {
      experience.initialAgent = id;
    }

    await this.saveExperience(context, experienceId, experience);
  }

  async modifyScene(context: MatterCompilerContext, experienceId: string, operation: SceneOperation): Promise<void> {
    const experience = await this.getExperience(context, experienceId);
    const { type, path } = operation;

    switch (type) {
      case 'add':
        if (!experience.resources.scenes.includes(path)) {
          experience.resources.scenes.push(path);
        }
        break;

      case 'delete':
        experience.resources.scenes = experience.resources.scenes.filter(scene => scene !== path);
        break;

      case 'modify':
        // For now, scene modification is just a no-op since scenes are just paths
        break;
    }

    await this.saveExperience(context, experienceId, experience);
  }

  async createAgentPrompt(context: MatterCompilerContext, experienceId: string, agentId: string, promptContent: string): Promise<void> {
    if (!context.createDirectory || !context.createFile) {
      throw new Error('createDirectory or createFile not available in context');
    }

    // Ensure the instructions/agent directory exists
    await context.createDirectory(experienceId, 'resources/instructions/agent');
    
    // Create the prompt file
    const promptPath = `resources/instructions/agent/${agentId}.md`;
    await context.createFile(experienceId, promptPath, promptContent);
    
    // Update the experience.json to include the prompt file
    const experience = await this.getExperience(context, experienceId);
    
    // Initialize resources.instructions.agent if it doesn't exist
    if (!experience.resources.instructions) {
      experience.resources.instructions = {};
    }
    if (!experience.resources.instructions.agent) {
      experience.resources.instructions.agent = {};
    }
    
    // Add the prompt file to the experience
    experience.resources.instructions.agent[agentId] = promptPath;
    
    await this.saveExperience(context, experienceId, experience);
  }

  async createSupplementalFile(context: MatterCompilerContext, experienceId: string, fileName: string, content: string): Promise<void> {
    if (!context.createDirectory || !context.createFile) {
      throw new Error('createDirectory or createFile not available in context');
    }

    // Ensure the instructions/supplemental directory exists
    await context.createDirectory(experienceId, 'resources/instructions/supplemental');
    
    // Create the supplemental file
    const filePath = `resources/instructions/supplemental/${fileName}.md`;
    await context.createFile(experienceId, filePath, content);
    
    // Update the experience.json to include the supplemental file
    const experience = await this.getExperience(context, experienceId);
    
    // Initialize resources.instructions.supplemental if it doesn't exist
    if (!experience.resources.instructions) {
      experience.resources.instructions = {};
    }
    if (!experience.resources.instructions.supplemental) {
      experience.resources.instructions.supplemental = {};
    }
    
    // Add the supplemental file to the experience
    experience.resources.instructions.supplemental[fileName] = filePath;
    
    await this.saveExperience(context, experienceId, experience);
  }

  async addSound(context: MatterCompilerContext, experienceId: string, soundPath: string): Promise<void> {
    const experience = await this.getExperience(context, experienceId);
    
    // Initialize resources.sounds if it doesn't exist
    if (!experience.resources.sounds) {
      experience.resources.sounds = [];
    }
    
    // Add the sound if it doesn't already exist
    if (!experience.resources.sounds.includes(soundPath)) {
      experience.resources.sounds.push(soundPath);
    }
    
    await this.saveExperience(context, experienceId, experience);
  }

  async listAgentPrompts(context: MatterCompilerContext, experienceId: string): Promise<Record<string, string>> {
    const experience = await this.getExperience(context, experienceId);
    
    if (!experience.resources.instructions || !experience.resources.instructions.agent) {
      return {};
    }
    
    return experience.resources.instructions.agent;
  }

  async getAgentPrompt(context: MatterCompilerContext, experienceId: string, agentId: string): Promise<string | null> {
    const experience = await this.getExperience(context, experienceId);
    
    if (!experience.resources.instructions || !experience.resources.instructions.agent || !experience.resources.instructions.agent[agentId]) {
      return null;
    }
    
    const promptPath = experience.resources.instructions.agent[agentId];
    const content = await context.getResourceContent(experienceId, promptPath);
    
    return content.content;
  }

  async listSupplementalFiles(context: MatterCompilerContext, experienceId: string): Promise<Record<string, string>> {
    const experience = await this.getExperience(context, experienceId);
    
    if (!experience.resources.instructions || !experience.resources.instructions.supplemental) {
      return {};
    }
    
    return experience.resources.instructions.supplemental;
  }

  async getSupplementalFile(context: MatterCompilerContext, experienceId: string, fileName: string): Promise<string | null> {
    const experience = await this.getExperience(context, experienceId);
    
    if (!experience.resources.instructions || !experience.resources.instructions.supplemental || !experience.resources.instructions.supplemental[fileName]) {
      return null;
    }
    
    const filePath = experience.resources.instructions.supplemental[fileName];
    const content = await context.getResourceContent(experienceId, filePath);
    
    return content.content;
  }
}

export function getMatterCompiler(): MatterCompiler {
  return MatterCompiler.getInstance();
} 