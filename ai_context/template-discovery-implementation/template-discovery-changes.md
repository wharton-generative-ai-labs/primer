# Template Discovery Implementation - Change Summary

## Overview

This document outlines all changes made to implement dynamic template discovery, ensuring agents never rely on hardcoded template folder names. The implementation creates a clear separation of concerns:

- **Conceptual Agents** (Intake, Design): Work with template **types** (e.g., "Roleplay", "Teachback")
- **Technical Agents** (Casting Director, Experience Builder): Discover actual folder **IDs** (UUIDs) and handle implementation

## Key Concepts

### Template Type vs Template ID

- **Template Type**: Conceptual category (e.g., "Roleplay", "Teachback") - encoded in template **title**
- **Template ID**: Physical folder name (e.g., "a1b2c3d4-uuid") - the actual storage location
- **Template Title**: Human-readable name (e.g., "Roleplay Template Experience") - contains the type

### Agent Responsibilities

**Intake Agent**: 
- Selects template **type** based on learning objectives
- Passes type to downstream agents (e.g., "Build experience using template type: Roleplay")

**Design Agent**:
- Includes template **type** in design document (e.g., `templateType: Roleplay`)
- Does NOT work with folder IDs

**Casting Director**:
- Reads template **type** from design document
- Uses `listTemplateExperiences` to discover folder ID
- Retrieves template instructions using discovered ID

**Experience Builder**:
- Receives template **type** from taskDescription
- Uses `listTemplateExperiences` to discover folder ID
- Copies template using discovered ID

## Code Changes (Under Source Control)

### 1. Enhanced `listTemplateExperiences` Tool
**File:** `src/app/lib/tools/experience/template-tools.ts`

**Changes:**
- Added `kind` field to the returned template metadata
- Now returns: `{ id, title, description, kind, version, agents, agentInstructions }`
- The `id` field is the actual folder name (UUID or custom name)
- The `kind` field explicitly shows "template" to confirm it's a template experience

### 2. Updated Tool Registration
**File:** `src/app/lib/tools/experience/index.ts`

**Changes:**
- Enhanced `listTemplateExperiences` tool description to emphasize dynamic discovery
- Description now states: "Returns template metadata including folder IDs (which may be UUIDs or custom names), titles, descriptions, kind field, and available agents. Use this to discover template IDs dynamically rather than assuming fixed folder names."

## Experience File Changes (NOT Under Source Control)

These files exist in the `/storage/intake-agent/` directory and must be manually updated on staging and production servers.

### 3. Template Reference Documentation
**File:** `storage/intake-agent/resources/instructions/supplemental/templates.md`

**Changes:**
- Added new "Template Discovery" section at the top explaining:
  - Template folder names are NOT fixed
  - Templates are identified by `kind: "template"` in experience.json
  - Production templates typically have UUID folder names
  - Always use `listTemplateExperiences` to discover templates
  - Never assume names like "roleplay-template" or "teachback-template"
- Updated section headers from `### roleplay-template` to `### Roleplay Template`
- Updated section headers from `### teachback-template` to `### Teachback Template`
- Added "Identification" guidance for each template type
- Updated references throughout from hyphenated names to title case

### 4. Intake Agent Instructions
**File:** `storage/intake-agent/resources/instructions/agent/intake.md`

