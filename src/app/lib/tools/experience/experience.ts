import { ToolContext, ToolResponse } from '@/app/lib/tools/types';
import { ExperienceToolContext } from './types';

/**
 * @tool createExperience
 * @description Create a new experience with a randomly generated ID.
 * @param {object} args - The arguments for the tool
 * @param {object} context - The context object
 * @param {Function} context.createExperience - Function to create a new experience
 * @returns {Promise<ToolResponse>} Tool response object with the new experience ID
 */
export async function createExperience(_args: any, context: ToolContext): Promise<ToolResponse> {
  const experienceContext = context as ExperienceToolContext;
  if (!experienceContext.createExperience) {
    return {
      status: 'error',
      data: { error: 'createExperience not available in context' }
    };
  }
  
  try {
    const experienceId = await experienceContext.createExperience();
    return {
      status: 'success',
      data: {
        experienceId
      }
    };
  } catch (error) {
    return {
      status: 'error',
      data: { error: error instanceof Error ? error.message : 'Failed to create experience' }
    };
  }
}

/**
 * @tool copyTemplate
 * @description Create a new experience by copying from a template experience. This copies the entire directory structure, including experience.json, supplemental files, and directory structure.
 * @param {object} args - The arguments for the tool
 * @param {string} args.templateExperienceId - The ID of the template experience to copy from
 * @param {object} context - The context object
 * @param {Function} context.copyTemplate - Function to copy a template experience
 * @returns {Promise<ToolResponse>} Tool response object with the new experience ID
 */
export async function copyTemplate(
  args: { templateExperienceId: string },
  context: ToolContext
): Promise<ToolResponse> {
  const experienceContext = context as ExperienceToolContext;
  if (!experienceContext.copyTemplate) {
    return {
      status: 'error',
      data: { error: 'copyTemplate not available in context' }
    };
  }
  
  try {
    const newExperienceId = await experienceContext.copyTemplate(args.templateExperienceId);
    return {
      status: 'success',
      data: {
        experienceId: newExperienceId
      }
    };
  } catch (error) {
    return {
      status: 'error',
      data: { error: error instanceof Error ? error.message : 'Failed to copy template' }
    };
  }
}

/**
 * @tool createDirectory
 * @description Create a new directory in an experience.
 * @param {object} args - The arguments for the tool
 * @param {string} args.experienceId - The ID of the experience
 * @param {string} args.path - The path of the directory to create
 * @param {object} context - The context object
 * @param {Function} context.createDirectory - Function to create a directory
 * @returns {Promise<ToolResponse>} Tool response object
 */
export async function createDirectory(
  args: { experienceId?: string; path: string },
  context: ToolContext
): Promise<ToolResponse> {
  const experienceContext = context as ExperienceToolContext;
  if (!experienceContext.createDirectory) {
    return {
      status: 'error',
      data: { error: 'createDirectory not available in context' }
    };
  }
  
  // Default to current experience if not specified
  const targetExperienceId = args.experienceId || context.experienceId;
  
  if (!targetExperienceId) {
    return {
      status: 'error',
      data: { error: 'experienceId must be provided or available in context' }
    };
  }
  
  try {
    await experienceContext.createDirectory(targetExperienceId, args.path);
    return {
      status: 'success',
      data: { success: true }
    };
  } catch (error) {
    return {
      status: 'error',
      data: { error: error instanceof Error ? error.message : 'Failed to create directory' }
    };
  }
}

/**
 * @tool createFile
 * @description Create a new file in an experience.
 * @param {object} args - The arguments for the tool
 * @param {string} args.experienceId - Optional: The ID of the experience. Defaults to current experience.
 * @param {string} args.path - The path of the file to create
 * @param {string} args.content - The content of the file
 * @param {object} context - The context object
 * @param {Function} context.createFile - Function to create a file
 * @returns {Promise<ToolResponse>} Tool response object
 */
export async function createFile(
  args: { experienceId?: string; path: string; content: string },
  context: ToolContext
): Promise<ToolResponse> {
  const experienceContext = context as ExperienceToolContext;
  if (!experienceContext.createFile) {
    return {
      status: 'error',
      data: { error: 'createFile not available in context' }
    };
  }
  
  // Default to current experience if not specified
  const targetExperienceId = args.experienceId || context.experienceId;
  
  if (!targetExperienceId) {
    return {
      status: 'error',
      data: { error: 'experienceId must be provided or available in context' }
    };
  }
  
  try {
    await experienceContext.createFile(targetExperienceId, args.path, args.content);
    return {
      status: 'success',
      data: { success: true }
    };
  } catch (error) {
    return {
      status: 'error',
      data: { error: error instanceof Error ? error.message : 'Failed to create file' }
    };
  }
}

