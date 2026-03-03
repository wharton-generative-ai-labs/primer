# Template Discovery Architecture - Conceptual vs Technical

## The Problem We Solved

Previously, agents assumed template folder names were fixed (e.g., "roleplay-template"). In production, templates uploaded via the Experience Catalog get random UUID folder names, breaking this assumption.

## The Solution: Separation of Concerns

We created a clear architectural boundary between **conceptual** and **technical** concerns:

### Conceptual Layer (High-Level Agents)

**Agents:** Intake Agent, Design Agent

**Responsibility:** Select the **type** of experience based on pedagogy
- "Should this be a Roleplay or Teachback experience?"
- Focus on learning objectives, not technical implementation

**What they work with:**
- Template **types**: "Roleplay", "Teachback"
- Template **titles**: Human-readable names containing the type

**What they DON'T work with:**
- Folder IDs (UUIDs)
- Storage locations
- Technical discovery

**Example:**
```javascript
// Intake Agent determines type based on learning objectives
// Decides: "This should be a Roleplay experience"

// Passes this naturally in the task description
delegate({
  taskDescription: "Build a Roleplay experience" // Mentions type in plain English
});
```

### Technical Layer (Implementation Agents)

**Agents:** Casting Director, Experience Builder

**Responsibility:** Discover actual storage locations and implement the experience
- "Where is the Roleplay template actually stored?"
- Handle the technical details of template discovery

**What they work with:**
- Template **IDs**: Folder names (UUIDs like "a1b2c3d4-uuid")
- Storage locations
- Template discovery via `listTemplateExperiences`

**Example:**
```javascript
// Experience Builder receives task description from Intake Agent
// taskDescription = "Build a Roleplay experience"

// Parses to extract template type
const isRoleplay = taskDescription.includes("Roleplay");
const isTeachback = taskDescription.includes("Teachback");

// Discovers actual folder ID
const templates = await listTemplateExperiences();
const template = templates.find(t => 
  isRoleplay ? t.title.includes("Roleplay") : t.title.includes("Teachback")
);
const folderId = template.id; // e.g., "a1b2c3d4-uuid"

// Uses technical folder ID
await copyTemplate({ templateExperienceId: folderId });
```

## Complete Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      CONCEPTUAL LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  INTAKE AGENT                                                     │
│  └─ Determines: "This should be a Roleplay experience"          │
│  └─ Delegates: "Build a Roleplay experience"                    │
│                                                                   │
│  DESIGN AGENT                                                     │
│  └─ Writes: "This simulation uses the Roleplay template..."     │
│  └─ Focuses on pedagogy, not implementation                      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Mentions "Roleplay" in plain text
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      TECHNICAL LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  CASTING DIRECTOR                                                 │
│  └─ Reads design doc: finds mention of "Roleplay"               │
│  └─ Discovers: Uses listTemplateExperiences()                   │
│  └─ Finds: template with title "Roleplay Template Experience"   │
│  └─ Extracts: folderId = "a1b2c3d4-uuid"                        │
│  └─ Uses: getTemplateAgentInstructions(folderId, agentKey)     │
│                                                                   │
│  EXPERIENCE BUILDER                                               │
│  └─ Parses task: finds keyword "Roleplay"                       │
│  └─ Discovers: Uses listTemplateExperiences()                   │
│  └─ Finds: template with title "Roleplay Template Experience"   │
│  └─ Extracts: folderId = "a1b2c3d4-uuid"                        │
│  └─ Uses: copyTemplate(folderId)                                │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Why This Architecture?

### 1. Maintainability
- Intake/Design agent prompts never need updating when templates are re-uploaded
- Only technical agents need to understand folder IDs and discovery

### 2. Clarity
- Each agent has a clear, focused responsibility
- Conceptual agents think pedagogically, technical agents think programmatically

### 3. Robustness
- Templates can be deleted/re-uploaded with new UUIDs without affecting conceptual agents
- Discovery happens at the technical layer where it belongs

### 4. Scalability
- Adding new template types only requires updating conceptual agents
- Technical discovery mechanism works for any number of templates

## Discovery Mechanism

Both technical agents use the same discovery pattern:

```javascript
// 1. Parse incoming text to find template type keyword
// From taskDescription like "Build a Roleplay experience"
// or from design doc text mentioning "uses the Roleplay template"
// Look for keywords: "Roleplay" or "Teachback"

// 2. List all templates
const result = await listTemplateExperiences();
// Returns: [
//   { id: "a1b2c3d4-uuid", title: "Roleplay Template Experience", kind: "template" },
//   { id: "e5f6g7h8-uuid", title: "Teachback Template Experience", kind: "template" }
// ]

// 3. Find template by matching title to keyword
const template = result.templates.find(t => t.title.includes("Roleplay")); // or "Teachback"

// 4. Extract folder ID
const folderId = template.id; // "a1b2c3d4-uuid"

// 5. Use folder ID in tool calls
await copyTemplate({ templateExperienceId: folderId });
// or
await getTemplateAgentInstructions({ templateExperienceId: folderId, agentKey: "mentor" });
```

## Key Terminology Changes

| Old Term | New Term (Conceptual) | New Term (Technical) |
|----------|----------------------|---------------------|
| "template ID" | "Roleplay experience" or "Teachback experience" | "template folder ID" |
| "roleplay-template" | Mentions "Roleplay" in text | "a1b2c3d4-uuid" |
| "teachback-template" | Mentions "Teachback" in text | "e5f6g7h8-uuid" |

## Benefits

✅ **Clear separation of concerns** - Pedagogy vs implementation
✅ **No hardcoded folder names** - Discovery is dynamic
✅ **Resilient to re-uploads** - Templates can change IDs freely
✅ **Production-ready** - Works with UUID-based folder names
✅ **Maintainable** - Conceptual agents isolated from technical changes
✅ **Scalable** - Easy to add new template types

## Testing the Architecture

### Conceptual Layer Test:
1. Start new session with Intake Agent
2. Verify agent discusses template **types** ("Roleplay" or "Teachback")
3. Check delegation passes `templateType` not `templateId`

### Technical Layer Test:
1. Monitor Casting Director and Experience Builder
2. Verify they call `listTemplateExperiences` first
3. Check they extract folder IDs from discovery results
4. Confirm they use UUIDs in technical tool calls

### Resilience Test:
1. Delete a template from storage
2. Re-upload it via Experience Catalog (gets new UUID)
3. Create new experience with Intake Agent
4. Verify system discovers new UUID and works correctly
