# Experience Editor

A modular, maintainable file editor component for managing experience resources.

## Overview

The Experience Editor provides a full-featured file browser and editor interface for managing experience resources. It includes:

- **File Tree Browser** - Navigate through folders and files
- **Code Editor** - Edit text files with syntax highlighting
- **Media Preview** - View images and play audio files
- **File Operations** - Create, delete, and move files/folders
- **Session Management** - Track and display session metadata

## Architecture

This component is organized into focused, testable modules:

```
ExperienceEditor/
├── types.ts              # TypeScript type definitions
├── utils.ts              # Pure utility functions
├── hooks/                # Custom React hooks
│   ├── useFileTree.ts    # File tree state management
│   ├── useFileContent.ts # File content operations
│   └── useResizing.ts    # Sidebar resizing logic
├── components/           # UI components
│   ├── FileTreeNode.tsx  # Tree node renderer
│   ├── FileTreeSidebar.tsx # Sidebar container
│   ├── EditorPane.tsx    # Main editor area
│   └── dialogs.tsx       # Dialog components
└── ExperienceEditor.tsx  # Main orchestrator component
```

## Usage

### Basic Usage

```typescript
import { ExperienceEditor } from '@/app/components/ExperienceEditor';

function MyComponent() {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  return (
    <ExperienceEditor
      experienceId="my-experience"
      visible={true}
      onUnsavedChangesChange={setHasUnsavedChanges}
      hasUnsavedChanges={hasUnsavedChanges}
    />
  );
}
```

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `experienceId` | `string` | Yes | ID of the experience to edit |
| `visible` | `boolean` | No | Whether the editor is visible (default: true) |
| `onUnsavedChangesChange` | `(hasChanges: boolean) => void` | No | Callback when unsaved changes state changes |
| `hasUnsavedChanges` | `boolean` | No | External control of unsaved changes state |

## Modules

### Types (`types.ts`)

Centralized type definitions for the entire component.

```typescript
import type { TreeNode, Resource, EditorProps } from './types';
```

### Utilities (`utils.ts`)

Pure functions for data transformation.

```typescript
import { buildFileTree, enrichSessionFolders } from './utils';

// Convert flat resource list to tree structure
const tree = buildFileTree(resources);

// Add session metadata to tree
const enrichedTree = await enrichSessionFolders(tree, experienceId, sessionId);
```

### Custom Hooks

#### `useFileTree`

Manages file tree state and operations.

```typescript
const { 
  fileTree,      // Current tree structure
  error,         // Error state
  loadResources, // Reload tree
  toggleFolder   // Expand/collapse folder
} = useFileTree({ experienceId, currentSessionId });
```

#### `useFileContent`

Handles file content loading and saving.

```typescript
const {
  content,              // Current file content
  loading,              // Loading state
  saveStatus,           // 'idle' | 'saving' | 'saved' | 'error'
  hasUnsavedChanges,    // Unsaved changes flag
  isText,               // Is text file
  handleContentChange,  // Update content
  handleSave            // Save file
} = useFileContent({ experienceId, selectedPath, onUnsavedChangesChange });
```

#### `useResizing`

Manages sidebar resizing.

```typescript
const {
  sidebarWidth,   // Current width (200-800px)
  startResizing   // Mouse down handler
} = useResizing();
```

### Components

#### `FileTreeNode`

Renders individual tree nodes with context menus.

```typescript
<FileTreeNode
  node={node}
  level={0}
  selectedPath={selectedPath}
  onToggleFolder={toggleFolder}
  onFileSelect={handleFileSelect}
  onCreateFile={handleCreateFile}
  onCreateFolder={handleCreateFolder}
  onDelete={handleDelete}
/>
```

#### `FileTreeSidebar`

Container for the file tree.

```typescript
<FileTreeSidebar
  fileTree={fileTree}
  selectedPath={selectedPath}
  sidebarWidth={sidebarWidth}
  onToggleFolder={toggleFolder}
  onFileSelect={handleFileSelect}
  onCreateFile={handleCreateFile}
  onCreateFolder={handleCreateFolder}
  onDelete={handleDelete}
/>
```

#### `EditorPane`

Main editor area for file content.

```typescript
<EditorPane
  selectedPath={selectedPath}
  content={content}
  loading={loading}
  saveStatus={saveStatus}
  error={error}
  hasUnsavedChanges={hasUnsavedChanges}
  contentType={contentType}
  fileUrl={fileUrl}
  isText={isText}
  fileTree={fileTree}
  onContentChange={handleContentChange}
  onSave={handleSave}
  onErrorDismiss={handleErrorDismiss}
/>
```

#### Dialog Components

```typescript
import { 
  UnsavedChangesDialog,
  CreateDialog,
  DeleteDialog,
  MoveDialog 
} from './components/dialogs';
```

## Features

### File Tree

