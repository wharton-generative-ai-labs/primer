# Docusaurus Setup Guide

## Install & Initialize

```bash
npx create-docusaurus@latest docs classic --typescript
cd docs
```

## Structure

```
docs/
├── docs/           # Your markdown content
├── blog/           # Optional blog
├── src/
│   ├── components/ # Custom React components
│   └── pages/      # Custom pages
├── static/         # Static assets (images, etc)
└── docusaurus.config.ts
```

## Key Config (`docusaurus.config.ts`)

```typescript
const config: Config = {
  title: 'Your Project',
  tagline: 'Your tagline',
  url: 'https://yourproject.com',
  baseUrl: '/',
  
  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/', // Serve docs at root
        },
        blog: false, // Disable if not needed
      },
    ],
  ],
};
```

## Sidebar Organization (`sidebars.ts`)

```typescript
const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Architecture',
      items: ['architecture/overview', 'architecture/components'],
    },
    {
      type: 'category',
      label: 'API Reference',
      items: ['api/authentication', 'api/endpoints'],
    },
  ],
};
```

## Markdown Frontmatter

```markdown
---
id: component-philosophy
title: Component Philosophy
sidebar_label: Philosophy
sidebar_position: 1
---

# Component Philosophy
Content here...
```

## MDX Features

- Import React components: `import MyComponent from '@site/src/components/MyComponent'`
- Use JSX inline: `<MyComponent prop="value" />`
- Code blocks with syntax highlighting automatically

## TypeDoc Integration

```bash
npm install --save-dev typedoc typedoc-plugin-markdown
```

`typedoc.json`:
```json
{
  "entryPoints": ["../src"],
  "out": "docs/api",
  "plugin": ["typedoc-plugin-markdown"],
  "tsconfig": "../tsconfig.json"
}
```

Add script to `package.json`:
```json
"scripts": {
  "docs:generate": "typedoc",
  "docs:dev": "docusaurus start",
  "docs:build": "docusaurus build"
}
```

## Dev Workflow

1. Generate API docs: `npm run docs:generate`
2. Start dev server: `npm run docs:dev` (localhost:3000)
3. Create markdown files in `docs/`
4. Build for production: `npm run docs:build`

## Migrate Existing Context Docs

1. Copy markdown files to `docs/` directory
2. Add frontmatter to each file
3. Update internal links to use relative paths
4. Organize via `sidebars.ts`

## Admonitions (Callouts)

```markdown
:::note
Useful information
:::

:::tip
Helpful advice
:::

:::warning
Critical information
:::
```

## Deploy

Build outputs to `build/` - serve as static site via:
- GitHub Pages (built-in support)
- Netlify/Vercel (auto-detect Docusaurus)
- Any static host

## Pro Tips

- Use `routeBasePath: '/'` to serve docs at root instead of `/docs`
- Disable blog if unnecessary: `blog: false`
- Use `@site/` alias for imports from project root
- Assets in `static/` served at root path
- Dark mode included by default