/**
 * @tool deleteDirectory
 * @description Delete a directory in an experience.
 * @param {object} args - The arguments for the tool
 * @param {string} args.experienceId - Optional: The ID of the experience. Defaults to current experience.
 * @param {string} args.path - The path of the directory to delete
 * @param {object} context - The context object
 * @param {Function} context.deleteDirectory - Function to delete a directory
 * @returns {Promise<ToolResponse>} Tool response object
 */
export async function deleteDirectory(
  args: { experienceId?: string; path: string },
  context: ToolContext
): Promise<ToolResponse> {
  const experienceContext = context as ExperienceToolContext;
  if (!experienceContext.deleteDirectory) {
    return {
      status: 'error',
      data: { error: 'deleteDirectory not available in context' }
    };
  }
  
  // Default to current experience if not specified
  const targetExperienceId = args.experienceId || context.experienceId;
  
  if (!targetExperienceId) {
    return {
      status: 'error',
      data: { error: 'experienceId must be provided or available in context' }
    };
  }
  
  try {
    await experienceContext.deleteDirectory(targetExperienceId, args.path);
    return {
      status: 'success',
      data: { success: true }
    };
  } catch (error) {
    return {
      status: 'error',
      data: { error: error instanceof Error ? error.message : 'Failed to delete directory' }
    };
  }
}

/**
 * @tool deleteFile
 * @description Delete a file in an experience.
 * @param {object} args - The arguments for the tool
 * @param {string} args.experienceId - Optional: The ID of the experience. Defaults to current experience.
 * @param {string} args.path - The path of the file to delete
 * @param {object} context - The context object
 * @param {Function} context.deleteFile - Function to delete a file
 * @returns {Promise<ToolResponse>} Tool response object
 */
export async function deleteFile(
  args: { experienceId?: string; path: string },
  context: ToolContext
): Promise<ToolResponse> {
  const experienceContext = context as ExperienceToolContext;
  if (!experienceContext.deleteFile) {
    return {
      status: 'error',
      data: { error: 'deleteFile not available in context' }
    };
  }
  
  // Default to current experience if not specified
  const targetExperienceId = args.experienceId || context.experienceId;
  
  if (!targetExperienceId) {
    return {
      status: 'error',
      data: { error: 'experienceId must be provided or available in context' }
    };
  }
  
  try {
    await experienceContext.deleteFile(targetExperienceId, args.path);
    return {
      status: 'success',
      data: { success: true }
    };
  } catch (error) {
    return {
      status: 'error',
      data: { error: error instanceof Error ? error.message : 'Failed to delete file' }
    };
  }
}

/**
 * @tool moveFile
 * @description Move a file in an experience.
 * @param {object} args - The arguments for the tool
 * @param {string} args.experienceId - Optional: The ID of the experience. Defaults to current experience.
 * @param {string} args.sourcePath - The source path of the file
 * @param {string} args.destinationPath - The destination path of the file
 * @param {object} context - The context object
 * @param {Function} context.moveFile - Function to move a file
 * @returns {Promise<ToolResponse>} Tool response object
 */
export async function moveFile(
  args: { experienceId?: string; sourcePath: string; destinationPath: string },
  context: ToolContext
): Promise<ToolResponse> {
  const experienceContext = context as ExperienceToolContext;
  if (!experienceContext.moveFile) {
    return {
      status: 'error',
      data: { error: 'moveFile not available in context' }
    };
  }
  
  // Default to current experience if not specified
  const targetExperienceId = args.experienceId || context.experienceId;
  
  if (!targetExperienceId) {
    return {
      status: 'error',
      data: { error: 'experienceId must be provided or available in context' }
    };
  }
  
  try {
    await experienceContext.moveFile(targetExperienceId, args.sourcePath, args.destinationPath);
    return {
      status: 'success',
      data: { success: true }
    };
  } catch (error) {
    return {
      status: 'error',
      data: { error: error instanceof Error ? error.message : 'Failed to move file' }
    };
  }
}

