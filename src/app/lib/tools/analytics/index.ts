/**
 * Analytics Tools
 * 
 * Tools for analytics agents to read/write session and class data.
 */

import { ToolRegistry } from '@/app/lib/ToolRegistry';
import { ToolContext, ToolResponse } from '@/app/lib/tools/types';
import { StorageServiceFactory } from '@/app/lib/storage/StorageServiceFactory';
import { ClassSessionsIndex } from '@/app/lib/types';
import path from 'path';

// Tool definitions
export const analyticsToolDefinitions = [
  {
    name: 'listClassSessions',
    description: 'List all sessions for members of a class. Returns the sessions index with information about each student\'s sessions.',
    parameters: {
      type: 'object' as const,
      properties: {
        classId: {
          type: 'string',
          description: 'The ID of the class to list sessions for'
        }
      },
      required: ['classId']
    },
    group: 'analytics'
  },
  {
    name: 'readSessionFile',
    description: 'Read a file from a specific student session. Can read any file in the session folder including artifacts, transcripts, or analytics.',
    parameters: {
      type: 'object' as const,
      properties: {
        sessionId: {
          type: 'string',
          description: 'The session ID (e.g., sess_abc123)'
        },
        filePath: {
          type: 'string',
          description: 'Path to the file within the session folder (e.g., "artifacts/transcript.md" or "session.json")'
        }
      },
      required: ['sessionId', 'filePath']
    },
    group: 'analytics'
  },
  {
    name: 'writeSessionFile',
    description: 'Write a file to a specific student session. Typically used for writing analytics outputs.',
    parameters: {
      type: 'object' as const,
      properties: {
        sessionId: {
          type: 'string',
          description: 'The session ID (e.g., sess_abc123)'
        },
        filePath: {
          type: 'string',
          description: 'Path to the file within the session folder (e.g., "analytics/student_report.md")'
        },
        content: {
          type: 'string',
          description: 'The content to write to the file'
        }
      },
      required: ['sessionId', 'filePath', 'content']
    },
    group: 'analytics'
  },
  {
    name: 'listSessionFiles',
    description: 'List all files in a session folder or subfolder. Useful for discovering available artifacts and transcripts.',
    parameters: {
      type: 'object' as const,
      properties: {
        sessionId: {
          type: 'string',
          description: 'The session ID (e.g., sess_abc123)'
        },
        subPath: {
          type: 'string',
          description: 'Optional subfolder path (e.g., "artifacts"). Defaults to root session folder.'
        }
      },
      required: ['sessionId']
    },
    group: 'analytics'
  },
  {
    name: 'readClassData',
    description: 'Read a file from class-level storage. Used for reading class analytics and shared data.',
    parameters: {
      type: 'object' as const,
      properties: {
        classId: {
          type: 'string',
          description: 'The class ID'
        },
        filePath: {
          type: 'string',
          description: 'Path to the file within the class_data folder (e.g., "class_report.md")'
        }
      },
      required: ['classId', 'filePath']
    },
    group: 'analytics'
  },
  {
    name: 'writeClassData',
    description: 'Write a file to class-level storage. Used for writing class analytics and reports.',
    parameters: {
      type: 'object' as const,
      properties: {
        classId: {
          type: 'string',
          description: 'The class ID'
        },
        filePath: {
          type: 'string',
          description: 'Path to the file within the class_data folder (e.g., "class_report.md")'
        },
        content: {
          type: 'string',
          description: 'The content to write to the file'
        }
      },
      required: ['classId', 'filePath', 'content']
    },
    group: 'analytics'
  },
  {
    name: 'batchReadSessionFiles',
    description: 'Read the same file from multiple sessions at once. Efficient for aggregating data across students.',
    parameters: {
      type: 'object' as const,
      properties: {
        sessionIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of session IDs to read from'
        },
        filePath: {
          type: 'string',
          description: 'Path to the file within each session folder'
        }
      },
      required: ['sessionIds', 'filePath']
    },
    group: 'analytics'
  }
];

// Extended context with experienceId for analytics tools
interface AnalyticsContext extends ToolContext {
  experienceId: string;
  sessionId: string;
}

/**
 * List all sessions for members of a class
 */
