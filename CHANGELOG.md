# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Generic load-time validation, applied to every experience, that frontend workflow-phase anchor agents (`initialAgent` / `reentryAgent`) retain the `workflowPhase` and `finishExperience` navigation tools, and that each phase's `allowedDelegates` entries reference declared agents. Misconfigured experiences now fail fast at config load instead of silently stranding the learner mid-phase.

### Changed
- Centralized agent tool resolution in `resolveAgentToolNames()` (`src/app/lib/tools/groups.ts`) so `AgentConfigBuilder` and `loadWorkflowPhases` share a single precedence (`availableTools` → `toolSets` → `toolGroups` → unrestricted) and cannot diverge.

### Removed
- Tests that pinned the contents of specific user-authored experiences in `storage/experience-creator/` (prompt copy, toolset shape) and the per-experience phase-shape assertions against three named templates. The platform validates the *shape* every experience must satisfy at config load; the *contents* of any specific authored experience are the author's domain, not CI's.

---

## [0.1.0] - Initial Release

- Initial open source release
- Experience management system
- Realtime voice interaction via OpenAI's Realtime API
- Agent sequencing and branching
- Plugin-based tool system
- Analytics framework
- Matter compiler
- User authentication and authorization
- Class and session management
- Module registry and installation system