/**
 * @tool moveDirectory
 * @description Move a directory in an experience.
 * @param {object} args - The arguments for the tool
 * @param {string} args.experienceId - Optional: The ID of the experience. Defaults to current experience.
 * @param {string} args.sourcePath - The source path of the directory
 * @param {string} args.destinationPath - The destination path of the directory
 * @param {object} context - The context object
 * @param {Function} context.moveDirectory - Function to move a directory
 * @returns {Promise<ToolResponse>} Tool response object
 */
export async function moveDirectory(
  args: { experienceId?: string; sourcePath: string; destinationPath: string },
  context: ToolContext
): Promise<ToolResponse> {
  const experienceContext = context as ExperienceToolContext;
  if (!experienceContext.moveDirectory) {
    return {
      status: 'error',
      data: { error: 'moveDirectory not available in context' }
    };
  }
  
  // Default to current experience if not specified
  const targetExperienceId = args.experienceId || context.experienceId;
  
  if (!targetExperienceId) {
    return {
      status: 'error',
      data: { error: 'experienceId must be provided or available in context' }
    };
  }
  
  try {
    await experienceContext.moveDirectory(targetExperienceId, args.sourcePath, args.destinationPath);
    return {
      status: 'success',
      data: { success: true }
    };
  } catch (error) {
    return {
      status: 'error',
      data: { error: error instanceof Error ? error.message : 'Failed to move directory' }
    };
  }
}

/**
 * @tool listResources
 * @description List resources in an experience.
 * @param {object} args - The arguments for the tool
 * @param {string} args.experienceId - Optional: The ID of the experience. Defaults to current experience.
 * @param {object} context - The context object
 * @param {Function} context.listResources - Function to list resources
 * @returns {Promise<ToolResponse>} Tool response object with the list of resources
 */
export async function listResources(
  args: { experienceId?: string },
  context: ToolContext
): Promise<ToolResponse> {
  const experienceContext = context as ExperienceToolContext;
  if (!experienceContext.listResources) {
    return {
      status: 'error',
      data: { error: 'listResources not available in context' }
    };
  }
  
  // Default to current experience if not specified
  const targetExperienceId = args.experienceId || context.experienceId;
  
  if (!targetExperienceId) {
    return {
      status: 'error',
      data: { error: 'experienceId must be provided or available in context' }
    };
  }
  
  try {
    const resources = await experienceContext.listResources(targetExperienceId);
    return {
      status: 'success',
      data: { resources }
    };
  } catch (error) {
    return {
      status: 'error',
      data: { error: error instanceof Error ? error.message : 'Failed to list resources' }
    };
  }
}

/**
 * @tool getResourceContent
 * @description Get the content of a resource in an experience.
 * @param {object} args - The arguments for the tool
 * @param {string} args.experienceId - Optional: The ID of the experience. Defaults to current experience.
 * @param {string} args.path - The path of the resource
 * @param {object} context - The context object
 * @param {Function} context.getResourceContent - Function to get resource content
 * @returns {Promise<ToolResponse>} Tool response object with the resource content
 */
export async function getResourceContent(
  args: { experienceId?: string; path: string },
  context: ToolContext
): Promise<ToolResponse> {
  const experienceContext = context as ExperienceToolContext;
  if (!experienceContext.getResourceContent) {
    return {
      status: 'error',
      data: { error: 'getResourceContent not available in context' }
    };
  }
  
  // Default to current experience if not specified
  const targetExperienceId = args.experienceId || context.experienceId;
  
  if (!targetExperienceId) {
    return {
      status: 'error',
      data: { error: 'experienceId must be provided or available in context' }
    };
  }
  
  try {
    const { content, contentType, isText, fileUrl } = await experienceContext.getResourceContent(targetExperienceId, args.path);
    return {
      status: 'success',
      data: {
        content,
        contentType,
        isText,
        fileUrl
      }
    };
  } catch (error) {
    return {
      status: 'error',
      data: { error: error instanceof Error ? error.message : 'Failed to get resource content' }
    };
  }
}

