# Primer Documentation

This directory contains the Docusaurus-based documentation site for Primer.

## Development

### Prerequisites

Make sure you've installed dependencies:

```bash
npm install
```

### Running the docs locally

From the project root:

```bash
npm run docs:dev
```

Or from within the `docs/` directory:

```bash
npm start
```

This will start a development server at [http://localhost:3000](http://localhost:3000).

### Building the docs

From the project root:

```bash
npm run docs:build
```

Or from within the `docs/` directory:

```bash
npm run build
```

This will:
1. Generate API documentation from TypeScript source using TypeDoc
2. Build the static documentation site

### Serving the built docs

```bash
npm run docs:serve
```

## Structure

```
docs/
├── docs/                    # Markdown documentation
│   ├── intro.md            # Landing page
│   ├── user-guide/         # User-facing documentation
│   ├── developer/          # Developer documentation
│   └── api/                # Generated API docs (TypeDoc)
├── src/                    # Custom React components
├── static/                 # Static assets
├── docusaurus.config.ts    # Docusaurus configuration
├── sidebars.ts             # Sidebar configuration
└── typedoc.json            # TypeDoc configuration
```

## Writing Documentation

### Markdown Files

Create `.md` or `.mdx` files in the `docs/` directory. Add frontmatter to control:

```markdown
---
id: unique-id
title: Page Title
sidebar_label: Short Label
sidebar_position: 1
---

# Content here
```

### Mermaid Diagrams

Mermaid diagrams are supported for creating flowcharts, sequence diagrams, etc.:

\`\`\`mermaid
graph TD
    A[Start] --> B[Process]
    B --> C[End]
\`\`\`

### API Documentation

API documentation is automatically generated from TypeScript source code using TypeDoc. The configuration is in `typedoc.json`.

To regenerate API docs:

```bash
npm run docs:generate
```

## Deployment

The `build/` directory contains the static site ready for deployment to any static hosting service (Netlify, Vercel, GitHub Pages, etc.).
