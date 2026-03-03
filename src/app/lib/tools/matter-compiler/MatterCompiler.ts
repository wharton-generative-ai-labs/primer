import { Experience, AgentOperation, SceneOperation, ExperienceOperation, MatterCompilerContext } from './types';

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