/**
 * @tool deployArtifact
 * @description Deploy an artifact's content to a specific location in an experience directory. Copies artifact from session storage to permanent experience storage.
 * @param {object} args - The arguments for the tool
 * @param {string} args.artifactId - The ID of the artifact to deploy
 * @param {string} args.experienceId - Optional: The ID of the target experience. Defaults to current experience.
 * @param {string} args.destinationPath - The path within the experience where the file should be copied
 * @param {string} args.fileName - Optional: New filename (if different from artifact name). If not provided, uses artifact name with appropriate extension.
 * @param {object} context - The context object
 * @param {Function} context.getArtifact - Function to get an artifact by ID
 * @param {Function} context.createFile - Function to create a file in experience
 * @param {Function} context.createDirectory - Function to create directories in experience
 * @returns {Promise<ToolResponse>} Tool response object
 */
export async function deployArtifact(args: {
    artifactId: string;
    experienceId?: string;
    destinationPath: string;
    fileName?: string;
}, context: ToolContext): Promise<ToolResponse> {
    const experienceContext = context as ExperienceToolContext & { getArtifact?: (id: string) => Promise<{ name: string; type: string; content: string } | null> };
    
    if (!experienceContext.getArtifact || !experienceContext.createFile || !experienceContext.createDirectory) {
        return {
            status: 'error',
            data: { error: 'Required context functions not available' }
        };
    }

    // Default to current experience if not specified
    const targetExperienceId = args.experienceId || context.experienceId;
    
    if (!targetExperienceId) {
        return {
            status: 'error',
            data: { error: 'experienceId must be provided or available in context' }
        };
    }

    try {
        // Get the artifact
        const artifact = await experienceContext.getArtifact(args.artifactId);
        if (!artifact) {
            return {
                status: 'error',
                data: { error: `Artifact ${args.artifactId} not found` }
            };
        }

        // Import path utility and artifact utils
        const path = await import('path');
        const { getFileExtensionForType, createSafeFilename, isBinaryFileType } = await import('@/app/lib/artifact-utils');

        // Determine the filename to use
        let fileName = args.fileName;
        if (!fileName) {
            // Use the artifact name with the appropriate extension
            const extension = getFileExtensionForType(artifact.type);
            // Create safe filename from artifact name
            const safeName = createSafeFilename(artifact.name);
            fileName = `${safeName}.${extension}`;
        }

        // Create the full destination path
        const fullDestinationPath = path.join(args.destinationPath, fileName);

        // Create the directory if it doesn't exist
        const destinationDir = path.dirname(fullDestinationPath);
        if (destinationDir && destinationDir !== '.') {
            await experienceContext.createDirectory(targetExperienceId, destinationDir);
        }

        // Copy the content
        if (isBinaryFileType(artifact.type)) {
            // For binary files, pass the base64 content directly with encoding flag
            await experienceContext.createFile(targetExperienceId, fullDestinationPath, artifact.content, 'base64');
        } else {
            // For text files, write the content directly
            await experienceContext.createFile(targetExperienceId, fullDestinationPath, artifact.content);
        }

        return {
            status: 'success',
            data: {
                message: `Artifact ${artifact.name} deployed to ${fullDestinationPath}`,
                artifactId: args.artifactId,
                artifactName: artifact.name,
                artifactType: artifact.type,
                destinationPath: fullDestinationPath,
                fileName: fileName
            }
        };
    } catch (error) {
        const logger = (await import('@/lib/logger')).createModuleLogger('experience-plugin');
        logger.error(error, 'deployArtifact error');
        return {
            status: 'error',
            data: { error: error instanceof Error ? error.message : 'Failed to deploy artifact to experience' }
        };
    }
}

/**
 * @tool generateComponentStyles
 * @description Generate Tailwind CSS styles for a component by running Tailwind CLI against the component JSX file. Creates a companion .css file next to the .jsx file.
 * @param {string} args.componentId - The ID/name of the component (e.g., 'simple-counter')
 * @param {string} args.experienceId - Optional: The ID of the experience. Defaults to current experience.
 * @param {object} context - The context object
 * @returns {Promise<ToolResponse>} Tool response with CSS generation result
 */
