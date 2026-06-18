import { ToolContext, ToolResponse } from '@/app/lib/tools/types';
import { StorageServiceFactory } from '@/app/lib/storage/StorageServiceFactory';
import path from 'path';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('template-tools');

/**
 * Get agent instruction content from a template experience
 */
export async function getTemplateAgentInstructions(
  args: { templateExperienceId: string; agentKey: string },
  _context: ToolContext
): Promise<ToolResponse> {
  try {
    const { templateExperienceId, agentKey } = args;

    // Validate inputs
    if (!templateExperienceId || !agentKey) {
      return {
        status: 'error',
        data: { error: 'Both templateExperienceId and agentKey are required' }
      };
    }

    const storage = StorageServiceFactory.getInstance();
    
    // First, verify the template experience exists and is actually a template
    const experienceConfigPath = path.join(templateExperienceId, 'experience.json');
    
    if (!await storage.fileExists(experienceConfigPath)) {
      return {
        status: 'error',
        data: { error: `Template experience '${templateExperienceId}' not found` }
      };
    }

    const configContent = await storage.readFile(experienceConfigPath);
    const experienceConfig = JSON.parse(configContent.toString());

    // Verify it's a template (check both 'kind' and 'status' fields for backward compatibility)
    const isTemplate = experienceConfig.kind === 'template' || experienceConfig.status === 'template';
    if (!isTemplate) {
      return {
        status: 'error',
        data: { error: `Experience '${templateExperienceId}' is not a template (kind: ${experienceConfig.kind || 'undefined'}, status: ${experienceConfig.status || 'undefined'})` }
      };
    }

    // Get the instruction file path for the agent
    const instructionPath = experienceConfig.resources?.instructions?.agent?.[agentKey];
    
    if (!instructionPath) {
      return {
        status: 'error',
        data: { 
          error: `No instruction file found for agent '${agentKey}' in template '${experienceConfig.title}'. Available agents: ${Object.keys(experienceConfig.resources?.instructions?.agent || {}).join(', ')}` 
        }
      };
    }

    // Read the instruction file
    const fullInstructionPath = path.join(templateExperienceId, instructionPath);
    
    if (!await storage.fileExists(fullInstructionPath)) {
      return {
        status: 'error',
        data: { error: `Instruction file not found at path: ${instructionPath}` }
      };
    }

    const instructionContent = await storage.readFile(fullInstructionPath);

    return {
      status: 'success',
      data: {
        templateTitle: experienceConfig.title,
        templateId: templateExperienceId,
        agentKey,
        instructionPath,
        content: instructionContent.toString(),
        message: `Successfully retrieved ${agentKey} instructions from template '${experienceConfig.title}'`
      }
    };

  } catch (error) {
    logger.error(error, 'getTemplateAgentInstructions error');
    return {
      status: 'error',
      data: { error: `Failed to retrieve template instructions: ${error instanceof Error ? error.message : 'Unknown error'}` }
    };
  }
}

/**
 * List all available template experiences
 */
export async function listTemplateExperiences(
  _args: Record<string, never>,
  _context: ToolContext
): Promise<ToolResponse> {
  try {
    const storage = StorageServiceFactory.getInstance();
    
    // Get all directories in storage root
    const directories = await storage.listDirectories('');
    
    const templates = [];
    
    // Check each directory for template experiences
    for (const dir of directories) {
      const configPath = path.join(dir, 'experience.json');
      
      try {
        if (await storage.fileExists(configPath)) {
          const configContent = await storage.readFile(configPath);
          const config = JSON.parse(configContent.toString());
          
          // Only include experiences with kind: "template" or status: "template" (for backward compatibility)
          if (config.kind === 'template' || config.status === 'template') {
            templates.push({
              id: dir,
              title: config.title || 'Untitled Template',
              description: config.description || 'No description available',
              kind: config.kind || config.status || 'template',
              version: config.version || '1.0',
              agents: Object.keys(config.agents || {}),
              agentInstructions: Object.keys(config.resources?.instructions?.agent || {})
            });
          }
        }
      } catch {
        // Skip invalid config files silently - not critical
        continue;
      }
    }

    // Sort templates by title
    templates.sort((a, b) => a.title.localeCompare(b.title));

    return {
      status: 'success',
      data: {
        templates,
        count: templates.length,
        message: `Found ${templates.length} template experience(s)`
      }
    };

  } catch (error) {
    logger.error(error, 'listTemplateExperiences error');
    return {
      status: 'error',
      data: { error: `Failed to list template experiences: ${error instanceof Error ? error.message : 'Unknown error'}` }
    };
  }
}

