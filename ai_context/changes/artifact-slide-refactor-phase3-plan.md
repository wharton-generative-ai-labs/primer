# Artifact and Slide Refactoring - Phase 3 Plan

**Date:** 2026-01-21  
**Status:** Planning

## Overview

Phase 3 will complete the refactoring by converting slides to a backend-first model using socket communication, similar to how the `present` and `observe` tools work. This will create a fully unified window management system.

## Goals

1. Convert slide tool to backend-first architecture
2. Deprecate slide-specific show/hide actions in favor of `present` tool
3. Integrate slides fully with UIElementManager
4. Remove duplicate window management code

## Current State (After Phase 2)

```
┌─────────────────────────────────────────────────────────────┐
│                     ARTIFACT TOOL                           │
│  ✅ Backend-first: File storage and retrieval               │
│  ✅ Actions: list, get, create, edit, delete                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      SLIDE TOOL                             │
│  ⚠️  Frontend-first: Uses SlideManager                      │
│  ⚠️  Actions: show, showArtifact, hide, hideAll, list       │
│  ⚠️  Separate from UIElementManager                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   PRESENT/OBSERVE TOOLS                     │
│  ✅ Backend-first: Socket communication                     │
│  ✅ Works with UIElementManager                             │
│  ✅ Actions: show, hide, move, resize, maximize             │
└─────────────────────────────────────────────────────────────┘
```

## Target State (After Phase 3)

