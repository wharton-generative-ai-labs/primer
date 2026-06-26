import type {
  CurrentWorkflowPhaseInfo,
  ToolContext,
  WorkflowPhaseToolOp,
  WorkflowPhaseToolResult,
} from '@/app/lib/tools/types';
import type { AuthorInput } from '@/app/lib/artifacts/types';
import type {
  WorkflowPhaseConfig,
  WorkflowPhaseState,
} from '@/app/lib/workflow-phases';
import {
  createArtifact as storageCreateArtifact,
  updateArtifact as storageUpdateArtifact,
  deleteArtifact as storageDeleteArtifact,
  readArtifactHead,
  getRevisionEntry,
  normalizeArtifactRecord,
} from '@/app/lib/artifacts/storage';
import { createInformationStore } from '@/app/lib/tools/server/InformationStore';
import { createModuleLogger } from '@/lib/logger';
import { sendToastNotification } from './toast';

const logger = createModuleLogger('backend-agent-context');

function backendArtifactAuthor(
  userInfo?: { name?: string | null; email?: string | null },
  activeAgentKey?: string,
): AuthorInput {
  if (activeAgentKey) return { kind: 'agent', agentKey: activeAgentKey };
  if (userInfo?.email) return { kind: 'user', email: userInfo.email, name: userInfo.name ?? undefined };
  return { kind: 'system' };
}