- **Hierarchical Display** - Folders and files in tree structure
- **Expand/Collapse** - Toggle folder visibility
- **Session Highlighting** - Current session marked with 🟢
- **Session Metadata** - Display user name and timestamp
- **Context Menus** - Right-click for file operations

### File Operations

- **Create** - New files and folders
- **Delete** - Remove files and folders
- **Move** - Relocate files and folders (dialog available)
- **Edit** - Modify text file content
- **Save** - Persist changes to server

### Content Display

- **Text Files** - Syntax-highlighted editing with CodeMirror
- **Images** - Preview with zoom
- **Audio** - Built-in player
- **Binary Files** - Download option

### User Experience

- **Unsaved Changes Warning** - Prevent accidental data loss
- **Resizable Sidebar** - Adjust tree width (200-800px)
- **Loading States** - Visual feedback during operations
- **Error Handling** - Clear error messages
- **Keyboard Support** - Enter to confirm dialogs

## Testing

### Unit Tests

Test utility functions independently:

```typescript
import { buildFileTree } from './utils';

describe('buildFileTree', () => {
  it('should convert flat resources to tree', () => {
    const resources = [
      { path: 'folder/file.txt', type: 'file' },
      { path: 'folder', type: 'directory' }
    ];
    const tree = buildFileTree(resources);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(1);
  });
});
```

### Hook Tests

Test hooks with React Testing Library:

```typescript
import { renderHook } from '@testing-library/react';
import { useFileTree } from './hooks/useFileTree';

describe('useFileTree', () => {
  it('should load resources on mount', async () => {
    const { result, waitForNextUpdate } = renderHook(() =>
      useFileTree({ experienceId: 'test', currentSessionId: null })
    );
    await waitForNextUpdate();
    expect(result.current.fileTree).toBeDefined();
  });
});
```

### Component Tests

Test components in isolation:

```typescript
import { render, screen } from '@testing-library/react';
import { FileTreeNode } from './components/FileTreeNode';

describe('FileTreeNode', () => {
  it('should render folder with expand icon', () => {
    const node = { name: 'test', path: 'test', type: 'folder', children: [] };
    render(<FileTreeNode node={node} level={0} {...handlers} />);
    expect(screen.getByText('test')).toBeInTheDocument();
  });
});
```

## Performance

### Optimizations

- **Memoization** - Hooks use `useCallback` for stable references
- **Lazy Loading** - Content loaded only when file selected
- **Efficient Updates** - Tree updates use immutable patterns
- **Debouncing** - Resize operations are optimized

### Potential Improvements

- Add `React.memo()` to `FileTreeNode` for large trees
- Virtualize tree rendering for 1000+ files
- Implement incremental tree loading
- Add file content caching

## API Endpoints

The component interacts with these API endpoints:

- `GET /api/resources?experienceId={id}` - List all resources
- `GET /api/resource-content?experienceId={id}&path={path}` - Get file content
- `POST /api/save-resource` - Save file content
- `POST /api/experience` - Create/delete/move operations
- `GET /api/session-metadata?experienceId={id}&sessionId={id}` - Get session info

## Styling

The component uses Tailwind CSS with custom theme colors:

- `text-terminal-directory` - Folder text color
- `text-terminal-file` - File text color
- `text-franklin-red` - Error color
- `text-cobalt` - Link color
- `bg-black/30` - Semi-transparent backgrounds
- `backdrop-blur-lg` - Frosted glass effect

## Accessibility

- **Keyboard Navigation** - Full keyboard support
- **ARIA Labels** - Screen reader friendly
- **Focus Management** - Proper focus handling in dialogs
- **Color Contrast** - Meets WCAG guidelines

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Opera 76+

## Dependencies

- React 19+
- Next.js 15+
- CodeMirror (via `CodeMirrorWrapper`)
- Lucide React (icons)
- Tailwind CSS
- shadcn/ui components

## Troubleshooting

### File tree not loading

Check that:
1. `experienceId` is valid
2. API endpoint `/api/resources` is accessible
3. User has permission to view resources

### Save not working

Verify:
1. File is a text file (`isText === true`)
2. User has write permissions
3. API endpoint `/api/save-resource` is accessible

### Session not highlighted

Ensure:
1. `sessionStorage.getItem('primer:session-id')` returns valid ID
2. Session folder follows `sess_*` naming pattern
3. Session is in `session_data/` directory

## Contributing

When modifying this component:

1. **Keep modules focused** - Each file should have one responsibility
2. **Add tests** - Test new functionality
3. **Update types** - Keep `types.ts` current
4. **Document changes** - Update this README
5. **Check linting** - Run `npm run lint`

## Related Documentation

- [Experience Specification](../../../ExperienceSpecification.md)
- [Adding Tools Guide](../../../../context/guides/adding-tools.md)
- [Experience Workflow](../../../../context/guides/experience-workflow.md)

## License

MPL-2.0 - See LICENSE file for details

