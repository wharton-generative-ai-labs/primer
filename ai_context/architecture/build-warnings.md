# Build Warnings and Suppressions

## Type Stripping Experimental Warning

**Warning:**
```
(node:xxxxx) ExperimentalWarning: Type Stripping is an experimental feature and might change at any time
```

**Cause:**
Node.js is using its experimental "Type Stripping" feature to directly load TypeScript files without transpiling them first. This occurs when Tailwind CSS loads `tailwind.config.ts` during the build process.

**Stack Trace Origin:**
```
at stripTypeScriptModuleTypes (node:internal/modules/typescript:166:5)
at Module._compile (node:internal/modules/cjs/loader:1686:15)
at loadConfig (node_modules/tailwindcss/lib/lib/load-config.js:51:20)
```

**Resolution:**
This is a harmless warning from Node.js's experimental TypeScript support. The build completes successfully.

**To suppress (if desired):**
- Option 1: Add to package.json build script: `NODE_OPTIONS='--no-warnings=ExperimentalWarning'`
- Option 2: Rename `tailwind.config.ts` to `tailwind.config.js` (loses type safety)
- Option 3: Set environment variable: `NODE_NO_WARNINGS=1`

**Current Status:** Warning accepted as-is (Jan 7, 2026)

---

## Next.js Image Warning

**Warning:**
```
Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image`
```

**Suppressed in:** `src/app/components/Scene.tsx`

**Reason:** Deliberate choice to use native `<img>` element for scene backgrounds to avoid Next.js image optimization overhead for dynamically loaded scene images.

**Implementation:**
```tsx
{/* eslint-disable-next-line @next/next/no-img-element */}
<img src={imagePath} alt={`Scene: ${currentScene}`} />
```

---

## Dotenv Noise

**Issue:** Dotenv was outputting verbose tips during build:
```
[dotenv@17.2.3] injecting env (0) from .env -- tip: ⚙️  suppress all logs with { quiet: true }
```

**Resolution:** Added `{ quiet: true }` option to `dotenv.config()` in `src/config/env.ts`:
```typescript
dotenvModule.config({ quiet: true });
```

**Status:** Resolved (Jan 7, 2026)