// Server-side implementation of all tool context functions
export async function createServerToolContext(
  experienceId: string, 
  sessionId: string, 
  delegationId?: string,
  userInfo?: { name?: string | null; email?: string | null },
  activeAgentKey?: string,
): Promise<ToolContext & { sessionId: string; delegationId?: string; userInfo?: { name?: string | null; email?: string | null } }> {
  // Import the required modules for direct file system access
  const { getExperienceArtifactsFolder, getExperienceFolder, generateExperienceId, getSessionMetadataFilePath, safeJoinExperiencePath } = await import('@/app/lib/file-utils');
  const { isBinaryFileType } = await import('@/app/lib/artifact-utils');
  const fs = await import('fs/promises');
  const path = await import('path');

  const informationStore = createInformationStore(experienceId, sessionId);

  // -------------------------------------------------------------------------
  // Workflow-phase snapshot
  //
  // The frontend `agent` tool's phase gates (`Phase-scoped delegate gating`,
  // cross-phase transfer refusal) read `getCurrentWorkflowPhase()` and
  // `getWorkflowPhases()` synchronously. Backend tool contexts therefore need
  // synchronous accessors too — but the source of truth (session metadata,
  // experience config) lives on disk. We resolve this by loading both files
  // once at context creation, caching the snapshot in a closure, and serving
  // sync reads from the cache. One read per dispatched agent call is cheap
  // and avoids racing the gate against in-flight phase transitions: the
  // backend agent sees the phase that was current when its dispatch began,
  // which matches the phase that gated its invocation.
  //
  // If either file fails to load (no phases configured, missing session, IO
  // error), the accessors fall back to the legacy null/empty shape so the
  // gate degrades to "skipped" rather than throwing.
  // -------------------------------------------------------------------------
  let cachedWorkflowPhases: WorkflowPhaseConfig[] = [];
  let cachedWorkflowPhaseState: WorkflowPhaseState | null = null;
  try {
    const experienceFolder = await getExperienceFolder(experienceId);
    const experienceJsonPath = path.join(experienceFolder, 'experience.json');
    const rawExperience = await fs.readFile(experienceJsonPath, 'utf-8');
    const config = JSON.parse(rawExperience) as { workflowPhases?: WorkflowPhaseConfig[] };
    cachedWorkflowPhases = config.workflowPhases ?? [];
  } catch (error) {
    logger.debug({ err: error, experienceId }, 'Could not preload workflow phases for backend tool context');
  }
  if (cachedWorkflowPhases.length > 0) {
    try {
      const metadataPath = await getSessionMetadataFilePath(experienceId, sessionId);
      const rawMetadata = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(rawMetadata) as { workflowPhaseState?: WorkflowPhaseState };
      cachedWorkflowPhaseState = metadata.workflowPhaseState ?? null;
    } catch (error) {
      logger.debug({ err: error, experienceId, sessionId }, 'Could not preload workflow phase state for backend tool context');
    }
  }

  // -------------------------------------------------------------------------
  // "current" experience-id sentinel resolution
  //
  // Backend agents (especially experience-builder) commonly call a sequence
  // like:
  //   1. copyTemplate({ templateExperienceId: 'starter' })
  //      -> returns the new experience id
  //   2. modifyExperience({ experienceId: 'current', operation: ... })
  //
  // The agent uses the literal string `current` to refer to "whatever I just
  // created" rather than threading the new id through every subsequent call.
  // We make that work by tracking the most-recently-created experience id in
  // a closure and rewriting `current` to that id when downstream tools ask
  // for resources by experience id. If nothing has been created yet, we fall
  // through to the literal lookup so the existing "Resource not found" error
  // path still surfaces a clear failure.
  // -------------------------------------------------------------------------
  let lastCreatedExperienceId: string | undefined;

  const resolveExperienceId = (id: string): string => {
    if (id === 'current' && lastCreatedExperienceId) {
      return lastCreatedExperienceId;
    }
    return id;
  };

  return {
    experienceId,
    functionCallId: `backend_${Date.now()}`,
    sessionId,
    delegationId,
    userInfo,
    informationStore: {
      getAllKeys: () => informationStore.getAllKeys(),
      get: (key: string) => informationStore.get(key),
      save: (key: string, value: string) => informationStore.save(key, value),
      delete: (key: string) => informationStore.delete(key),
    },

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
              const record = JSON.parse(content);
              return normalizeArtifactRecord(record);
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

    getArtifact: async (id: string, _includeContent?: boolean, rev?: number) => {
      try {
        // Branch on whether the agent asked for a specific past revision.
        // Head fetch is the common path; rev fetch is only used when the
        // agent wants to read what the user is currently looking at
        // (focusedRev) or to answer a "what changed between versions"
        // follow-up. We fetch the head record either way to share the
        // record-level fields (name, type, lastAuthor, etc.); for rev
        // fetches we then swap in the revision's content + author. The
        // shape stays uniform so the tool surface doesn't fork.
        const head = await readArtifactHead({ experienceId, sessionId, artifactId: id });
        if (!head) return null;

        if (rev !== undefined) {
          const entry = await getRevisionEntry({
            experienceId,
            sessionId,
            artifactId: id,
            rev,
          });
          if (!entry) return null;
          const { revisionMeta, content } = entry;
          const isText = !isBinaryFileType(head.type || 'markdown');
          let contentType = 'text/plain';
          if (isText && head.type === 'markdown') {
            contentType = 'text/markdown';
          } else if (!isText) {
            contentType = `image/${head.type}`;
          }
          return {
            ...head,
            content,
            rev: revisionMeta.rev,
            revAuthor: revisionMeta.author,
            revCreatedAt: revisionMeta.createdAt,
            isText,
            contentType,
          };
        }

        const isText = !isBinaryFileType(head.type || 'markdown');
        let contentType = 'text/plain';
        if (isText && head.type === 'markdown') {
          contentType = 'text/markdown';
        } else if (!isText) {
          contentType = `image/${head.type}`;
        }

        return {
          ...head,
          isText,
          contentType,
        };
      } catch (error) {
        logger.error(error, 'getArtifact error');
        throw new Error(`Failed to get artifact: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    createArtifact: async (name: string, content: string, type?: string) => {
      try {
        const author = backendArtifactAuthor(userInfo, activeAgentKey);
        const { artifact } = await storageCreateArtifact({
          experienceId,
          sessionId,
          name,
          content,
          type,
          author,
        });
        logger.debug({ id: artifact.id, name: artifact.name, type: artifact.type }, 'createArtifact completed');
        return artifact;
      } catch (error) {
        logger.error(error, 'createArtifact error');
        throw new Error(`Failed to create artifact: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    updateArtifact: async (id: string, content: string) => {
      logger.debug({ id, contentLength: content.length }, 'updateArtifact called');
      try {
        const author = backendArtifactAuthor(userInfo, activeAgentKey);
        await storageUpdateArtifact({
          experienceId,
          sessionId,
          artifactId: id,
          content,
          author,
        });
        logger.debug({ id }, 'updateArtifact completed');
      } catch (error) {
        logger.error(error, 'updateArtifact error');
        throw new Error(`Failed to update artifact: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    deleteArtifact: async (id: string) => {
      logger.debug({ id }, 'deleteArtifact called');
      try {
        await storageDeleteArtifact({ experienceId, sessionId, artifactId: id });
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

        lastCreatedExperienceId = newExperienceId;
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

        lastCreatedExperienceId = newExperienceId;
        return newExperienceId;
      } catch (error) {
        logger.error(error, 'copyTemplate error');
        throw new Error(`Failed to copy template: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    createFile: async (experienceId: string, filePath: string, content: string, contentEncoding?: string) => {
      const targetExperienceId = resolveExperienceId(experienceId);
      logger.debug({ experienceId: targetExperienceId, path: filePath, contentLength: content.length, contentEncoding }, 'createFile called');
      try {
        const experienceFolder = await getExperienceFolder(targetExperienceId);
        const fullPath = safeJoinExperiencePath(experienceFolder, filePath);

        // Create directory structure if needed
        const dir = path.dirname(fullPath);
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

    createDirectory: async (experienceId: string, dirPath: string) => {
      const targetExperienceId = resolveExperienceId(experienceId);
      logger.debug({ experienceId: targetExperienceId, path: dirPath }, 'createDirectory called');
      try {
        const experienceFolder = await getExperienceFolder(targetExperienceId);
        const fullPath = safeJoinExperiencePath(experienceFolder, dirPath);

        await fs.mkdir(fullPath, { recursive: true });
        logger.debug({ fullPath }, 'createDirectory success');
      } catch (error) {
        logger.error(error, 'createDirectory error');
        throw new Error(`Failed to create directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    listResources: async (expId: string) => {
      const targetExperienceId = resolveExperienceId(expId);
      logger.debug({ expId: targetExperienceId }, 'listResources called');
      try {
        const experienceFolder = await getExperienceFolder(targetExperienceId);
        
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

    deleteFile: async (expId: string, filePath: string) => {
      const targetExperienceId = resolveExperienceId(expId);
      logger.debug({ expId: targetExperienceId, filePath }, 'deleteFile called');
      try {
        const experienceFolder = await getExperienceFolder(targetExperienceId);
        const fullPath = safeJoinExperiencePath(experienceFolder, filePath);
        await fs.unlink(fullPath);
        logger.debug({ fullPath }, 'deleteFile success');
      } catch (error) {
        logger.error(error, 'deleteFile error');
        throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    deleteDirectory: async (expId: string, dirPath: string) => {
      const targetExperienceId = resolveExperienceId(expId);
      logger.debug({ expId: targetExperienceId, dirPath }, 'deleteDirectory called');
      try {
        const experienceFolder = await getExperienceFolder(targetExperienceId);
        const fullPath = safeJoinExperiencePath(experienceFolder, dirPath);
        if (fullPath === path.resolve(experienceFolder)) {
          throw new Error('Refusing to delete the experience root folder');
        }
        await fs.rm(fullPath, { recursive: true });
        logger.debug({ fullPath }, 'deleteDirectory success');
      } catch (error) {
        logger.error(error, 'deleteDirectory error');
        throw new Error(`Failed to delete directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    moveFile: async (expId: string, sourcePath: string, destinationPath: string) => {
      const targetExperienceId = resolveExperienceId(expId);
      logger.debug({ expId: targetExperienceId, sourcePath, destinationPath }, 'moveFile called');
      try {
        const experienceFolder = await getExperienceFolder(targetExperienceId);
        const fullSource = safeJoinExperiencePath(experienceFolder, sourcePath);
        const fullDest = safeJoinExperiencePath(experienceFolder, destinationPath);
        await fs.mkdir(path.dirname(fullDest), { recursive: true });
        await fs.rename(fullSource, fullDest);
        logger.debug({ fullSource, fullDest }, 'moveFile success');
      } catch (error) {
        logger.error(error, 'moveFile error');
        throw new Error(`Failed to move file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    moveDirectory: async (expId: string, sourcePath: string, destinationPath: string) => {
      const targetExperienceId = resolveExperienceId(expId);
      logger.debug({ expId: targetExperienceId, sourcePath, destinationPath }, 'moveDirectory called');
      try {
        const experienceFolder = await getExperienceFolder(targetExperienceId);
        const fullSource = safeJoinExperiencePath(experienceFolder, sourcePath);
        const fullDest = safeJoinExperiencePath(experienceFolder, destinationPath);
        await fs.mkdir(path.dirname(fullDest), { recursive: true });
        await fs.rename(fullSource, fullDest);
        logger.debug({ fullSource, fullDest }, 'moveDirectory success');
      } catch (error) {
        logger.error(error, 'moveDirectory error');
        throw new Error(`Failed to move directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    getResourceContent: async (expId: string, resourcePath: string) => {
      const targetExperienceId = resolveExperienceId(expId);
      logger.debug({ expId: targetExperienceId, resourcePath }, 'getResourceContent called');
      try {
        const experienceFolder = await getExperienceFolder(targetExperienceId);
        const fullPath = safeJoinExperiencePath(experienceFolder, resourcePath);

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
    },

    // -------------------------------------------------------------
    // Workflow-phase capabilities
    //
    // The realtime path goes through HTTP, but the backend-agent path runs
    // on the same Node process as the API routes — so we call the
    // workflow-phase manager directly via `mutateSessionMetadata`. Reads use
    // the metadata snapshot helper so we don't acquire the write lock for
    // simple discovery.
    // -------------------------------------------------------------
    setWorkflowPhase: async (
      op: WorkflowPhaseToolOp,
      meta?: { trigger?: 'agent' | 'user' | 'system'; reason?: string },
    ): Promise<WorkflowPhaseToolResult> => {
      try {
        const { mutateSessionMetadata } =
          await import('@/app/lib/sessions/mutateSessionMetadata');
        const { transition } = await import(
          '@/app/lib/workflow-phases/WorkflowPhaseManager'
        );
        const { getExperienceFolder } = await import('@/app/lib/file-utils');
        const path = await import('path');

        const experienceFolder = await getExperienceFolder(experienceId);
        const experienceJsonPath = path.join(experienceFolder, 'experience.json');
        const config = JSON.parse(
          await fs.readFile(experienceJsonPath, 'utf-8'),
        );

        const result = await mutateSessionMetadata(
          experienceId,
          sessionId,
          async (metadata: any) => {
            const transitionResult = transition(
              config,
              metadata.workflowPhaseState,
              metadata.experienceCompleted ?? false,
              {
                op,
                trigger: meta?.trigger ?? 'agent',
                reason: meta?.reason,
              },
            );
            if (!metadata.events) metadata.events = [];
            for (const event of transitionResult.eventsToAppend) {
              metadata.events.push(event);
            }
            metadata.workflowPhaseState = transitionResult.newState;
            metadata.experienceCompleted = transitionResult.experienceCompleted;
            metadata.lastActivity = new Date().toISOString();
            return { metadata, result: transitionResult };
          },
        );

        return {
          result: true,
          currentPhase: result.newState.currentPhase,
          nextPhaseOverride: result.newState.nextPhaseOverride,
        };
      } catch (error: unknown) {
        if (
          error &&
          typeof error === 'object' &&
          'name' in error &&
          ((error as { name: string }).name === 'InvalidPhaseError' ||
            (error as { name: string }).name === 'NoNextPhaseError' ||
            (error as { name: string }).name ===
              'SessionMetadataNotFoundError')
        ) {
          return {
            result: false,
            message: (error as Error).message,
          };
        }
        logger.error(error, 'setWorkflowPhase error');
        return {
          result: false,
          message:
            error instanceof Error ? error.message : 'workflow-phase transition failed',
        };
      }
    },

    getCurrentWorkflowPhase: (): CurrentWorkflowPhaseInfo | null => {
      // Synchronous accessor backed by the snapshot loaded at context
      // creation. Mirrors the shape the frontend's `useHandleServerEvent`
      // and the harness's `HarnessToolContext` produce so the agent tool's
      // phase gates apply uniformly across every dispatcher.
      const phases = cachedWorkflowPhases;
      const phaseState = cachedWorkflowPhaseState;
      if (phases.length === 0 || !phaseState || !phaseState.currentPhase) {
        return null;
      }
      const idx = phases.findIndex((p) => p.id === phaseState.currentPhase);
      if (idx < 0) return null;
      const current = phases[idx];
      const arrayNextId = idx + 1 < phases.length ? phases[idx + 1].id : undefined;
      const overrideId = phaseState.nextPhaseOverride;
      const resolvedNextPhaseId = overrideId ?? arrayNextId;
      return {
        id: current.id,
        title: current.title,
        index: idx,
        total: phases.length,
        isCompleted: phaseState.completedPhases.includes(current.id),
        nextPhaseOverride: overrideId,
        resolvedNextPhaseId,
      };
    },

    getWorkflowPhases: (): WorkflowPhaseConfig[] => cachedWorkflowPhases,

    getWorkflowPhaseState: (): WorkflowPhaseState | null => cachedWorkflowPhaseState,

    suggestWorkflowPhaseReturn: (_phaseId: string, _reason: string) => {
      // No-op on the backend; the backend agent has no UI surface to ask
      // the user. The realtime path (Task A14's client wiring) is where
      // suggestReturn actually surfaces a prompt.
    },

    // -------------------------------------------------------------
    // Finish-Experience capability
    //
    // Mirrors `setWorkflowPhase` above but always issues
    // `op: { kind: 'finishExperience' }`. Idempotency lives in the manager
    // (a second call after the flag is already set emits no new event); we
    // still return `{ result: true }` either way so the LLM doesn't see a
    // failure when calling twice.
    // -------------------------------------------------------------
    finishExperience: async (reason?: string): Promise<{ result: boolean }> => {
      try {
        const { mutateSessionMetadata } =
          await import('@/app/lib/sessions/mutateSessionMetadata');
        const { transition } = await import(
          '@/app/lib/workflow-phases/WorkflowPhaseManager'
        );
        const { getExperienceFolder } = await import('@/app/lib/file-utils');
        const path = await import('path');

        const experienceFolder = await getExperienceFolder(experienceId);
        const experienceJsonPath = path.join(experienceFolder, 'experience.json');
        const config = JSON.parse(
          await fs.readFile(experienceJsonPath, 'utf-8'),
        );

        await mutateSessionMetadata(
          experienceId,
          sessionId,
          async (metadata: any) => {
            const transitionResult = transition(
              config,
              metadata.workflowPhaseState,
              metadata.experienceCompleted ?? false,
              {
                op: { kind: 'finishExperience' },
                trigger: 'agent',
                reason,
              },
            );
            if (!metadata.events) metadata.events = [];
            for (const event of transitionResult.eventsToAppend) {
              metadata.events.push(event);
            }
            metadata.workflowPhaseState = transitionResult.newState;
            metadata.experienceCompleted = transitionResult.experienceCompleted;
            metadata.lastActivity = new Date().toISOString();
            return { metadata, result: transitionResult };
          },
        );

        return { result: true };
      } catch (error: unknown) {
        logger.error(error, 'finishExperience error');
        return { result: false };
      }
    },
  };
}