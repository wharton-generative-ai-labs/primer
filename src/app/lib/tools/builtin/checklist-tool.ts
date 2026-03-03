/**
 * Checklist Management Tool
 * 
 * A specialized tool for managing checklist artifacts.
 * Provides easy operations for checking/unchecking items and displaying progress.
 */

import { ToolResponse, ToolContext } from '@/app/lib/tools/types';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('checklist-tool');

/**
 * @tool checklist
 * @description A specialized tool for managing checklist artifacts. Provides easy operations for checking/unchecking items and displaying progress.
 * @param {object} args - The arguments for the tool
 * @param {string} args.action - The action to perform: 'get', 'check', 'uncheck', 'showProgress', 'discover'
 * @param {string} args.checklistName - Optional name/pattern to find the checklist (defaults to "*Checklist*")
 * @param {string} args.itemText - Text of the item to check/uncheck
 * @param {string[]} args.tags - Optional array of tags to filter checklists by (e.g., ['private:agentKey'] or ['shared'])
 * @param {object} context - The context object
 * @param {Function} context.listArtifacts - Function to list artifacts
 * @param {Function} context.updateArtifact - Function to update an artifact
 * @param {Function} context.showSlide - Function to show slide (if available)
 * @param {string} context.selectedAgentKey - The key of the currently selected agent
 * @returns {Promise<ToolResponse>} Tool response object
 */
