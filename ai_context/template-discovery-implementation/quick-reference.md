# Template Discovery - Quick Reference

## Architecture in One Sentence

**Conceptual agents** (Intake, Design) select template **types** ("Roleplay"/"Teachback"), while **technical agents** (Casting Director, Experience Builder) discover folder **IDs** (UUIDs) and implement.

---

## Terminology

| Term | Meaning | Example | Used By |
|------|---------|---------|---------|
| **Template Type** | Conceptual category (mentioned in text) | "Roleplay" or "Teachback" | Intake, Design |
| **Template Title** | Human-readable name (in experience.json) | "Roleplay Template Experience" | Discovery matching |
| **Template ID** / **Folder ID** | Physical storage location (UUID) | "a1b2c3d4-uuid" | Casting, Experience Builder |

**Key**: No tool or function parameter is called "templateType". The type is mentioned naturally in text and parsed by technical agents.

---

## Agent Responsibilities

### Intake Agent
- ✅ Selects template type based on learning objectives
- ✅ Mentions type naturally in task description: `"Build a Roleplay experience"`
- ❌ Does NOT discover folder IDs
- ❌ Does NOT use `listTemplateExperiences`

### Design Agent  
- ✅ Mentions template type naturally in design document text
- ✅ Example: "This simulation uses the Roleplay template structure..."
- ❌ Does NOT discover folder IDs
- ❌ Does NOT use `listTemplateExperiences`

### Casting Director
- ✅ Reads design document to find mention of template type (Roleplay or Teachback)
- ✅ Uses `listTemplateExperiences` to discover templates
- ✅ Finds template by matching title to the type keyword
- ✅ Uses discovered folder ID in `getTemplateAgentInstructions`

### Experience Builder
- ✅ Parses task description to find template type keyword (Roleplay or Teachback)
- ✅ Uses `listTemplateExperiences` to discover templates
- ✅ Finds template by matching title to the type keyword
- ✅ Uses discovered folder ID in `copyTemplate`

---

## Code Examples

### Intake Agent (Conceptual)
```javascript
// Decide which type based on learning objectives
// Decision: "This should be a Roleplay experience"

// Mention type naturally in task description
delegate({
  agentType: "Experience Builder",
  taskDescription: "Build a Roleplay experience" // Plain English
});
```

### Experience Builder (Technical)
```javascript
// Parse task description to find keyword
// taskDescription = "Build a Roleplay experience"
const isRoleplay = taskDescription.includes("Roleplay");
const keyword = isRoleplay ? "Roleplay" : "Teachback";

// Discover folder ID
const result = await listTemplateExperiences();
const template = result.templates.find(t => t.title.includes(keyword));
const folderId = template.id; // "a1b2c3d4-uuid"

// Use folder ID
await copyTemplate({ templateExperienceId: folderId });
```

---

## File Changes Summary

### Code (Under Source Control)
- `src/app/lib/tools/experience/template-tools.ts` - Added `kind` field
- `src/app/lib/tools/experience/index.ts` - Enhanced tool description

### Storage (Manual Update Required)
- `storage/intake-agent/resources/instructions/supplemental/templates.md`
- `storage/intake-agent/resources/instructions/agent/intake.md`
- `storage/intake-agent/resources/instructions/agent/design-agent.md`
- `storage/intake-agent/resources/instructions/agent/casting-director.md`
- `storage/intake-agent/resources/instructions/agent/experience-builder.md`

---

## Testing Checklist

- [ ] Deploy code changes
- [ ] Update 5 storage files on staging/production
- [ ] Test Intake Agent selects template type (not ID)
- [ ] Test Casting Director discovers folder ID
- [ ] Test Experience Builder discovers folder ID
- [ ] Test full pipeline end-to-end
- [ ] Test resilience: delete/re-upload template with new UUID

---

## Key Benefits

1. **Separation of concerns** - Pedagogy vs implementation
2. **No hardcoded folder names** - Discovery is dynamic
3. **Resilient to template re-uploads** - New UUIDs work automatically
4. **Maintainable** - Conceptual agents never need updating
5. **Production-ready** - Works with UUID-based storage

---

## Additional Documentation

- `ARCHITECTURE_CLARIFICATION.md` - Detailed architecture explanation
- `TEMPLATE_DISCOVERY_CHANGES.md` - Complete change log
- `IMPLEMENTATION_SUMMARY.md` - High-level summary
- `STORAGE_FILES_TO_UPDATE.md` - File update commands