async function listClassSessions(
  args: { classId: string },
  context: ToolContext
): Promise<ToolResponse> {
  const analyticsContext = context as AnalyticsContext;
  const experienceId = analyticsContext.experienceId;
  
  if (!experienceId) {
    return {
      status: 'error',
      data: { error: 'experienceId not available in context' }
    };
  }

  try {
    const storage = StorageServiceFactory.getInstance();
    const indexPath = path.join(experienceId, 'class_data', args.classId, 'sessions_index.json');

    if (!await storage.fileExists(indexPath)) {
      return {
        status: 'error',
        data: { error: 'Sessions index not found. Please refresh the index first.' }
      };
    }

    const content = await storage.readFileAsText(indexPath);
    const index: ClassSessionsIndex = JSON.parse(content);

    return {
      status: 'success',
      data: {
        index,
        summary: {
          totalMembers: index.totalMembers,
          membersWithSessions: index.membersWithSessions,
          members: Object.entries(index.members).map(([email, entry]) => ({
            email,
            name: entry.name,
            sessionCount: entry.totalSessions,
            latestSession: entry.latestSession,
            hasAnalytics: entry.sessions.some(s => s.hasAnalytics)
          }))
        }
      }
    };
  } catch (error) {
    return {
      status: 'error',
      data: { error: error instanceof Error ? error.message : 'Failed to list class sessions' }
    };
  }
}

/**
 * Read a file from a specific session
 */
async function readSessionFile(
  args: { sessionId: string; filePath: string },
  context: ToolContext
): Promise<ToolResponse> {
  const analyticsContext = context as AnalyticsContext;
  const experienceId = analyticsContext.experienceId;
  
  if (!experienceId) {
    return {
      status: 'error',
      data: { error: 'experienceId not available in context' }
    };
  }

  try {
    const storage = StorageServiceFactory.getInstance();
    const fullPath = path.join(experienceId, 'session_data', args.sessionId, args.filePath);

    if (!await storage.fileExists(fullPath)) {
      return {
        status: 'error',
        data: { error: `File not found: ${args.filePath} in session ${args.sessionId}` }
      };
    }

    const content = await storage.readFileAsText(fullPath);

    return {
      status: 'success',
      data: {
        sessionId: args.sessionId,
        filePath: args.filePath,
        content
      }
    };
  } catch (error) {
    return {
      status: 'error',
      data: { error: error instanceof Error ? error.message : 'Failed to read session file' }
    };
  }
}

/**
 * Write a file to a specific session
 */
async function writeSessionFile(
  args: { sessionId: string; filePath: string; content: string },
  context: ToolContext
): Promise<ToolResponse> {
  const analyticsContext = context as AnalyticsContext;
  const experienceId = analyticsContext.experienceId;
  
  if (!experienceId) {
    return {
      status: 'error',
      data: { error: 'experienceId not available in context' }
    };
  }

  try {
    const storage = StorageServiceFactory.getInstance();
    const fullPath = path.join(experienceId, 'session_data', args.sessionId, args.filePath);

    await storage.storeFile(fullPath, Buffer.from(args.content, 'utf-8'));

    return {
      status: 'success',
      data: {
        sessionId: args.sessionId,
        filePath: args.filePath,
        message: 'File written successfully'
      }
    };
  } catch (error) {
    return {
      status: 'error',
      data: { error: error instanceof Error ? error.message : 'Failed to write session file' }
    };
  }
}

/**
 * List files in a session folder
 */
async function listSessionFiles(
  args: { sessionId: string; subPath?: string },
  context: ToolContext
): Promise<ToolResponse> {
  const analyticsContext = context as AnalyticsContext;
  const experienceId = analyticsContext.experienceId;
  
  if (!experienceId) {
    return {
      status: 'error',
      data: { error: 'experienceId not available in context' }
    };
  }

  try {
    const storage = StorageServiceFactory.getInstance();
    const basePath = path.join(experienceId, 'session_data', args.sessionId);
    const targetPath = args.subPath ? path.join(basePath, args.subPath) : basePath;

    const files = await storage.listFiles(targetPath);
    const directories = await storage.listDirectories(targetPath);

    return {
      status: 'success',
      data: {
        sessionId: args.sessionId,
        path: args.subPath || '/',
        files,
        directories
      }
    };
  } catch (error) {
    return {
      status: 'error',
      data: { error: error instanceof Error ? error.message : 'Failed to list session files' }
    };
  }
}

/**
 * Read a file from class-level storage
 */