export async function generateComponentStyles(
    args: { componentId: string; experienceId?: string },
    context: ToolContext
): Promise<ToolResponse> {
    const logger = (await import('@/lib/logger')).createModuleLogger('experience-plugin');
    const { execSync } = await import('child_process');
    const path = await import('path');
    const { StorageServiceFactory } = await import('@/app/lib/storage/StorageServiceFactory');
    
    try {
        const { componentId } = args;
        const experienceId = args.experienceId || context.experienceId;
        
        if (!experienceId) {
            return {
                status: 'error',
                data: { error: 'experienceId must be provided or available in context' }
            };
        }
        
        logger.info(`Generating CSS for component: ${componentId} in experience: ${experienceId}`);
        
        const storageRoot = StorageServiceFactory.getStorageRoot();
        
        const componentPath = path.join(
            storageRoot,
            experienceId,
            'resources',
            'components',
            `${componentId}.jsx`
        );
        
        const cssPath = componentPath.replace('.jsx', '.css');
        
        // Run Tailwind CLI to generate CSS
        try {
            execSync(
                `npx tailwindcss --content "${componentPath}" -o "${cssPath}" --minify`,
                { 
                    cwd: process.cwd(),
                    stdio: 'pipe' // Suppress output
                }
            );
            
            logger.info(`Successfully generated CSS: ${cssPath}`);
            
            return {
                status: 'success',
                data: {
                    componentId,
                    experienceId,
                    cssFile: `resources/components/${componentId}.css`,
                    message: `CSS generated successfully for ${componentId}`
                }
            };
        } catch (execError) {
            const errorMessage = execError instanceof Error ? execError.message : 'Unknown error';
            logger.error(`Tailwind CLI execution failed: ${errorMessage}`);
            
            return {
                status: 'error',
                data: { 
                    error: `Failed to generate CSS: ${errorMessage}`,
                    componentId,
                    experienceId
                }
            };
        }
    } catch (error) {
        logger.error(error, 'Error generating component styles');
        return {
            status: 'error',
            data: { 
                error: error instanceof Error ? error.message : 'Failed to generate component styles'
            }
        };
    }
}

/**
 * @tool validateComponent
 * @description Validate custom React component JSX code before deployment.
 * Checks for syntax errors, security issues, required exports, and Primer integration patterns.
 * This is a server-side validation that runs directly in the backend agent context.
 * @param {object} args - The arguments for the tool
 * @param {string} args.code - The JSX component code to validate
 * @param {string} args.componentId - The ID/name of the component
 * @param {string} args.experienceId - Optional: The ID of the experience (for context). Defaults to current experience.
 * @param {object} context - The context object
 * @returns {Promise<ToolResponse>} Tool response with validation result
 */
export async function validateComponent(
    args: { code: string; componentId: string; experienceId?: string },
    context: ToolContext
): Promise<ToolResponse> {
    const logger = (await import('@/lib/logger')).createModuleLogger('experience-plugin');
    
    try {
        const { code, componentId } = args;
        const _experienceId = args.experienceId || context.experienceId || 'unknown';
        
        logger.info(`Validating component: ${componentId}`);
        
        // Use enhanced validation
        const { validateComponentCode, formatValidationResult } = await import('./componentValidation');
        const validationResult = validateComponentCode(code, componentId);
        const formattedResult = formatValidationResult(validationResult, componentId);
        
        if (validationResult.valid) {
            logger.info({
                warnings: validationResult.warnings.length,
                usesLibraries: validationResult.stats.usesExternalLibraries
            }, `Component validation passed: ${componentId}`);
            
            // Log warnings if present
            if (validationResult.warnings.length > 0) {
                logger.warn({
                    warnings: validationResult.warnings.map(w => ({
                        category: w.category,
                        message: w.message,
                        suggestion: w.suggestion
                    }))
                }, `Validation warnings for ${componentId}`);
            }
        } else {
            logger.error({
                errorCount: validationResult.errors.length,
                warningCount: validationResult.warnings.length,
                errors: validationResult.errors.map(e => ({
                    category: e.category,
                    message: e.message,
                    suggestion: e.suggestion,
                    line: e.line
                })),
                warnings: validationResult.warnings.map(w => ({
                    category: w.category,
                    message: w.message,
                    suggestion: w.suggestion,
                    line: w.line
                }))
            }, `Component validation failed: ${componentId}`);
        }
        
        if (!validationResult.valid) {
            return {
                status: 'error',
                data: formattedResult
            };
        }
        
        return {
            status: 'success',
            data: formattedResult
        };
    } catch (error) {
        logger.error(error, 'validateComponent error');
        return {
            status: 'error',
            data: {
                valid: false,
                error: error instanceof Error ? error.message : 'Failed to validate component'
            }
        };
    }
}