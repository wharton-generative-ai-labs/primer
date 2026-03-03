# Experience Builder Template Failure Analysis
**Date:** December 17, 2024  
**Session:** sess_a05b89c9-2fcf-44e3-bde9-b96f5ae8d7b1  
**Failed Experience:** Python Functions Teachback Simulation_1.0.0_2512162320

## Summary
The Experience Builder agent attempted to create an Experience using the teachback-template but failed, resulting in a non-functional Experience with incorrect structure. The root cause was a field name mismatch preventing template copying, leading to a cascade of fallback decisions that produced invalid output.

## Root Cause: Template Copy Failure

### Primary Issue: status vs kind Field Mismatch

The `copyTemplate` function in `template-tools.ts` checks if `experienceConfig.status === 'template'` (lines 42-47), but the actual templates use `"kind": "template"` instead.

**Code in template-tools.ts:**
```typescript
// Verify it's a template
if (experienceConfig.status !== 'template') {
  return {
    status: 'error',
    data: { error: `Experience '${templateExperienceId}' is not a template (status: ${experienceConfig.status || 'undefined'})` }
  };
}
```

**Actual template structure:**
```json
{
  "version": "1.0.3",
  "kind": "template",
  "title": "Teachback Template Experience (analytics)",
  ...
}
```

This mismatch caused the `copyTemplate` call to fail with "Template not found in system", forcing the Experience Builder into fallback mode.

## Cascading Failures

### 1. Missing Template Structure
When the Experience Builder couldn't copy from the template, it created agent prompts from scratch. The template uses sophisticated "embedded version" prompts with:
- Placeholder text like `[CASTING DIRECTOR, INSERT APPROPRIATE CHARACTER CONTEXT]`
- Detailed `<thinking>` blocks guiding agent behavior
- Specific transcript retrieval and usage instructions
- Complex interaction flows with specific tool usage patterns
- Audio performance guidelines for natural speech

The created prompts were basic, generic instructions lacking this pedagogical depth.

### 2. Simplified Supplemental Files
The created `tools.md` file was extremely basic (24 lines) compared to the template's rich content (80+ lines with detailed slide-building techniques and general tool guidance).

**Why it chose these specific files:** The Experience Builder knew to create `agent.md`, `tools.md`, `errorHandling.md`, and `scene.md` because these are **explicitly documented** in its instructions:

- In `matter-compiler-guide.md` lines 262-267: Shows exact supplemental structure
- In `experience-builder.md` line 176: "Ensure all placeholders like agent, tools, errorHandling, scene can be resolved"
- Repeated throughout (lines 307, 311, 368)

These weren't guesses - they were explicitly specified as required supplemental file names.

### 3. Scenes Structure Error

**Critical Runtime Error:** The created Experience has:
```json
"scenes": {
  "mentor-scene": "resources/scenes/mentor-scene.png",
  "practice-scene": "resources/scenes/practice-scene.png",
  "feedback-scene": "resources/scenes/feedback-scene.png"
}
```

**But the system expects:**
```json
"scenes": [
  "resources/scenes/mentor-scene.png",
  "resources/scenes/practice-scene.png",
  "resources/scenes/feedback-scene.png"
]
```

**Error message:** "resources.scenes MISSING: Scenes array is required but was not found in configuration"

**Why this happened:**

1. The `createExperience` tool creates a baseline with `scenes: []` (empty array)
2. The `modifyScene` tool assumes scenes is an array and uses `.push()` and `.filter()`
3. The tool **failed** - process notes show `modifyScene × 3 - Failed (tool error): "Cannot read properties of undefined"`
4. The Experience Builder fell back to manually editing `experience.json` using `createFile`
5. **It chose an object structure by following the pattern of sibling structures:**
   - `resources.instructions.agent` is an object: `{"mentor": "...", "practice": "..."}`
   - `resources.instructions.supplemental` is an object: `{"agent": "...", "tools": "..."}`
   - `agents` is an object: `{"mentor": {...}, "practice": {...}}`

The Experience Builder made a **logical inference** based on structural consistency - "if instructions and agents use keyed objects, scenes should too." This is actually a sensible pattern from an API design perspective, but it doesn't match the implementation.

## Experience Builder's Decision Process

1. ✅ "I need to use teachback-template" (from task)
2. ❌ `copyTemplate` failed (status/kind mismatch)
3. ✅ "I'll create from scratch" (fallback mode)
4. ✅ "I need supplemental files: agent, tools, errorHandling, scene" (from explicit instructions)
5. ✅ "I'll create those files with reasonable content" (inference)
6. ❌ `modifyScene` failed (tool error)
7. ✅ "I'll manually create the scenes section in experience.json" (manual fallback)
8. ⚠️ "I'll use an object structure like the other resources" (pattern matching from siblings)
9. ❌ **Result: structural mismatch causes runtime error**

## Required Fixes

1. **Primary Fix:** Update `template-tools.ts` to check for `kind: "template"` instead of (or in addition to) `status: "template"`

2. **Secondary Fixes:**
   - Ensure Experience Builder reports errors back to Intake Agent rather than silently falling back
   - Consider using `getTemplateAgentInstructions` as a fallback if directory copying fails
   - Clarify in matter-compiler-guide.md that scenes is an array of strings

3. **Verification Needed:**
   - Check if other template-related code has similar mismatches
   - Both `roleplay-template` and `teachback-template` use `kind: "template"`

## Conclusion

The Experience Builder made **educated, reasonable inferences** based on patterns it observed in its instruction documents, but those inferences didn't match the actual runtime implementation expectations. The scenes-as-object decision was particularly logical from a data modeling perspective - it just happened to be wrong for this specific system.

The core issue is the field name mismatch that prevented template access. Without access to the real template, the Experience Builder did its best to reconstruct a functional experience, making intelligent guesses that were structurally valid but incompatible with the runtime expectations.
