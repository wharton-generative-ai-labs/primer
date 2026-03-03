# Template Discovery Implementation Documentation

This folder contains documentation for the template discovery implementation that ensures agents dynamically discover template folder IDs instead of relying on hardcoded names.

## Documents in This Folder

### For Deployment
- **DEPLOYMENT_SUMMARY.md** - ⭐ START HERE for deployment overview
- **FILES_TO_DEPLOY.md** - Complete list of files to deploy with upload commands
- **DEPLOYMENT_CHECKLIST.md** - Step-by-step deployment checklist

### Quick Reference
- **QUICK_REFERENCE.md** - One-page cheat sheet with key concepts and examples

### Understanding the Architecture
- **ARCHITECTURE_CLARIFICATION.md** - Detailed explanation of the conceptual vs technical separation
- **IMPLEMENTATION_SUMMARY.md** - High-level overview of what was implemented and why

### Technical Details
- **TEMPLATE_DISCOVERY_CHANGES.md** - Complete change log of all modifications
- **STORAGE_FILES_TO_UPDATE.md** - Legacy file list (see FILES_TO_DEPLOY.md instead)

## Quick Overview

### The Problem
Previously, agents assumed template folder names were fixed (e.g., "roleplay-template"). In production, templates uploaded via the Experience Catalog get random UUID folder names, breaking this assumption.

### The Solution
Created a clear architectural separation:
- **Conceptual agents** (Intake, Design) mention template types naturally in text ("Roleplay" or "Teachback")
- **Technical agents** (Casting Director, Experience Builder) parse the text, discover folder IDs using `listTemplateExperiences`, and handle implementation

### Key Benefit
Template types are conceptual descriptions mentioned in plain text, not structured code parameters. This means conceptual agents never need updating when templates are re-uploaded with new UUIDs.

## Related Code Changes

### Files Under Source Control
- `src/app/lib/tools/experience/template-tools.ts` - Enhanced to return `kind` field
- `src/app/lib/tools/experience/index.ts` - Updated tool descriptions

### Files Requiring Manual Updates (NOT under source control)
See **STORAGE_FILES_TO_UPDATE.md** for the 5 agent instruction files in `/storage/intake-agent/` that need manual updates on staging and production servers.

## See Also
- `/context/bugs-and-todo-items/experience-builder-template-failure.md` - Original bug that motivated this work
