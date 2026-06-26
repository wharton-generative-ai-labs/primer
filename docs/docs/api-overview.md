---
id: api-overview
title: API Overview
sidebar_label: Overview
sidebar_position: 1
---

# API Overview

Use this page as the entry point to the generated API reference. The generated module index is comprehensive, but this page highlights the most useful places to start.

## Start Here

- Core types and shared contracts: [`app/lib/types`](./api/app.lib.types.md)
- Tool system surface area: [`app/lib/tools/types`](./api/app.lib.tools.types.md)
- Experience loading and validation: [`app/lib/ConfigLoader`](./api/app.lib.ConfigLoader.md)
- AI provider abstractions: [`app/lib/ai/types`](./api/app.lib.ai.types.md)

## By Domain

- AI providers
  - [`app/lib/ai/AIProviderFactory`](./api/app.lib.ai.AIProviderFactory.md)
  - [`app/lib/ai/BaseAIProvider`](./api/app.lib.ai.BaseAIProvider.md)
  - [`app/lib/ai/TextAIProvider`](./api/app.lib.ai.TextAIProvider.md)
  - [`app/lib/ai/RealtimeAIProvider`](./api/app.lib.ai.RealtimeAIProvider.md)
- Experience config
  - [`app/lib/ConfigLoader/ConfigLoader`](./api/app.lib.ConfigLoader.ConfigLoader.md)
  - [`app/lib/ConfigAnalyzer`](./api/app.lib.ConfigAnalyzer.md)
  - [`app/lib/ConfigLoader/types`](./api/app.lib.ConfigLoader.types.md)
- Tools runtime
  - [`app/lib/ToolRegistry`](./api/app.lib.ToolRegistry.md)
  - [`app/lib/tools/types`](./api/app.lib.tools.types.md)
  - [`app/lib/tools/groups`](./api/app.lib.tools.groups.md)
- Storage and resources
  - [`app/lib/storage/StorageService`](./api/app.lib.storage.StorageService.md)
  - [`app/lib/storage/LocalStorageService`](./api/app.lib.storage.LocalStorageService.md)
  - [`app/lib/ResourceLoader`](./api/app.lib.ResourceLoader.md)
- Security and guardrails
  - [`app/lib/security/html-sanitizer`](./api/app.lib.security.html-sanitizer.md)
  - [`app/lib/security/url-validation`](./api/app.lib.security.url-validation.md)
  - [`app/lib/rate-limit`](./api/app.lib.rate-limit.md)

## Navigation Tips

- Use the docs search to jump directly to a class or type name.
- Use the sidebar for broad discovery by module.
- Use the generated API index when you want the full module inventory: [`Generated API Index`](./api/README.md).