```
┌─────────────────────────────────────────────────────────────┐
│                     ARTIFACT TOOL                           │
│  ✅ Backend-first: File storage and retrieval               │
│  Actions: list, get, create, edit, delete                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      SLIDE TOOL                             │
│  ✅ Backend-first: Socket communication                     │
│  Actions: create, createFromArtifact                        │
│  Returns: slideId (PrimerUIElement ID)                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   PRESENT/OBSERVE TOOLS                     │
│  ✅ Backend-first: Socket communication                     │
│  ✅ Works with ALL PrimerUIElements (slides, components)    │
│  Actions: show, hide, move, resize, maximize, observe       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   UI ELEMENT MANAGER                        │
│  ✅ Unified registry for all UI windows                     │
│  ✅ Manages slides, components, notes, diagrams             │
│  ✅ Single source of truth for UI state                     │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Steps

### Step 1: Create Backend-First Slide Creation

**New socket events:**
- `ui.slide.create` - Create a new slide with content
- `ui.slide.createFromArtifact` - Create a slide from artifact ID

**Backend tool changes:**
```typescript
// New slide tool implementation
export async function slide(
  args: {
    action: 'create' | 'createFromArtifact';
    title: string;
    content?: string;      // For 'create'
    artifactId?: string;   // For 'createFromArtifact'
  },
  context: ToolContext
): Promise<ToolResponse> {
  const callId = `slide_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Send socket event to create slide
  context.sendClientEvent({
    type: args.action === 'create' ? 'ui.slide.create' : 'ui.slide.createFromArtifact',
    data: { 
      callId, 
      title: args.title,
      content: args.content,
      artifactId: args.artifactId
    }
  });
  
  // Wait for response with slideId
  const result = await requestManager.createPendingRequest(callId, 'tool_result', 5000);
  
  return {
    status: 'success',
    data: { 
      slideId: result.slideId,  // Returns PrimerUIElement ID
      message: `Slide "${args.title}" created`
    }
  };
}
```

### Step 2: Update Frontend to Handle Socket Events

**File:** `src/app/hooks/useHandleServerEvent.ts`

Add handlers for new slide events:
```typescript
case 'ui.slide.create': {
  // Create slide content
  const slideId = `slide-${generateUUID()}`;
  const slideElement: PrimerUIElement = {
    id: slideId,
    kind: 'slide',
    title: data.title,
    x: 100, y: 100,  // Default position
    w: 600, h: 400,  // Default size
    visible: true,
    zIndex: uiManager.getNextZIndex()
  };
  
  // Register with UIElementManager
  uiManager.register(slideElement);
  
  // Store slide content in SlideManager
  slideManager.storeSlide(slideId, data.content);
  
  // Send response back to backend
  sendToolResult(data.callId, { 
    status: 'success', 
    data: { slideId } 
  });
  break;
}

case 'ui.slide.createFromArtifact': {
  // Fetch artifact content
  const artifact = await getArtifact(data.artifactId);
  
  // Create slide with artifact content
  const slideId = `slide-${generateUUID()}`;
  const slideElement: PrimerUIElement = {
    id: slideId,
    kind: 'slide',
    title: data.title || artifact.name,
    x: 100, y: 100,
    w: 600, h: 400,
    visible: true,
    zIndex: uiManager.getNextZIndex()
  };
  
  uiManager.register(slideElement);
  slideManager.storeSlide(slideId, artifact.content);
  
  sendToolResult(data.callId, { 
    status: 'success', 
    data: { slideId, artifactId: data.artifactId } 
  });
  break;
}
```

### Step 3: Integrate Slides with UIElementManager

**File:** `src/app/lib/tools/ui/slides/SlideManager.tsx`

Update SlideManager to register slides with UIElementManager:
```typescript
class SlideManager implements SlideToolContext {
  createSlide(title: string, content: string, id?: string): string {
    const slideId = id || `slide-${generateUUID()}`;
    
    // Store slide content
    slides[title] = content;
    
    // Create PrimerUIElement
    const element: PrimerUIElement = {
      id: slideId,
      kind: 'slide',
      title,
      x: 100, y: 100,
      w: 600, h: 400,
      visible: true,
      zIndex: 20
    };
    
    // Register with UIElementManager
    const uiManager = getUIElementManager();
    uiManager.register(element);
    
    // Create React component
    const component = <SlideComponent id={slideId} title={title} content={content} />;
    setSlideComponent(slideId, component);
    
    return slideId;
  }
}
```

### Step 4: Update SlideComponent to Use DraggableWindow

**File:** `src/app/lib/tools/ui/slides/SlideComponent.tsx`

Wrap slide content in DraggableWindow:
```typescript
export function SlideComponent({ id, title, content }: SlideComponentProps) {
  const uiManager = getUIElementManager();
  const element = uiManager.get(id);
  
  if (!element) return null;
  
  const callbacks: UIElementCallbacks = {
    onMove: (id, x, y) => uiManager.move(id, x, y),
    onResize: (id, w, h) => uiManager.resize(id, w, h),
    onClose: (id) => uiManager.hide(id),
    onMaximize: (id, maximized) => uiManager.maximize(id, maximized),
    onBringToFront: (id) => uiManager.bringToFront(id)
  };
  
  return (
    <DraggableWindow element={element} callbacks={callbacks}>
      <div className="p-4">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </DraggableWindow>
  );
}
```

### Step 5: Deprecate Old Slide Actions

Update slide tool to only support creation:
```typescript
/**
 * @tool slide
 * @description Create slides to display content. Use 'create' for direct content or 'createFromArtifact' to display artifact content.
 * For window management (show/hide/move/resize), use the 'present' tool.
 * @param {object} args - The arguments for the tool
 * @param {string} args.action - The action to perform: 'create', 'createFromArtifact'
 * @param {string} args.title - Slide title
 * @param {string} args.content - Slide content in markdown (for create)
 * @param {string} args.artifactId - Artifact ID (for createFromArtifact)
 * @returns {Promise<ToolResponse>} Tool response with slideId
 */
```

Remove deprecated actions:
- ~~`show`~~ → Use `create` + `present({ action: 'show' })`
- ~~`hide`~~ → Use `present({ action: 'hide' })`
- ~~`hideAll`~~ → Use `present({ action: 'hideAll' })`
- ~~`list`~~ → Use `observe()` to get all UI elements
- ~~`listActive`~~ → Use `observe()` and filter by visible

### Step 6: Update Agent Prompts

Update all agent prompts to use new pattern:
```markdown
**Old pattern (deprecated):**
```javascript
slide({ action: 'show', title: 'My Slide', content: '# Hello' });
```

**New pattern:**
```javascript
// Create a slide
const result = await slide({ 
  action: 'create', 
  title: 'My Slide', 
  content: '# Hello' 
});
const slideId = result.data.slideId;

// Control the slide window
present({ action: 'show', id: slideId });
present({ action: 'move', id: slideId, x: 200, y: 100 });
present({ action: 'maximize', id: slideId });
```

**Or for artifacts:**
```javascript
// Create slide from artifact
const result = await slide({ 
  action: 'createFromArtifact', 
  artifactId: 'artifact-123',
  title: 'My Artifact' 
});
const slideId = result.data.slideId;

// Control the slide window
present({ action: 'show', id: slideId });
```
```

## Benefits of Phase 3

1. **Unified Architecture**: All UI elements managed consistently
2. **Backend Control**: Backend agents can fully control UI without frontend-specific code
3. **Simplified Code**: Remove duplicate window management logic
4. **Better Separation**: Clear distinction between content creation (slide) and window management (present)
5. **Consistent API**: Same pattern for all UI elements (slides, components, notes, etc.)

## Migration Path

1. **Implement new slide tool** with `create` and `createFromArtifact` actions
2. **Keep old actions** temporarily with deprecation warnings
3. **Update agent prompts** to use new pattern
4. **Test thoroughly** with all agents
5. **Remove deprecated actions** after migration complete

## Files to Modify

- `src/app/lib/tools/ui/slides.ts` - Convert to backend-first
- `src/app/lib/tools/ui/slides/SlideManager.tsx` - Integrate with UIElementManager
- `src/app/lib/tools/ui/slides/SlideComponent.tsx` - Use DraggableWindow
- `src/app/hooks/useHandleServerEvent.ts` - Add socket event handlers
- All agent prompts - Update to use new pattern

## Testing Checklist

- [ ] Backend agents can create slides via socket
- [ ] Slides appear in UIElementManager registry
- [ ] Slides appear in WindowManager taskbar
- [ ] Present tool works with slides (show/hide/move/resize)
- [ ] Observe tool returns slide information
- [ ] SlideComponent uses DraggableWindow
- [ ] Slides can be maximized/restored
- [ ] Slides can be anchored to edges
- [ ] Multiple slides can be managed simultaneously
- [ ] Experience Builder works with new slide pattern

## Timeline

Phase 3 should be implemented after:
1. Phase 1 & 2 are tested and stable
2. Experience Builder is confirmed working
3. All agents are verified to not use deprecated artifact show

Estimated effort: 4-6 hours of development + testing