**Changes:**
- **Key Conceptual Change**: Intake Agent now works with template **types** (e.g., "Roleplay", "Teachback"), NOT folder IDs
- Renamed "Template Selection Process" to "Template Type Selection Process"
- Removed template discovery instructions (this is now Experience Builder's responsibility)
- Updated delegation examples to pass template **type** instead of folder ID
- Changed taskDescription from `"Build experience using template: a1b2c3d4-uuid"` to `"Build experience using template type: Roleplay"`
- Clarified that Intake Agent selects conceptual template type, downstream agents discover technical folder IDs

### 5. Casting Director Instructions
**File:** `storage/intake-agent/resources/instructions/agent/casting-director.md`

**Changes:**
- **Key Conceptual Change**: Casting Director receives template **type** from design document, must discover folder ID
- Updated "YOUR INPUTS" to explain Template Type (conceptual) vs folder ID (technical)
- Added "YOUR RESPONSIBILITY" section explaining the discovery process
- Renamed section to "Template Discovery and Retrieval"
- Added explicit discovery example using `listTemplateExperiences` and matching by title
- Updated MANDATORY SEQUENCE to include template discovery as first step
- Now explicitly uses `listTemplateExperiences` to find template folder ID before retrieving instructions

### 6. Experience Builder Instructions
**File:** `storage/intake-agent/resources/instructions/agent/experience-builder.md`

**Changes:**
- **Key Conceptual Change**: Experience Builder receives template **type**, must discover folder ID
- Renamed section from "Template ID Extraction" to "Template Type Extraction and Discovery"
- Added detailed discovery process with code example
- Updated "Input Parameters" to explain Template Type (conceptual) is received
- Added "YOUR RESPONSIBILITY" section explaining 3-step discovery process
- Changed taskDescription parsing from `"Build experience using template: [id]"` to `"Build experience using template type: [type]"`
- Updated MANDATORY SEQUENCE to include `listTemplateExperiences` as first tool call
- Added explicit example of finding template by matching title to type
- Updated Step 1 documentation to include two-step process: discover then copy

### 7. Design Agent Instructions
**File:** `storage/intake-agent/resources/instructions/agent/design-agent.md`

**Changes:**
- **Key Conceptual Change**: Design Agent now uses template **type** (e.g., "Roleplay", "Teachback"), NOT folder IDs
- Changed all references from "Template ID" to "Template Type"
- Updated MANDATORY SEQUENCE to use `templateType: Roleplay` instead of `templateId: a1b2c3d4-uuid`
- Simplified "Template-Based Design" section to focus on template type selection
- Removed technical folder ID details (no longer Design Agent's concern)
- Updated design document structure example to use `templateType` field

## Migration Instructions for Staging/Production

To apply these changes to staging and production servers:

1. **Deploy Code Changes** (automatic via normal deployment):
   - `src/app/lib/tools/experience/template-tools.ts`
   - `src/app/lib/tools/experience/index.ts`

2. **Manually Update Experience Files** on each server:
   
   Navigate to the storage directory and update these files:
   ```bash
   cd /path/to/storage/intake-agent/resources/instructions
   ```

   Update the following files with the changes documented above:
   - `supplemental/templates.md`
   - `agent/intake.md`
   - `agent/casting-director.md`
   - `agent/experience-builder.md`
   - `agent/design-agent.md`

   **Recommended approach:** Use the files from this repository as reference and manually edit the production files, or use `scp` to copy the updated files:
   ```bash
   # From local machine to server
   scp storage/intake-agent/resources/instructions/supplemental/templates.md \
       user@server:/path/to/storage/intake-agent/resources/instructions/supplemental/

   scp storage/intake-agent/resources/instructions/agent/intake.md \
       user@server:/path/to/storage/intake-agent/resources/instructions/agent/

   # Repeat for other files...
   ```

3. **Verify Changes**:
   - After updating, test by having the Intake Agent use `listTemplateExperiences`
   - Verify the tool returns templates with `kind: "template"` and proper UUIDs
   - Test the full pipeline: Intake → Design → Casting → Image Gen → Experience Builder
   - Confirm Experience Builder receives UUID-based template IDs

## Key Behavioral Changes

### Before:
- Agents assumed template folder names were "roleplay-template" and "teachback-template"
- Hard-coded template IDs in delegation calls
- No verification that templates existed with expected names
- Failed when templates were re-uploaded with UUID folder names

### After:
- Intake Agent uses `listTemplateExperiences` to discover actual folder IDs
- All template references use discovered UUIDs (e.g., "a1b2c3d4-uuid")
- Template discovery is explicit and documented
- System works regardless of folder naming convention
- Clear separation between template types (Roleplay/Teachback) and folder IDs

## Testing Checklist

- [ ] Code deployed and `listTemplateExperiences` returns `kind` field
- [ ] All 5 agent instruction files updated on target server
- [ ] Template reference documentation updated on target server
- [ ] Intake Agent can list templates and see UUIDs
- [ ] Full experience creation pipeline works end-to-end
- [ ] Templates can be deleted/re-uploaded with new UUIDs
- [ ] System continues working after template re-upload

## Notes

- The changes maintain backward compatibility - if templates still have fixed names like "roleplay-template", those will be discovered and used correctly
- The key improvement is that agents now **discover** rather than **assume** template IDs
- All examples now use UUIDs to reinforce this is the production pattern
- Development environments can still use friendly names, but agents won't rely on them
