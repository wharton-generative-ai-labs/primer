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
 * @param {string} args.checklistName - Optional substring to narrow which checklist to act on. When omitted, all checklist-type artifacts qualify (filtered further by tags / agent-specific markers).
 * @param {string} args.itemText - Text of the item to check/uncheck
 * @param {string[]} args.tags - Optional array of tags to filter checklists by (e.g., ['private:agentKey'] or ['shared'])
 * @param {object} context - The context object
 * @param {Function} context.listArtifacts - Function to list artifacts
 * @param {Function} context.updateArtifact - Function to update an artifact
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
                // Must be a checklist artifact at minimum.
                if (artifact.type !== 'checklist') return false;

                // If a name pattern is provided, narrow to checklists whose
                // name contains it. Without this, passing `checklistName`
                // had no effect and the first checklist in the list won —
                // which is how a `Design Progress` lookup ended up matching
                // the Intake Checklist.
                if (namePattern && !artifact.name.includes(namePattern)) {
                    return false;
                }

                // If tags are specified, narrow further by tag overlap.
                if (tags && tags.length > 0) {
                    const artifactTags = artifact.metadata?.tags || [];
                    return tags.some((tag) => artifactTags.includes(tag));
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
            // Fallback to original logic with agent-specific enhancement.
            // Pass `args.checklistName` directly — when undefined,
            // findChecklists returns ALL checklist-type artifacts, which is
            // the right "no name pattern" behavior. The previous default of
            // `"Checklist"` was a match-all sentinel that only worked when
            // the type filter was OR'd; under the corrected AND filter it
            // would over-narrow to artifact names containing "Checklist".
            const checklists = await findChecklists(args.checklistName);
            
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
            // Diagnostic: dump what listArtifacts actually returned so the
            // agent (and the dev console) can tell "no artifacts in session"
            // apart from "artifacts present but none are checklists".
            const allArtifacts = await context.listArtifacts();
            const artifactSummary = allArtifacts.map((a: any) => ({
                id: a.id,
                name: a.name,
                type: a.type,
                tags: a.metadata?.tags || [],
            }));

            const searchCriteria = args.tags
                ? `tags: [${args.tags.join(', ')}]`
                : args.checklistName
                  ? `pattern: "${args.checklistName}"`
                  : 'no name/tag filter';

            const diagnostic =
                allArtifacts.length === 0
                    ? 'The session has no artifacts at all yet. Config-declared artifacts may not have finished bootstrapping — retry shortly, or call `checklist({ action: "discover" })` to confirm what is loaded.'
                    : `Session has ${allArtifacts.length} artifact(s) but none match. Available: ${artifactSummary
                          .map(a => `"${a.name}" (type=${a.type}${a.tags.length ? `, tags=[${a.tags.join(',')}]` : ''})`)
                          .join('; ')}. Pass an explicit \`checklistName\` or \`tags\`, or call \`checklist({ action: "discover" })\`.`;

            logger.warn(
                {
                    selectedAgentKey: context.selectedAgentKey,
                    searchCriteria,
                    artifactCount: allArtifacts.length,
                    artifactSummary,
                },
                'checklist tool: no match',
            );

            return {
                status: 'error',
                data: {
                    error: `No checklist found matching ${searchCriteria}. ${diagnostic}`,
                    artifactCount: allArtifacts.length,
                    artifacts: artifactSummary,
                },
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
                let alreadyInDesiredState = false;

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    if (!line.includes(args.itemText)) continue;
                    const isCheckedLine = line.includes('- [x]');
                    const isUncheckedLine = line.includes('- [ ]');
                    if (!isCheckedLine && !isUncheckedLine) continue;

                    // Detect already-in-desired-state to short-circuit. Re-writing
                    // the artifact when there's nothing to change kicks the
                    // model into a loop where it fires
                    // check → showProgress → check again. Returning a clean
                    // `noop:true` with an explicit "continue with the next
                    // step" message breaks that loop without lying to the
                    // model about what the tool did.
                    if (isChecking && isCheckedLine) {
                        alreadyInDesiredState = true;
                        break;
                    }
                    if (!isChecking && isUncheckedLine) {
                        alreadyInDesiredState = true;
                        break;
                    }

                    if (isChecking) {
                        lines[i] = line.replace('- [ ]', '- [x]');
                    } else {
                        lines[i] = line.replace('- [x]', '- [ ]');
                    }
                    updated = true;
                    break;
                }

                if (alreadyInDesiredState) {
                    return {
                        status: 'success',
                        data: {
                            noop: true,
                            message: isChecking
                                ? 'Item is already checked. Continue with the next step.'
                                : 'Item is already unchecked. Continue with the next step.',
                            itemText: args.itemText,
                            checklist_id: checklist.id,
                        },
                    };
                }

                if (!updated) {
                    // Surface the actual item text from the checklist so the
                    // agent can self-correct after a paraphrase. The match is
                    // a substring `includes`, so the agent should reuse one of
                    // these texts (or a unique substring of one).
                    const availableItems = (lines as string[])
                        .filter(
                            (line) =>
                                line.includes('- [ ]') || line.includes('- [x]'),
                        )
                        .map((line) =>
                            line
                                .replace(/^.*?- \[[ x]\]\s*/, '')
                                .trim(),
                        );
                    return {
                        status: 'error',
                        data: {
                            error: `Could not find checklist item containing "${args.itemText}". Pass exact text (or a unique substring) of one of the available items below.`,
                            requested_item_text: args.itemText,
                            available_items: availableItems,
                            checklist_id: checklist.id,
                            checklist_name: checklist.name,
                        },
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

                // Generate dynamic display title based on checklist name and tags
                const isPrivate = fullArtifact.metadata?.tags?.some((tag: string) => tag.startsWith('private:'));
                const agentName = context.selectedAgentKey && context.agents ? 
                    context.agents[context.selectedAgentKey]?.name : '';
                
                let progressTitle = `${fullArtifact.name} Progress`;
                if (isPrivate && agentName) {
                    progressTitle = `${agentName} - ${fullArtifact.name}`;
                }

                const progressContent = `# ${progressTitle}

**Progress: ${completedItems}/${totalItems} items completed (${progressPercent}%)**

${content}

---
${fullArtifact.metadata?.tags?.length ? `*Tags: ${fullArtifact.metadata.tags.join(', ')}*` : ''}
*Use the checklist tool to update progress*`;

                if ('showChecklist' in context && typeof (context as any).showChecklist === 'function') {
                    (context as any).showChecklist(checklist.id);
                }

                return {
                    status: 'success',
                    data: {
                        totalItems,
                        completedItems,
                        progressPercent,
                        progressTitle,
                        content: progressContent,
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
