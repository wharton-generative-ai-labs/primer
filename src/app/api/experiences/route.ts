import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { StorageServiceFactory } from '@/app/lib/storage/StorageServiceFactory';
import { Permission } from '@/config/auth';
import { hasMergedPermission } from '@/config/user-storage';
import { canViewExperienceInCatalog } from '@/app/lib/experiencePermissions';
import path from 'path';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('experiences');

interface Experience {
  id: string;
  title: string;
  version: string;
  description: string;
  kind?: string;
  sceneCount?: number;
  soundsCount?: number;
  agents: { key: string; name: string }[];
  initialAgent?: string;
  tools?: { name: string }[];
  created?: string; // ISO 8601 datetime
  lastModified?: string; // ISO 8601 datetime
  author?: string;
  authorEmail?: string;
  hasReadme?: boolean;
}

interface Agent {
  name: string;
  [key: string]: any;  // Allow other properties
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession();
    const userEmail = session?.user?.email;
    
    // If not authenticated, return empty list
    if (!userEmail) {
      return NextResponse.json({ experiences: [] });
    }
    
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const includeTemplates = searchParams.get('includeTemplates') === 'true';
    const includeBundled = searchParams.get('includeBundled') !== 'false'; // default true
    const includeDebugger = searchParams.get('includeDebugger') === 'true'; // default false
    
    // Check if user has ADMIN_USERS or VIEW_TECHNICAL permission (required for viewing templates/debugger)
    const isAdmin = hasMergedPermission(userEmail, Permission.ADMIN_USERS);
    const isTechnical = hasMergedPermission(userEmail, Permission.VIEW_TECHNICAL);

    const storage = StorageServiceFactory.getInstance();
    
    // Get all directories in the root (each directory is an experience)
    const directories = await storage.listDirectories('');
    
    const experiences: Experience[] = [];
    
    // Read experience.json from each directory
    for (const dir of directories) {
      const configPath = path.join(dir, 'experience.json');
      
      try {
        if (await storage.fileExists(configPath)) {
          const configContent = await storage.readFile(configPath);
          const config = JSON.parse(configContent.toString());

          // Check if README.md exists
          const readmePath = path.join(dir, 'README.md');
          const hasReadme = await storage.fileExists(readmePath);

          const experienceData = {
            id: dir,
            title: config.title || 'Untitled Experience',
            version: config.version || '1.0.0',
            description: config.description || 'No description available',
            // Add kind if it exists
            ...(config.kind ? { kind: config.kind } : {}),
            // Add scene count if it exists
            ...(config.resources?.scenes?.length ? { sceneCount: config.resources.scenes.length } : {}),
            // Add sounds count if it exists
            ...(config.resources?.sounds?.length ? { soundsCount: config.resources.sounds.length } : {}),
            // Transform agents object into array of {key, name} pairs
            agents: Object.entries(config.agents || {}).map(([key, agent]) => ({
              key,
              name: (agent as Agent).name || key // Fallback to key if name is not defined
            })),
            // Add tools if they exist (just name)
            ...(config.tools ? {
              tools: [
                ...(config.tools.builtin || []).map((path: string) => ({
                  name: path.split('/').pop()?.replace('.ts', '') || ''
                })),
                ...(config.tools.bundled || []).map((path: string) => ({
                  name: path.split('/').pop()?.replace('.ts', '') || ''
                }))
              ]
            } : {}),
            // Add initialAgent if it exists (keeping just the key)
            ...(config.initialAgent ? { initialAgent: config.initialAgent } : {}),
            // Add metadata fields if they exist
            ...(config.created ? { created: config.created } : {}),
            ...(config.lastModified ? { lastModified: config.lastModified } : {}),
            ...(config.author ? { author: config.author } : {}),
            ...(config.authorEmail ? { authorEmail: config.authorEmail } : {}),
            // Add hasReadme flag
            hasReadme
          };
          
          // Skip templates unless admin explicitly requests them
          if (experienceData.kind === 'template') {
            if (!isAdmin || !includeTemplates) {
              continue;
            }
          }
          
          // Skip bundled if not requested (default: included)
          if (experienceData.kind === 'bundled' && !includeBundled) {
            continue;
          }
          
          // Skip debugger unless admin explicitly requests them
          if (experienceData.kind === 'debugger') {
            if (!isTechnical || !includeDebugger) {
              continue;
            }
          }
          
          // Check if user can view this experience using centralized logic
          const canView = await canViewExperienceInCatalog({
            experienceId: dir,
            userEmail,
            authorEmail: experienceData.authorEmail,
            kind: experienceData.kind
          });
          
          if (canView) {
            experiences.push(experienceData);
          }
        }
      } catch (error) {
        logger.warn({ configPath, err: error }, 'Failed to read experience config');
        // Skip this experience but continue with others
        continue;
      }
    }
    
    // Sort experiences by title
    experiences.sort((a, b) => a.title.localeCompare(b.title));

    return NextResponse.json({ experiences });
  } catch (error) {
    logger.error(error, 'Failed to list experiences');
    return NextResponse.json(
      { error: 'Failed to list experiences' },
      { status: 500 }
    );
  }
} 