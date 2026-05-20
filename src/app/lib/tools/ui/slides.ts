import { ToolContext, ToolResponse } from '@/app/lib/tools/types';
import { isBinaryFileType, getMimeTypeForType } from '@/app/lib/artifact-utils';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('slide-tool');

/**
 * @tool slide
 * @description Show and manage the document panel. Use 'show' to put markdown content in the active slot, 'showArtifact' to render an existing artifact, and 'reveal'/'hide' to toggle the panel without changing the active document.
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
    action: 'show' | 'showArtifact' | 'list' | 'close' | 'hide' | 'reveal';
    title?: string;
    content?: string;
    artifactId?: string;
    /** Document id (from `list`) to close. */
    id?: string;
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
    const validActions = ['show', 'showArtifact', 'list', 'close', 'hide', 'reveal'];
    if (!args.action) {
      return {
        status: 'error',
        data: {
          error: `slide tool requires an 'action' parameter. Valid actions are: ${validActions.join(', ')}. Example: slide({ action: 'showArtifact', artifactId: '<id>' }) or slide({ action: 'show', title: '...', content: '...' }).`
        }
      };
    }
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
        // Only the title is strictly required. If content is missing or
        // blank the AI probably meant "just a title slide" (common pattern
        // when the agent wants to announce a section before filling in
        // details); render the title as an H1 rather than hard-erroring.
        if (!args.title) {
          return {
            status: 'error',
            data: { error: 'title is required for show action' }
          };
        }
        const content =
          args.content && args.content.trim().length > 0
            ? args.content
            : `# ${args.title}\n`;

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
            content,
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

      case 'list': {
        const resultPromise = requestManager.createPendingRequest(
          callId,
          'tool_result',
          5000
        ) as Promise<{ status: 'success' | 'error'; data: any }>;
        context.sendClientEvent({
          type: 'ui.slide.list',
          data: { callId },
        });
        return await resultPromise;
      }

      case 'close': {
        if (!args.id) {
          return {
            status: 'error',
            data: { error: 'id is required for close action' },
          };
        }
        const resultPromise = requestManager.createPendingRequest(
          callId,
          'tool_result',
          5000
        ) as Promise<{ status: 'success' | 'error'; data: any }>;
        context.sendClientEvent({
          type: 'ui.slide.close',
          data: { callId, id: args.id },
        });
        return await resultPromise;
      }

      case 'hide':
      case 'reveal': {
        if (context.setDocumentVisible) {
          context.setDocumentVisible(args.action === 'reveal');
          return {
            status: 'success',
            data: { visible: args.action === 'reveal' },
          };
        }

        const resultPromise = requestManager.createPendingRequest(
          callId,
          'tool_result',
          5000
        ) as Promise<{ status: 'success' | 'error'; data: any }>;
        context.sendClientEvent({
          type: 'ui.document.visibility',
          data: { callId, visible: args.action === 'reveal' },
        });
        return await resultPromise;
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
