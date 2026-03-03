# Context Folder

This folder contains project documentation, architectural notes, reference materials, and other context for AI assistants and developers.

> **For AI Assistants:** Please read [AI_INSTRUCTIONS.md](./AI_INSTRUCTIONS.md) for guidelines on maintaining clean, organized documentation in this folder.

## Purpose

The `/context` folder is intended for:
- Project architecture documentation
- Implementation notes and change logs
- Bug tracking and TODO items
- External reference materials (like example code)
- Development guides and best practices
- Project roadmaps and planning documents

## Build Exclusion

**Important**: Files in this folder are **excluded from the build process**.

### Configuration

The following configurations ensure the context folder is ignored by build/compile/test tooling:

1. **TypeScript** (`tsconfig.json`):
   ```json
   "exclude": ["node_modules", "context/**/*"]
   ```
   - TypeScript compiler will not type-check files in this folder
   - Allows reference code with type errors or missing types

2. **ESLint** (`eslint.config.mjs`):
   ```javascript
   {
     ignores: ["context/**/*"]
   }
   ```
   - ESLint will not lint files in this folder
   - Useful for reference code that doesn't follow project style

3. **Git** (`.gitignore`):
   - The context folder is **not** ignored by git
   - All documentation should be committed and version controlled

### Adding Reference Files

You can safely add reference files (`.tsx`, `.ts`, `.jsx`, `.js`, `.md`, etc.) to this folder without worrying about:
- TypeScript compilation errors
- ESLint warnings
- Build failures
- Test execution

This is useful for:
- Example code from external sources
- Code snippets that don't compile in your current environment
- Reference implementations that use different versions of dependencies
- Documentation with embedded code that shouldn't be executed

## Structure

```
context/
├── AI_INSTRUCTIONS.md   # Guidelines for AI assistants (READ THIS FIRST)
├── architecture/         # System architecture documentation
├── bugs-and-todo-items/ # Issue tracking and planned work
├── changes/             # Implementation notes and change logs
├── code_reviews/        # Code review summaries and analyses
├── conversations/       # Important development conversations
├── debug_logs/          # Debugging session notes
├── external/            # External reference materials
├── features/            # Feature documentation
├── guides/              # How-to guides and tutorials
├── legacy/              # Historical documentation
├── prompts/             # AI prompts and templates
├── reference/           # Reference code and examples
│   └── artifacts/       # Example artifacts and components
├── roadmap/             # Project planning and roadmaps
├── testing/             # Testing documentation and guides
│   ├── README.md        # Testing quick reference
│   ├── overview.md      # Complete testing status and metrics
│   ├── configuration.md # Jest setup and infrastructure
│   ├── pre-commit-hooks.md # Automated testing workflow
│   └── code-review-requirements.md # Testing requirements from reviews
└── README.md           # This file
```

## Best Practices

1. **Organize by topic**: Keep related documentation together in appropriate subfolders
2. **Use descriptive names**: Make file purposes clear from their names
3. **Link between docs**: Cross-reference related documentation
4. **Keep it current**: Update docs as the codebase evolves
5. **Mark obsolete items**: Move outdated docs to `/legacy` folder
6. **Version reference code**: Note the source and version of external code
7. **Never clutter the root**: Don't place files in project root or context root (see [AI_INSTRUCTIONS.md](./AI_INSTRUCTIONS.md))
8. **Use subfolders**: Always place documentation in the appropriate subfolder

## Reference Files

Files in `context/reference/artifacts/` are explicitly for reference purposes only. These files:
- May not compile with the current project configuration
- May use different versions of dependencies
- May contain intentional errors for educational purposes
- Should not be imported into the main codebase

Example: `ethan-mollick-correlation-causation-artifact.tsx` is a reference implementation that uses untyped parameters and serves as inspiration/documentation only.
