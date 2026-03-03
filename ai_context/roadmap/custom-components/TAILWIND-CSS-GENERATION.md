# Tailwind CSS Generation for Dynamic Components

## Problem

Dynamically created components using Tailwind utility classes (like `text-8xl`, `text-blue-600`) were not rendering with the expected styles. The classes were present in the JSX but no corresponding CSS was generated.

**Root cause**: Tailwind is a build-time tool that scans source files and generates CSS. Runtime-compiled JSX components bypass this process, so Tailwind classes become inert strings.

## Solution

Implemented backend CSS generation using Tailwind CLI that runs after component deployment.

### Architecture

**Flow:**
1. Interface Designer creates component JSX
2. Component is validated and deployed to storage
3. **NEW**: `generateComponentStyles` tool runs Tailwind CLI on the deployed file
4. Tailwind generates a companion `.css` file next to the `.jsx` file
5. ComponentManager loads both JSX and CSS when showing the component
6. CSS is injected into `<head>` as a `<style>` tag

### Implementation

#### 1. New Tool: `generateComponentStyles`

**File**: `/src/app/lib/tools/experience/experience.ts`

```typescript
export async function generateComponentStyles(
    args: { componentId: string; experienceId?: string },
    context: ToolContext
): Promise<ToolResponse>
```

**What it does:**
- Gets storage root using `StorageServiceFactory.getStorageRoot()`
- Constructs full path to component JSX file
- Runs: `npx tailwindcss --content "${componentPath}" -o "${cssPath}" --minify`
- Creates `component-id.css` next to `component-id.jsx`

**Tool registration**: Added to experience tools, available to backend agents.

#### 2. Storage Root Helper

**File**: `/src/app/lib/storage/StorageServiceFactory.ts`

Added static method:
```typescript
static getStorageRoot(): string {
  return env.STORAGE_ROOT_PATH || path.join(process.cwd(), 'storage');
}
```

**Why**: Centralized logic for resolving storage path (respects `STORAGE_ROOT_PATH` env var for external storage).

#### 3. ComponentManager CSS Loading

**File**: `/src/app/lib/tools/ui/components/ComponentManager.tsx`

**New method**: `loadComponentCSS(componentId: string)`
- Fetches CSS file from storage API
- Injects as `<style id="component-css-{componentId}">` in `<head>`
- Gracefully handles missing CSS (optional, not all components need it)

**Modified**: `loadComponent()` now calls `loadComponentCSS()` after loading JSX

**Modified**: `clearComponentCache()` now also removes CSS `<style>` tag

#### 4. Interface Designer Workflow

**File**: `/storage/deckard/resources/instructions/agent/interface-designer.md`

Added **Step 5: Generate Tailwind CSS**:
```javascript
generateComponentStyles({
  componentId: 'component-id'
})
```

Placed after deployment, before updating `experience.json`.

### How It Works

**Creation Flow:**
1. JSX deployed → `resources/components/simple-counter.jsx`
2. `generateComponentStyles` called → Tailwind CLI runs
3. CSS created → `resources/components/simple-counter.css`
4. ComponentManager loads component → injects both JSX and CSS
5. Tailwind classes now work ✅

**Update Flow:**
1. Updated JSX deployed
2. `generateComponentStyles` called → regenerates CSS
3. `clearCache` called → removes old CSS tag and cached JSX
4. Next `show` → loads fresh JSX and CSS

### Benefits

✅ **Full Tailwind support**: Any utility class works
✅ **No safelist needed**: Only generates CSS for classes actually used
✅ **Minimal CSS**: Tailwind JIT only includes used utilities
✅ **Fast**: ~200-500ms per component (negligible vs. agent time)
✅ **Clean separation**: CSS lives next to component, not in global bundle
✅ **Cache-friendly**: CSS reloads when component cache is cleared

### Deployment Requirements

**Server needs:**
- Node.js (already present)
- `tailwindcss` npm package
- `tailwind.config.ts` (already present)

**Render.com / Production:**
- Add `"tailwindcss": "^3.4.0"` to `package.json` dependencies
- That's it! No special configuration needed

### Files Changed

**Core Implementation:**
- `/src/app/lib/storage/StorageServiceFactory.ts` - Added `getStorageRoot()` helper
- `/src/app/lib/tools/experience/experience.ts` - Added `generateComponentStyles` function
- `/src/app/lib/tools/experience/index.ts` - Registered new tool
- `/src/app/lib/tools/groups.ts` - Added `validateComponent` and `generateComponentStyles` to 'experience' tool group
- `/src/app/lib/tools/ui/components/ComponentManager.tsx` - Added CSS loading and injection

**Agent Instructions:**
- `/storage/deckard/resources/instructions/agent/interface-designer.md` - Added CSS generation step

**Tests:**
- `/src/app/lib/tools/__tests__/groups.test.ts` - Updated experience tool group test

**Documentation:**
- `/ai_context/reference/tool-groups.md` - Updated experience tool group documentation
- `/ai_context/roadmap/custom-components/TAILWIND-CSS-GENERATION.md` - This document

### Testing

To test the fix:

1. Ask HAL to create a component with Tailwind classes
2. Interface Designer should call `generateComponentStyles` after deployment
3. Component should render with proper Tailwind styling
4. To update: Interface Designer redeploys, regenerates CSS, HAL clears cache

### Future Enhancements

Potential improvements:
- Pre-validate CSS generation during `validateComponent` step
- Batch CSS generation for multiple components
- Support for custom Tailwind configurations per component
- Hot reload detection to auto-regenerate CSS

### Limitations

- Requires Tailwind CLI execution (adds ~200-500ms per component)
- CSS is component-scoped (each component gets its own CSS file)
- Requires file system access (can't work with pure in-memory storage)
- Tailwind CLI must be in `node_modules` or globally available