async function readClassData(
  args: { classId: string; filePath: string },
  context: ToolContext
): Promise<ToolResponse> {
  const analyticsContext = context as AnalyticsContext;
  const experienceId = analyticsContext.experienceId;
  
  if (!experienceId) {
    return {
      status: 'error',
      data: { error: 'experienceId not available in context' }
    };
  }

  try {
    const storage = StorageServiceFactory.getInstance();
    const fullPath = path.join(experienceId, 'class_data', args.classId, args.filePath);

    if (!await storage.fileExists(fullPath)) {
      return {
        status: 'error',
        data: { error: `File not found: ${args.filePath} in class ${args.classId}` }
      };
    }

    const content = await storage.readFileAsText(fullPath);

    return {
      status: 'success',
      data: {
        classId: args.classId,
        filePath: args.filePath,
        content
      }
    };
  } catch (error) {
    return {
      status: 'error',
      data: { error: error instanceof Error ? error.message : 'Failed to read class data' }
    };
  }
}

/**
 * Write a file to class-level storage
 */
async function writeClassData(
  args: { classId: string; filePath: string; content: string },
  context: ToolContext
): Promise<ToolResponse> {
  const analyticsContext = context as AnalyticsContext;
  const experienceId = analyticsContext.experienceId;
  
  if (!experienceId) {
    return {
      status: 'error',
      data: { error: 'experienceId not available in context' }
    };
  }

  try {
    const storage = StorageServiceFactory.getInstance();
    const fullPath = path.join(experienceId, 'class_data', args.classId, args.filePath);

    await storage.storeFile(fullPath, Buffer.from(args.content, 'utf-8'));

    return {
      status: 'success',
      data: {
        classId: args.classId,
        filePath: args.filePath,
        message: 'File written successfully'
      }
    };
  } catch (error) {
    return {
      status: 'error',
      data: { error: error instanceof Error ? error.message : 'Failed to write class data' }
    };
  }
}

/**
 * Batch read the same file from multiple sessions
 */
async function batchReadSessionFiles(
  args: { sessionIds: string[]; filePath: string },
  context: ToolContext
): Promise<ToolResponse> {
  const analyticsContext = context as AnalyticsContext;
  const experienceId = analyticsContext.experienceId;
  
  if (!experienceId) {
    return {
      status: 'error',
      data: { error: 'experienceId not available in context' }
    };
  }

  try {
    const storage = StorageServiceFactory.getInstance();
    const results: Record<string, { content: string; error?: string }> = {};

    await Promise.all(
      args.sessionIds.map(async (sessionId) => {
        const fullPath = path.join(experienceId, 'session_data', sessionId, args.filePath);
        
        try {
          if (await storage.fileExists(fullPath)) {
            const content = await storage.readFileAsText(fullPath);
            results[sessionId] = { content };
          } else {
            results[sessionId] = { content: '', error: 'File not found' };
          }
        } catch (error) {
          results[sessionId] = { 
            content: '', 
            error: error instanceof Error ? error.message : 'Read failed' 
          };
        }
      })
    );

    const successCount = Object.values(results).filter(r => !r.error).length;

    return {
      status: 'success',
      data: {
        filePath: args.filePath,
        results,
        summary: {
          total: args.sessionIds.length,
          success: successCount,
          failed: args.sessionIds.length - successCount
        }
      }
    };
  } catch (error) {
    return {
      status: 'error',
      data: { error: error instanceof Error ? error.message : 'Failed to batch read files' }
    };
  }
}

// Tool implementations map
const toolImplementations: Record<string, (args: any, context: ToolContext) => Promise<ToolResponse>> = {
  listClassSessions,
  readSessionFile,
  writeSessionFile,
  listSessionFiles,
  readClassData,
  writeClassData,
  batchReadSessionFiles
};

/**
 * Register all analytics tools with the ToolRegistry
 */
export async function registerAnalyticsTools(): Promise<void> {
  const registry = ToolRegistry.getInstance();

  for (const def of analyticsToolDefinitions) {
    const implementation = toolImplementations[def.name];
    
    if (implementation) {
      await registry.register({
        type: 'function',
        name: def.name,
        description: def.description,
        parameters: def.parameters as any
      }, implementation);
    }
  }
}

// Export individual tools for direct use
export {
  listClassSessions,
  readSessionFile,
  writeSessionFile,
  listSessionFiles,
  readClassData,
  writeClassData,
  batchReadSessionFiles
};

