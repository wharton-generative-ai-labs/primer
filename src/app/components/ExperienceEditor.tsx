/**
 * Experience Editor - Main export
 * 
 * This file re-exports the refactored Experience Editor component.
 * The component has been split into multiple smaller, focused modules for better maintainability.
 * 
 * Structure:
 * - ExperienceEditor/
 *   - types.ts - Type definitions
 *   - utils.ts - Utility functions (buildFileTree, enrichSessionFolders)
 *   - hooks/ - Custom React hooks
 *     - useFileTree.ts - File tree state management
 *     - useFileContent.ts - File content loading and saving
 *     - useResizing.ts - Sidebar resizing logic
 *   - components/ - UI components
 *     - FileTreeNode.tsx - Individual tree node renderer
 *     - FileTreeSidebar.tsx - Sidebar with file tree
 *     - EditorPane.tsx - Main editor pane
 *     - dialogs.tsx - Dialog components
 *   - ExperienceEditor.tsx - Main component
 */

export { ExperienceEditor } from './ExperienceEditor/ExperienceEditor';
export type { EditorProps } from './ExperienceEditor/types';