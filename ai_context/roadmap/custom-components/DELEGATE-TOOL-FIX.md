# Delegate Tool Parameter Fix

## Issue

HAL was using incorrect parameter names when calling the `delegate` tool:
- Used `agentKey` instead of `agentType`
- Used `request` instead of `taskDescription`

Additionally, the Interface Designer was asking for task details even though they were provided in the delegation.

## Root Cause

HAL's instructions (`storage/deckard/resources/instructions/agent/deckard.md`) contained an incorrect example:

```javascript
// INCORRECT (what was in the instructions)
delegate({
  agentKey: 'interfaceDesigner',
  request: 'Create a ...'
})
```

The actual tool signature is:

```javascript
// CORRECT
delegate({
  agentType: 'interfaceDesigner',
  taskDescription: 'Create a ...'
})
```

## Fixes Applied

### 1. Fixed HAL's Delegate Example

**File**: `/storage/deckard/resources/instructions/agent/deckard.md`

Changed the delegate example to use correct parameter names:
- `agentKey` → `agentType`
- `request` → `taskDescription`

### 2. Clarified Interface Designer Start Behavior

**File**: `/storage/deckard/resources/instructions/agent/interface-designer.md`

Added explicit directive at the top of the workflow section:

```markdown
**🚨 IMPORTANT: START IMMEDIATELY 🚨**

When you receive a task delegation, the task description is provided in the initial message. DO NOT ask for more information - begin work immediately by following these steps:
```

Also updated step 1 to clarify:
```markdown
### 1. Extract Requirements

From the task description (provided in your initial message), extract:
```

## Verification

The correct delegate tool signature (from `/src/app/lib/tools/delegation/delegate.ts`):

```typescript
/**
 * @tool
 * @description Delegate a task to a backend agent to perform complex processing
 * @param {string} args.agentType - The friendly name of the agent to delegate to
 * @param {string[]} args.artifactIds - Optional array of artifact IDs
 * @param {string} args.taskDescription - Optional description of what the agent should do
 * @param {string[]} args.imageNames - Optional array of image names
 */
export async function delegate(args: {
  agentType: string;
  artifactIds?: string[];
  taskDescription?: string;
  imageNames?: string[];
}, context: ToolContext): Promise<ToolResponse>
```

Tool registration (from `/src/app/lib/tools/delegation/index.ts`):

```typescript
{
  name: 'delegate',
  parameters: {
    properties: {
      agentType: { type: 'string', ... },
      taskDescription: { type: 'string', ... },
      artifactIds: { type: 'array', ... },
      imageNames: { type: 'array', ... }
    }
  }
}
```

## Impact

- HAL will now call delegate with correct parameter names
- Interface Designer will start working immediately instead of asking for clarification
- Reduces wasted token usage and delegation round-trips