export async function checklist(args: {
    action: 'get' | 'check' | 'uncheck' | 'showProgress' | 'discover',
    checklistName?: string,
    itemText?: string,
    tags?: string[]
}, context: ToolContext): Promise<ToolResponse> {
    if (!context.listArtifacts || !context.updateArtifact) {
        return {
            status: 'error',
            data: { error: 'Required context functions not available' }
        };
    }

    try {
        // Helper function to find checklists based on criteria
        const findChecklists = async (namePattern?: string, tags?: string[]) => {
            if (!context.listArtifacts) {
                throw new Error('listArtifacts function not available in context');
            }
            const artifacts = await context.listArtifacts();
            
            return artifacts.filter((artifact: any) => {
                // Check if it's a checklist type
                const isChecklist = artifact.type === 'checklist' || 
                                  (namePattern && artifact.name.includes(namePattern));
                
                if (!isChecklist) return false;
                
                // If tags are specified, filter by tags
                if (tags && tags.length > 0) {
                    const artifactTags = artifact.metadata?.tags || [];
                    return tags.some(tag => artifactTags.includes(tag));
                }
                
                return true;
            });
        };

        // Discover action to list available checklists with their tags
        if (args.action === 'discover') {
            const checklists = await findChecklists();
            
            return {
                status: 'success',
                data: {
                    checklists: checklists.map((checklist: any) => ({
                        id: checklist.id,
                        name: checklist.name,
                        type: checklist.type,
                        tags: checklist.metadata?.tags || []
                    })),
                    count: checklists.length
                }
            };
        }

        // Find the appropriate checklist
        let checklist;
        
        // If tags are provided, use them for filtering
        if (args.tags && args.tags.length > 0) {
            const checklists = await findChecklists(args.checklistName, args.tags);
            checklist = checklists[0]; // Take the first match
        } else {
            // Fallback to original logic with agent-specific enhancement
            const checklists = await findChecklists(args.checklistName || "Checklist");
            
            // Try to find agent-specific checklist first
            if (context.selectedAgentKey) {
                const agentSpecificTag = `private:${context.selectedAgentKey}`;
                checklist = checklists.find((c: any) => 
                    c.metadata?.tags?.includes(agentSpecificTag)
                );
            }
            
            // If no agent-specific checklist found, look for shared ones
            if (!checklist) {
                checklist = checklists.find((c: any) => 
                    c.metadata?.tags?.includes('shared') || 
                    !c.metadata?.tags || 
                    c.metadata?.tags?.length === 0
                );
            }
            
            // If still no checklist found, take the first available
            if (!checklist && checklists.length > 0) {
                checklist = checklists[0];
            }
        }

        if (!checklist) {
            const searchCriteria = args.tags ? 
                `tags: [${args.tags.join(', ')}]` : 
                `pattern: "${args.checklistName || 'Checklist'}"`;
            
            return {
                status: 'error',
                data: { error: `No checklist found matching ${searchCriteria}` }
            };
        }

        switch (args.action) {
            case 'get': {
                // Get the full artifact with content
                if (!context.getArtifact) {
                    return {
                        status: 'error',
                        data: { error: 'getArtifact function not available in context' }
                    };
                }
                
                const fullArtifact = await context.getArtifact(checklist.id);
                if (!fullArtifact) {
                    return {
                        status: 'error',
                        data: { error: 'Could not retrieve checklist content' }
                    };
                }
                
                return {
                    status: 'success',
                    data: {
                        id: fullArtifact.id,
                        name: fullArtifact.name,
                        content: fullArtifact.content,
                        type: fullArtifact.type,
                        tags: fullArtifact.metadata?.tags || []
                    }
                };
            }

            case 'check':
            case 'uncheck': {
                if (!args.itemText) {
                    return {
                        status: 'error',
                        data: { error: 'itemText is required for check/uncheck actions' }
                    };
                }

                // Get the full artifact with content
                if (!context.getArtifact) {
                    return {
                        status: 'error',
                        data: { error: 'getArtifact function not available in context' }
                    };
                }
                
                const fullArtifact = await context.getArtifact(checklist.id);
                if (!fullArtifact) {
                    return {
                        status: 'error',
                        data: { error: 'Could not retrieve checklist content' }
                    };
                }

                const isChecking = args.action === 'check';
                const content = fullArtifact.content;
                
                // Find and update the item
                const lines = content.split('\n');
                let updated = false;
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    if (line.includes(args.itemText) && (line.includes('- [ ]') || line.includes('- [x]'))) {
                        if (isChecking) {
                            lines[i] = line.replace('- [ ]', '- [x]');
                        } else {
                            lines[i] = line.replace('- [x]', '- [ ]');
                        }
                        updated = true;
                        break;
                    }
                }

                if (!updated) {
                    return {
                        status: 'error',
                        data: { error: `Could not find checklist item containing "${args.itemText}"` }
                    };
                }

                const updatedContent = lines.join('\n');
                await context.updateArtifact(checklist.id, updatedContent);

                return {
                    status: 'success',
                    data: {
                        message: `Successfully ${isChecking ? 'checked' : 'unchecked'} item: ${args.itemText}`,
                        updatedContent
                    }
                };
            }

            case 'showProgress': {
                // Get the full artifact with content
                if (!context.getArtifact) {
                    return {
                        status: 'error',
                        data: { error: 'getArtifact function not available in context' }
                    };
                }
                
                const fullArtifact = await context.getArtifact(checklist.id);
                if (!fullArtifact) {
                    return {
                        status: 'error',
                        data: { error: 'Could not retrieve checklist content' }
                    };
                }
                
                // Count completed vs total items
                const content = fullArtifact.content;
                const totalItems = (content.match(/- \[[ x]\]/g) || []).length;
                const completedItems = (content.match(/- \[x\]/g) || []).length;
                const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

                // Generate dynamic slide title based on checklist name and tags
                const isPrivate = fullArtifact.metadata?.tags?.some((tag: string) => tag.startsWith('private:'));
                const agentName = context.selectedAgentKey && context.agents ? 
                    context.agents[context.selectedAgentKey]?.name : '';
                
                let slideTitle = `${fullArtifact.name} Progress`;
                if (isPrivate && agentName) {
                    slideTitle = `${agentName} - ${fullArtifact.name}`;
                }

                const progressSlide = `# ${slideTitle}

**Progress: ${completedItems}/${totalItems} items completed (${progressPercent}%)**

${content}

---
${fullArtifact.metadata?.tags?.length ? `*Tags: ${fullArtifact.metadata.tags.join(', ')}*` : ''}
*Use the checklist tool to update progress*`;

                // Use checklist component if available, otherwise fall back to slides
                if ('showChecklist' in context && typeof (context as any).showChecklist === 'function') {
                    // Show the dedicated checklist component
                    (context as any).showChecklist(checklist.id);
                } else if ('showSlide' in context && typeof (context as any).showSlide === 'function') {
                    // Fallback to slide system with hide/show
                    if ('listActiveSlides' in context && 'hideSlide' in context) {
                        try {
                            const activeSlides = (context as any).listActiveSlides();
                            for (const slide of activeSlides) {
                                // Hide any slide that matches our exact title
                                if (slide.title === slideTitle) {
                                    (context as any).hideSlide(slide.id);
                                }
                            }
                        } catch (error) {
                            logger.warn(error, 'Failed to hide existing progress slide');
                        }
                    }
                    
                    // Show the updated progress slide
                    (context as any).showSlide(slideTitle, progressSlide);
                }

                return {
                    status: 'success',
                    data: {
                        totalItems,
                        completedItems,
                        progressPercent,
                        slideTitle,
                        content: progressSlide,
                        tags: fullArtifact.metadata?.tags || []
                    }
                };
            }

            default:
                return {
                    status: 'error',
                    data: { error: `Invalid action: ${args.action}. Valid actions are: get, check, uncheck, showProgress, discover` }
                };
        }
    } catch (error) {
        return {
            status: 'error',
            data: { error: error instanceof Error ? error.message : 'An error occurred while managing checklist' }
        };
    }
}

