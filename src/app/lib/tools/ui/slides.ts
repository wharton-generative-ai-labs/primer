import { ToolContext, ToolResponse } from '@/app/lib/tools/types';
import { isBinaryFileType, getMimeTypeForType } from '@/app/lib/artifact-utils';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('slide-tool');

/**
 * @tool slide
 * @description Create slides to display content. Use 'show' to create a slide with markdown content, or 'showArtifact' to create a slide from an artifact. Returns slideId for use with 'present' tool for window management (hide/show/move/resize).
 * ALWAYS use slides to visualize information - it's far better than long text descriptions.
 * @param {object} args - The arguments for the tool
 * @param {string} args.action - The action to perform: 'show', 'showArtifact'
 * @param {string} args.title - Slide title
 * @param {string} args.content - Slide content in markdown (for show action)
 * @param {string} args.artifactId - Artifact ID to display (for showArtifact action)
 * @param {object} context - The context object
 * @returns {Promise<ToolResponse>} Tool response with slideId
 */
export async function slide(
  args: {
    action: 'show' | 'showArtifact';
    title?: string;
    content?: string;
    artifactId?: string;
  },
  context: ToolContext
): Promise<ToolResponse> {
  try {
    // Check if we have the necessary context for socket communication
    if (!context.sendClientEvent) {
      return {
        status: 'error',
        data: { error: 'Socket communication not available in this context' }
      };
    }

    // Validate action
    const validActions = ['show', 'showArtifact'];
    if (!validActions.includes(args.action)) {
      return {
        status: 'error',
        data: { 
          error: `Invalid action: ${args.action}. Valid actions are: ${validActions.join(', ')}` 
        }
      };
    }

    // Generate a unique call ID for this request
    const callId = `slide_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    logger.debug({ callId, action: args.action, title: args.title }, 'Executing slide action');

    // Get the request manager from context
    const requestManager = (context as any).requestManager;
    if (!requestManager) {
      return {
        status: 'error',
        data: { error: 'Request manager not available in context' }
      };
    }

    // Handle different actions
    switch (args.action) {
      case 'show': {
        // Validate required parameters
        if (!args.title || !args.content) {
          return {
            status: 'error',
            data: { error: 'title and content are required for show action' }
          };
        }

        // Create a pending request that will resolve when we receive the result from the client
        const resultPromise = requestManager.createPendingRequest(
          callId, 
          'tool_result', 
          5000
        ) as Promise<{ status: 'success' | 'error'; data: any }>;

        // Send the slide creation command to the client via socket
        context.sendClientEvent({
          type: 'ui.slide.create',
          data: { 
            callId, 
            title: args.title,
            content: args.content
          }
        });

        // Wait for the client to respond with the result
        const result = await resultPromise;

        logger.debug({ callId, result }, 'Received result from client');

        return result;
      }

      case 'showArtifact': {
        // Validate required parameters
        if (!args.artifactId) {
          return {
            status: 'error',
            data: { error: 'artifactId is required for showArtifact action' }
          };
        }

        if (!context.getArtifact) {
          return {
            status: 'error',
            data: { error: 'getArtifact not available in context' }
          };
        }

        // Retrieve the artifact content
        const artifact = await context.getArtifact(args.artifactId);
        if (!artifact) {
          return {
            status: 'error',
            data: { error: `Artifact ${args.artifactId} not found` }
          };
        }

        // Use artifact name as title if not provided
        const title = args.title || artifact.name;
        
        // Prepare content for display based on artifact type
        let slideContent: string;
        if (isBinaryFileType(artifact.type)) {
          // For binary files (images, PDFs, etc.), create a data URL
          const mimeType = getMimeTypeForType(artifact.type);
          
          // For images, create a markdown image tag
          if (artifact.type.match(/^(png|jpg|jpeg|gif|svg|webp)$/i)) {
            slideContent = `![${artifact.name}](data:${mimeType};base64,${artifact.content})`;
          } else {
            // For other binary types (PDFs, etc.), provide a download link or message
            slideContent = `# ${artifact.name}\n\n**Type:** ${artifact.type}\n\nThis is a binary file that cannot be displayed directly as a slide.\n\n*File size: ${artifact.content.length} characters (base64)*`;
          }
        } else {
          // For text files, show the content directly
          slideContent = artifact.content;
        }

        // Create a pending request
        const resultPromise = requestManager.createPendingRequest(
          callId, 
          'tool_result', 
          5000
        ) as Promise<{ status: 'success' | 'error'; data: any }>;

        // Send the slide creation command to the client via socket
        context.sendClientEvent({
          type: 'ui.slide.create',
          data: { 
            callId, 
            title,
            content: slideContent,
            artifactId: args.artifactId,
            artifactName: artifact.name,
            artifactType: artifact.type
          }
        });

        // Wait for the client to respond with the result
        const result = await resultPromise;

        logger.debug({ callId, result }, 'Received result from client');

        return result;
      }

      default:
        return {
          status: 'error',
          data: { error: `Invalid action: ${args.action}` }
        };
    }
  } catch (error) {
    logger.error(error, 'Error in slide tool');
    return {
      status: 'error',
      data: { 
        error: error instanceof Error ? error.message : 'Unknown error in slide tool' 
      }
    };
  }
}

