import type { ToolContext } from '@/app/lib/tools/types';
import { createModuleLogger } from '@/lib/logger';
import { sendToastNotification } from './toast';

const logger = createModuleLogger('backend-agent-context');

// Helper function to find metadata file by artifact ID
async function findMetadataFileByArtifactId(artifactsFolder: string, artifactId: string, fs: any, path: any): Promise<string | null> {
  try {
    const files = await fs.readdir(artifactsFolder);
    const jsonFiles = files.filter((file: string) => file.endsWith('.json'));
    
    for (const file of jsonFiles) {
      try {
        const filePath = path.join(artifactsFolder, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const metadata = JSON.parse(content);
        if (metadata.id === artifactId) {
          return file;
        }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        // Skip files that can't be parsed
        continue;
      }
    }
    return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return null;
  }
}

// Server-side implementation of all tool context functions
export async function createServerToolContext(
  experienceId: string, 
  sessionId: string, 
  delegationId?: string,
  userInfo?: { name?: string | null; email?: string | null }
): Promise<ToolContext & { sessionId: string; delegationId?: string; userInfo?: { name?: string | null; email?: string | null } }> {
  // Import the required modules for direct file system access
  const { getExperienceArtifactsFolder, getExperienceFolder, generateExperienceId } = await import('@/app/lib/file-utils');
  const { getContentFilename, getMetadataFilename, isBinaryFileType } = await import('@/app/lib/artifact-utils');
  const fs = await import('fs/promises');
  const path = await import('path');
  
  return {
    experienceId,
    functionCallId: `backend_${Date.now()}`,
    sessionId,
    delegationId,
    userInfo,
    
    // Toast notification function - sends toast via WebSocket
    toast: (options: { title: string; variant?: 'default' | 'destructive' }) => {
      // Send toast notification via WebSocket
      sendToastNotification(
        sessionId,
        options.title,
        options.variant === 'destructive' ? 'destructive' : 'default'
      ).catch((error) => {
        logger.error(error, 'Failed to send toast notification');
      });
    },
    
    // Artifact management functions - direct file system access
    listArtifacts: async () => {
      try {
        // No need to initialize from template - artifacts are created directly in user sessions by ConfigLoader

        const artifactsFolder = await getExperienceArtifactsFolder(experienceId, sessionId);

        // Create artifacts folder if it doesn't exist
        try {
          await fs.mkdir(artifactsFolder, { recursive: true });
        } catch (error) {
          logger.warn(error, 'Error creating artifacts folder');
        }

        // List all files in the artifacts folder
        let files = await fs.readdir(artifactsFolder);
        
        // Filter out non-JSON metadata files
        files = files.filter(file => file.endsWith('.json'));

        // Read the metadata of each artifact (content is now in separate files)
        const artifacts = await Promise.all(
          files.map(async (file) => {
            try {
              const filePath = path.join(artifactsFolder, file);
              const content = await fs.readFile(filePath, 'utf-8');
              return JSON.parse(content);
            } catch (error) {
              logger.debug({ file, err: error }, 'Error reading artifact metadata');
              return null;
            }
          })
        );

        // Filter out null results from failed parsing
        const validArtifacts = artifacts.filter(a => a !== null);
        
        return validArtifacts;
      } catch (error) {
        logger.error(error, 'listArtifacts error');
        throw new Error(`Failed to list artifacts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    getArtifact: async (id: string) => {
      try {
        const artifactsFolder = await getExperienceArtifactsFolder(experienceId, sessionId);
        const metadataFilename = await findMetadataFileByArtifactId(artifactsFolder, id, fs, path);
        
        if (!metadataFilename) {
          return null;
        }

        const metadataPath = path.join(artifactsFolder, metadataFilename);
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        const metadata = JSON.parse(metadataContent);

        // Get content filename from metadata
        const contentFilename = metadata.filename;
        if (!contentFilename) {
          logger.warn({ id }, 'getArtifact no content filename in metadata');
          return { 
            ...metadata, 
            content: '',
            isText: true,
            contentType: 'text/plain'
          };
        }

        const contentPath = path.join(artifactsFolder, contentFilename);
        
        // Check if content file exists
        try {
          await fs.access(contentPath);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
          logger.warn({ id, contentPath }, 'getArtifact content file not found');
          return { 
            ...metadata, 
            content: '',
            isText: true,
            contentType: 'text/plain'
          };
        }

        // Read content based on type
        const isText = !isBinaryFileType(metadata.type || 'markdown');
        let content;
        let contentType = 'text/plain';

        if (isText) {
          content = await fs.readFile(contentPath, 'utf-8');
          if (metadata.type === 'markdown') {
            contentType = 'text/markdown';
          }
        } else {
          // For binary files, return base64 encoded content
          const buffer = await fs.readFile(contentPath);
          content = buffer.toString('base64');
          contentType = `image/${metadata.type}`;
        }

        return { 
          ...metadata, 
          content,
          isText,
          contentType
        };
      } catch (error) {
        logger.error(error, 'getArtifact error');
        throw new Error(`Failed to get artifact: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    createArtifact: async (name: string, content: string, type?: string) => {
      try {
        const artifactsFolder = await getExperienceArtifactsFolder(experienceId, sessionId);
        
        // Create artifacts folder if it doesn't exist
        try {
          await fs.mkdir(artifactsFolder, { recursive: true });
        } catch (error) {
          logger.warn(error, 'Error creating artifacts folder');
        }

        const timestamp = new Date().toISOString();

        // Generate meaningful content filename with duplicate handling
        const baseContentFilename = getContentFilename('', type || 'markdown', name);
        let contentFilename = baseContentFilename;
        let counter = 1;
        
        // Check for duplicates and add counter if needed
        while (true) {
          const checkPath = path.join(artifactsFolder, contentFilename);
          try {
            await fs.access(checkPath);
            // File exists, increment counter and try again
            const extension = path.extname(baseContentFilename);
            const nameWithoutExt = path.basename(baseContentFilename, extension);
            contentFilename = `${nameWithoutExt}_(${counter})${extension}`;
            counter++;
          } catch {
            // File doesn't exist, we can use this filename
            break;
          }
        }

        // Use filename (without extension) as the ID
        const id = path.parse(contentFilename).name;
        
        const metadataFilename = getMetadataFilename(contentFilename);

        // Create the artifact metadata (without content)
        const artifact = {
          id,
          name,
          type: type || 'markdown',
          filename: contentFilename, // Add pointer to content file
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        // Save the artifact metadata
        const metadataPath = path.join(artifactsFolder, metadataFilename);
        await fs.writeFile(
          metadataPath,
          JSON.stringify(artifact, null, 2)
        );
        logger.debug({ metadataPath }, 'createArtifact metadata file saved');

        // Save the content in a separate file
        const contentPath = path.join(artifactsFolder, contentFilename);
        logger.debug({ contentPath }, 'createArtifact saving content');
        if (isBinaryFileType(type || 'markdown')) {
          // For binary files, expect content to be base64 encoded
          const buffer = Buffer.from(content, 'base64');
          await fs.writeFile(contentPath, buffer);
          logger.debug('createArtifact binary content file saved');
        } else {
          // For text files, save as UTF-8
          await fs.writeFile(contentPath, content, 'utf-8');
          logger.debug('createArtifact text content file saved');
        }

        logger.debug({ id, name, type: type || 'markdown' }, 'createArtifact completed');
        return artifact;
      } catch (error) {
        logger.error(error, 'createArtifact error');
        throw new Error(`Failed to create artifact: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    updateArtifact: async (id: string, content: string) => {
      logger.debug({ id, contentLength: content.length }, 'updateArtifact called');
      try {
        const artifactsFolder = await getExperienceArtifactsFolder(experienceId, sessionId);
        const metadataFilename = await findMetadataFileByArtifactId(artifactsFolder, id, fs, path);
        
        if (!metadataFilename) {
          throw new Error(`Artifact with id ${id} not found`);
        }

        const metadataPath = path.join(artifactsFolder, metadataFilename);
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        const existingMetadata = JSON.parse(metadataContent);

        const timestamp = new Date().toISOString();

        // Update the artifact metadata
        const updatedArtifact = {
          ...existingMetadata,
          updatedAt: timestamp,
        };

        // Save the updated metadata
        await fs.writeFile(
          metadataPath,
          JSON.stringify(updatedArtifact, null, 2)
        );

        // Update the content file
        const contentFilename = existingMetadata.filename;
        const contentPath = path.join(artifactsFolder, contentFilename);
        
        if (isBinaryFileType(existingMetadata.type)) {
          // For binary files, expect content to be base64 encoded
          const buffer = Buffer.from(content, 'base64');
          await fs.writeFile(contentPath, buffer);
        } else {
          // For text files, save as UTF-8
          await fs.writeFile(contentPath, content, 'utf-8');
        }

        logger.debug({ id, type: existingMetadata.type }, 'updateArtifact completed');
      } catch (error) {
        logger.error(error, 'updateArtifact error');
        throw new Error(`Failed to update artifact: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    deleteArtifact: async (id: string) => {
      logger.debug({ id }, 'deleteArtifact called');
      try {
        const artifactsFolder = await getExperienceArtifactsFolder(experienceId, sessionId);
        const metadataFilename = await findMetadataFileByArtifactId(artifactsFolder, id, fs, path);
        
        if (!metadataFilename) {
          throw new Error(`Artifact with id ${id} not found`);
        }

        const metadataPath = path.join(artifactsFolder, metadataFilename);
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        const metadata = JSON.parse(metadataContent);

        // Delete the content file
        const contentFilename = metadata.filename;
        if (contentFilename) {
          const contentPath = path.join(artifactsFolder, contentFilename);
          try {
            await fs.unlink(contentPath);
            logger.debug({ contentPath }, 'deleteArtifact deleted content file');
          } catch (error) {
            logger.warn(error, 'deleteArtifact error deleting content file');
          }
        }

        // Delete the metadata file
        await fs.unlink(metadataPath);
        logger.debug({ metadataPath }, 'deleteArtifact deleted metadata file');

        logger.debug({ id }, 'deleteArtifact completed');
      } catch (error) {
        logger.error(error, 'deleteArtifact error');
        throw new Error(`Failed to delete artifact: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    createExperience: async () => {
      try {
        const newExperienceId = generateExperienceId();
        const newExperienceFolder = await getExperienceFolder(newExperienceId);
        
        // Check if experience already exists
        try {
          await fs.access(newExperienceFolder);
          throw new Error(`Experience ${newExperienceId} already exists`);
        } catch (error: unknown) {
          if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code !== 'ENOENT') {
            throw error; // Re-throw if it's not a "file not found" error
          }
          // If it's ENOENT, the directory doesn't exist, which is what we want
        }
        
        // Create the experience directory
        await fs.mkdir(newExperienceFolder, { recursive: true });
        
        // Create a basic experience.json file
        const now = new Date().toISOString();
        const basicExperience: any = {
          id: newExperienceId,
          name: `Experience ${newExperienceId}`,
          description: "A new experience",
          version: "1.0.0",
          kind: "user",
          created: now,
          lastModified: now,
          agents: {},
          resources: {
            artifacts: [],
            instructions: {
              agent: {},
              supplemental: {}
            }
          },
          tools: {
            plugins: []
          }
        };

        // Add author information if available
        if (userInfo?.name) {
          basicExperience.author = userInfo.name;
        }
        if (userInfo?.email) {
          basicExperience.authorEmail = userInfo.email;
        }
        
        const experienceJsonPath = path.join(newExperienceFolder, 'experience.json');
        await fs.writeFile(experienceJsonPath, JSON.stringify(basicExperience, null, 2));
        
        return newExperienceId;
      } catch (error) {
        logger.error(error, 'createExperience error');
        throw new Error(`Failed to create experience: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    copyTemplate: async (templateExperienceId: string) => {
      try {
        const newExperienceId = generateExperienceId();
        
        // Get source and destination folders
        const templateFolder = await getExperienceFolder(templateExperienceId);
        const newExperienceFolder = await getExperienceFolder(newExperienceId);
        
        logger.debug({ templateFolder, newExperienceFolder }, 'copyTemplate paths');
        
        // Copy entire directory structure recursively
        async function copyDirectory(src: string, dest: string): Promise<void> {
          await fs.mkdir(dest, { recursive: true });
          const entries = await fs.readdir(src, { withFileTypes: true });
          
          for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            
            if (entry.isDirectory()) {
              await copyDirectory(srcPath, destPath);
            } else {
              await fs.copyFile(srcPath, destPath);
            }
          }
        }
        
        await copyDirectory(templateFolder, newExperienceFolder);
        logger.debug('copyTemplate completed directory copy');
        
        // Update experience.json with initial metadata
        const experienceJsonPath = path.join(newExperienceFolder, 'experience.json');
        const experienceContent = await fs.readFile(experienceJsonPath, 'utf-8');
        const experience = JSON.parse(experienceContent);
        
        const now = new Date().toISOString();
        
        // Set initial metadata if not already present
        if (!experience.created) {
          experience.created = now;
        }
        if (!experience.lastModified) {
          experience.lastModified = now;
        }
        
        // Set author information if available and not already present
        if (!experience.author && userInfo?.name) {
          experience.author = userInfo.name;
        }
        if (!experience.authorEmail && userInfo?.email) {
          experience.authorEmail = userInfo.email;
        }
        
        // Set kind to "user" for newly created experiences
        experience.kind = "user";
        
        // Write back the updated experience.json
        await fs.writeFile(experienceJsonPath, JSON.stringify(experience, null, 2));
        
        logger.debug({ newExperienceId }, 'copyTemplate completed');
        
        return newExperienceId;
      } catch (error) {
        logger.error(error, 'copyTemplate error');
        throw new Error(`Failed to copy template: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    createFile: async (experienceId: string, path: string, content: string, contentEncoding?: string) => {
      logger.debug({ experienceId, path, contentLength: content.length, contentEncoding }, 'createFile called');
      try {
        const experienceFolder = await getExperienceFolder(experienceId);
        const fullPath = await import('path').then(p => p.join(experienceFolder, path));
        
        // Create directory structure if needed
        const dir = await import('path').then(p => p.dirname(fullPath));
        await fs.mkdir(dir, { recursive: true });
        
        // Write the file
        if (contentEncoding === 'base64') {
          await fs.writeFile(fullPath, Buffer.from(content, 'base64'));
        } else {
          await fs.writeFile(fullPath, content, 'utf-8');
        }
        logger.debug({ fullPath }, 'createFile success');
      } catch (error) {
        logger.error(error, 'createFile error');
        throw new Error(`Failed to create file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    createDirectory: async (experienceId: string, path: string) => {
      logger.debug({ experienceId, path }, 'createDirectory called');
      try {
        const experienceFolder = await getExperienceFolder(experienceId);
        const fullPath = await import('path').then(p => p.join(experienceFolder, path));
        
        await fs.mkdir(fullPath, { recursive: true });
        logger.debug({ fullPath }, 'createDirectory success');
      } catch (error) {
        logger.error(error, 'createDirectory error');
        throw new Error(`Failed to create directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    listResources: async (expId: string) => {
      logger.debug({ expId }, 'listResources called');
      try {
        const experienceFolder = await getExperienceFolder(expId);
        
        // Helper function to recursively list files
        async function listFilesRecursively(dir: string, basePath: string = ''): Promise<Array<{ path: string; type: 'file' | 'directory' }>> {
          const items = await fs.readdir(dir, { withFileTypes: true });
          const resources = [];
          
          for (const item of items) {
            const relativePath = basePath ? `${basePath}/${item.name}` : item.name;
            
            if (item.isDirectory()) {
              resources.push({ path: relativePath, type: 'directory' as const });
              // Recursively add files from subdirectories
              const subItems = await listFilesRecursively(path.join(dir, item.name), relativePath);
              resources.push(...subItems);
            } else {
              resources.push({ path: relativePath, type: 'file' as const });
            }
          }
          
          return resources;
        }
        
        const resources = await listFilesRecursively(experienceFolder);
        logger.debug({ count: resources.length }, 'listResources result');
        return resources;
      } catch (error) {
        logger.error(error, 'listResources error');
        throw new Error(`Failed to list resources: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    getResourceContent: async (expId: string, resourcePath: string) => {
      logger.debug({ expId, resourcePath }, 'getResourceContent called');
      try {
        const experienceFolder = await getExperienceFolder(expId);
        const fullPath = path.join(experienceFolder, resourcePath);
        
        // Check if file exists
        try {
          await fs.access(fullPath);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
          throw new Error(`Resource not found: ${resourcePath}`);
        }
        
        // Read the file
        const content = await fs.readFile(fullPath, 'utf-8');
        logger.debug({ path: resourcePath, length: content.length }, 'getResourceContent result');
        
        return { 
          content, 
          contentType: 'text/plain',
          isText: true,
          fileUrl: undefined
        };
      } catch (error) {
        logger.error(error, 'getResourceContent error');
        throw new Error(`Failed to get resource content: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };
}