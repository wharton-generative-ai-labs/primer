/**
 * Tool Display Name Utilities
 * 
 * Converts tool names and actions into human-readable display strings
 * for the delegation status UI.
 */

// Verb dictionary mapping actions to their present participle form
const VERB_DISPLAY: Record<string, string> = {
  // Common CRUD operations
  create: 'Creating',
  delete: 'Deleting',
  modify: 'Modifying',
  add: 'Adding',
  remove: 'Removing',
  
  // Read operations
  get: 'Getting',
  list: 'Listing',
  discover: 'Discovering',
  
  // Display operations
  show: 'Showing',
  hide: 'Hiding',
  display: 'Displaying',
  
  // State operations
  save: 'Saving',
  check: 'Checking',
  uncheck: 'Unchecking',
  move: 'Moving',
  sync: 'Syncing',
  
  // Agent operations
  transfer: 'Transferring',
  delegate: 'Delegating',
  
  // Media operations
  play: 'Playing',
  
  // Modification operations
  edit: 'Editing',
  update: 'Updating',
  
  // Deployment operations
  deploy: 'Deploying',
  validate: 'Validating',
  generate: 'Generating',
  copy: 'Copying',
  
  // Misc operations
  set: 'Setting',
  describe: 'Describing',
  
  // Matter compiler operations
  request: 'Requesting',
  change: 'Changing',
  bring: 'Bringing',
  toggle: 'Toggling',
} as const;

/**
 * Split a camelCase string into words
 * Example: "validateComponent" -> ["validate", "Component"]
 */
function splitCamelCase(str: string): string[] {
  return str.split(/(?=[A-Z])/);
}

/**
 * Get a human-readable display name for a tool and optional action
 * 
 * Logic:
 * 1. If action provided and in verb table: "{Verb} {tool name}"
 * 2. Else split tool name on camelCase, check if first word is verb: "{Verb} {rest of name}"
 * 3. Else fallback: "Using {toolName}"
 * 
 * Examples:
 * - ("artifact", "create") -> "Creating artifact"
 * - ("validateComponent", undefined) -> "Validating component"
 * - ("sessionEvent", undefined) -> "Using sessionEvent"
 */
export function getToolDisplayName(toolName: string, action?: string): string {
  // Case 1: Action provided and in verb table
  if (action && VERB_DISPLAY[action.toLowerCase()]) {
    const verb = VERB_DISPLAY[action.toLowerCase()];
    return `${verb} ${toolName.toLowerCase()}`;
  }
  
  // Case 2: No action, try to extract verb from tool name
  const words = splitCamelCase(toolName);
  const firstWord = words[0].toLowerCase();
  
  if (VERB_DISPLAY[firstWord]) {
    const verb = VERB_DISPLAY[firstWord];
    const rest = words.slice(1).join(' ').toLowerCase();
    return rest ? `${verb} ${rest}` : `${verb}`;
  }
  
  // Case 3: Fallback
  return `Using ${toolName}`;
}
