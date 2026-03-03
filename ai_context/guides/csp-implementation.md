# Content Security Policy (CSP) Implementation

## Summary

Content Security Policy has been successfully implemented for the Primer application to protect against XSS, clickjacking, and other code injection attacks.

## CSP Configuration Comparison

### Development Mode
```
connect-src:
  'self'
  https://api.openai.com
  ws://localhost:*
  wss://localhost:*
  http://localhost:*

script-src:
  'self'
  'unsafe-eval'      ← Required for HMR
  'unsafe-inline'
```

### Production Mode (with NEXT_PUBLIC_SOCKET_SERVER_URL=https://your-app.onrender.com)
```
connect-src:
  'self'
  https://api.openai.com
  wss://your-app.onrender.com    ← From NEXT_PUBLIC_SOCKET_SERVER_URL
  https://your-app.onrender.com  ← Socket.io polling fallback

script-src:
  'self'
  'unsafe-inline'    ← No 'unsafe-eval' in production
```

## What Was Implemented

### 1. CSP Configuration Module (`src/lib/csp.ts`)
- Centralized CSP directive management
- Environment-aware configuration (dev vs production)
- Helper functions for generating CSP headers
- Comprehensive inline documentation

### 2. Middleware Integration (`src/middleware.ts`)
- CSP headers applied to all authenticated routes
- Integrated with existing authentication middleware
- Automatic environment detection

### 3. Next.js Config Integration (`next.config.ts`)
- CSP headers applied via Next.js `headers()` config
- Backup for static files and routes not covered by middleware
- Consistent with middleware configuration

### 4. Documentation
- **`context/architecture/security-csp.md`** - Comprehensive CSP documentation
  - All CSP directives explained
  - External resource inventory
  - Security considerations
  - Troubleshooting guide
  - Future improvements
- **`context/architecture/overview.md`** - Updated with security section
- **`CSP-IMPLEMENTATION.md`** - This summary document

### 5. Testing Script (`scripts/test-csp.sh`)
- Automated CSP header validation
- Security header verification
- Environment-specific checks
- Usage: `./scripts/test-csp.sh [URL]`

## CSP Policy Overview

### Allowed External Resources

#### Fonts
- **Domain**: `https://gail.wharton.upenn.edu`
- **Purpose**: Wharton brand fonts (Acumin Pro, Minion Pro)
- **Directives**: `style-src`, `font-src`

### Key Security Decisions

#### 1. `'unsafe-inline'` for Scripts
- **Required**: Yes, for Next.js inline scripts and hydration
- **Risk**: Medium (mitigated by other security measures)
- **Future**: Consider nonce-based CSP

#### 2. `'unsafe-eval'` for Development
- **Required**: Yes, for webpack HMR and development tools
- **Production**: Disabled
- **Risk**: Low (dev-only)

#### 3. WebSocket Connections
- **Allowed**: `ws:` and `wss:` protocols
- **Purpose**: Socket.io for real-time features
- **Scope**: Same-origin only

#### 4. Image Sources
- **Allowed**: `'self'`, `data:`, `blob:`
- **Purpose**: AI-generated images stored as artifacts
- **No external image sources**: All images are self-hosted or base64

#### 5. No Iframes
- **Policy**: `frame-src 'none'`, `frame-ancestors 'none'`
- **Purpose**: Prevent clickjacking and embedding attacks
- **Exception**: Can be relaxed if needed for specific features

## Files Modified

1. **`src/lib/csp.ts`** - New file (CSP configuration)
2. **`src/middleware.ts`** - Updated (added CSP headers)
3. **`next.config.ts`** - Updated (added CSP to headers config)
4. **`context/architecture/security-csp.md`** - New file (documentation)
5. **`context/architecture/overview.md`** - Updated (security section)
6. **`scripts/test-csp.sh`** - New file (testing script)

## Testing

### Build Test
```bash
npm run build
```
✅ Build completed successfully with no CSP-related errors

### Manual Testing
1. Start the development server:
   ```bash
   npm run dev
   ```

2. Run the CSP test script:
   ```bash
   ./scripts/test-csp.sh
   ```

3. Check browser console for CSP violations:
   - Open DevTools → Console
   - Look for "Content Security Policy" messages
   - Verify no legitimate resources are blocked

### Browser Testing Checklist
- [ ] Pages load without CSP violations
- [ ] External fonts load correctly (Wharton fonts)
- [ ] WebSocket connections work (Socket.io)
- [ ] Mermaid diagrams render properly
- [ ] AI-generated images display correctly
- [ ] Hot Module Reloading works in dev mode
- [ ] No console errors related to CSP

## External Resource Inventory

Based on code analysis, the following external resources are used:

### ✅ Fonts (Whitelisted)
- `https://gail.wharton.upenn.edu/wp-content/plugins/martech-chupacabra/includes/fonts/`
  - acuminprocond-regular-webfont.woff2
  - acuminprocond-black-webfont.woff2
  - acuminprocond-bold-webfont.woff2
  - acuminpro-bold-webfont.woff2
  - acuminpro-regular-webfont.woff2
  - acuminpro-black-webfont.woff2
  - minionpro-regular-webfont.woff2
  - minionpro-bold-webfont.woff2

### ✅ API Integrations
- **OpenAI API** (`https://api.openai.com`) - **Frontend & Backend**
  - `/v1/realtime` - WebRTC signaling for Realtime API (frontend)
  - `/v1/responses` - Responses API (frontend)
  - `/v1/audio/streaming` - Audio streaming (frontend)
  - Whitelisted in `connect-src` directive
- **Anthropic API** (`api.anthropic.com`) - Backend only
- **Google GenAI API** (`generativelanguage.googleapis.com`) - Backend only
- **AWS S3** (configured endpoint) - Backend only

*Note: Most API calls are server-side, but OpenAI Realtime API requires frontend access for WebRTC signaling*

### ✅ WebSocket (Same-Origin)
- Socket.io connections to same origin
- Protocols: `ws:` and `wss:`

### ❌ No External Scripts
- All JavaScript is bundled and served from same origin
- No CDN-hosted libraries
- No analytics scripts (Google Analytics, etc.)
- No error tracking scripts (Sentry, etc.)

### ❌ No External Images
- AI-generated images saved as artifacts (local or base64)
- No external image CDNs
- No user-uploaded images from external sources

### ❌ No External Stylesheets
- All CSS is bundled (Tailwind)
- Only external font CSS from Wharton domain

## Security Considerations

### Mermaid Diagrams
- Uses `dangerouslySetInnerHTML` for SVG rendering
- **Mitigation**: SVG content sanitized via `src/app/lib/security/html-sanitizer.ts`
- Sanitizer removes: `<script>` tags, event handlers, `javascript:` protocol

### Dynamic Content
- No `eval()` or `Function()` used in codebase
- No dynamic code execution
- Future: May need to support react-runner for dynamic React components

### Proxy Route (`/api/proxy`)
- Can fetch external URLs
- **Mitigation**: 
  - URL validation via `src/app/lib/security/url-validation.ts`
  - SSRF protection
  - Rate limiting
  - Zod schema validation

## Production Deployment

### Pre-deployment Checklist
- [ ] Build succeeds: `npm run build`
- [ ] CSP test passes: `./scripts/test-csp.sh`
- [ ] No CSP violations in browser console
- [ ] All features work as expected
- [ ] External fonts load correctly
- [ ] WebSocket connections work

### Environment Variables

#### Required for Production
- `NEXT_PUBLIC_SOCKET_SERVER_URL` - Your production domain (e.g., `https://your-app.onrender.com`)
  - Used to whitelist WebSocket connections in CSP
  - Must be set before build time (NEXT_PUBLIC_* vars are embedded at build)
  - CSP will automatically derive WebSocket URLs from this

#### Automatic Detection
- `NODE_ENV` - Automatically detected (development vs production)
- Development: Allows localhost WebSocket connections
- Production: Uses `NEXT_PUBLIC_SOCKET_SERVER_URL` for WebSocket connections

### Monitoring
Consider implementing CSP reporting in production:
1. Add `report-uri` or `report-to` directive
2. Create `/api/csp-report` endpoint
3. Log violations for analysis

## Future Improvements

### 1. Nonce-based CSP (High Priority)
Replace `'unsafe-inline'` with cryptographic nonces:
- Generate unique nonce per request
- Add nonce to inline scripts
- Update CSP to use nonces instead of `'unsafe-inline'`

### 2. CSP Reporting (Medium Priority)
Implement violation reporting:
```typescript
report-uri /api/csp-report;
report-to csp-endpoint;
```

### 3. Stricter Policies (Medium Priority)
- Remove `'unsafe-inline'` where possible
- Use `'strict-dynamic'` for script loading
- Implement Subresource Integrity (SRI) for external resources

### 4. Per-Route CSP (Low Priority)
Different CSP policies for different routes:
- Stricter for public pages
- More permissive for admin/editor pages

### 5. CSP Level 3 Features (Low Priority)
- `'strict-dynamic'` for better script handling
- `'report-sample'` for better violation reports
- `trusted-types` for DOM XSS protection

## Troubleshooting

### Issue: External Resource Blocked
**Symptom**: Console error "Refused to load... because it violates CSP"

**Solution**:
1. Identify the resource type (script, style, image, etc.)
2. Add the domain to appropriate directive in `src/lib/csp.ts`
3. Rebuild and test

### Issue: HMR Not Working in Dev
**Symptom**: Hot Module Reloading doesn't work

**Solution**:
1. Verify `NODE_ENV=development`
2. Check that `'unsafe-eval'` is in `script-src`
3. Check that localhost WebSocket connections are allowed

### Issue: Mermaid Diagrams Not Rendering
**Symptom**: Diagrams don't appear or show errors

**Solution**:
1. Check browser console for CSP violations
2. Verify `'unsafe-inline'` is in `style-src` (required for Mermaid)
3. Check that SVG sanitization isn't too aggressive

### Issue: Fonts Not Loading
**Symptom**: Wharton fonts don't load, fallback fonts used

**Solution**:
1. Verify `https://gail.wharton.upenn.edu` is in `font-src` and `style-src`
2. Check network tab for CORS issues
3. Verify font URLs in `src/app/globals.css`

## References

- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/)
- [Next.js Security Headers](https://nextjs.org/docs/app/api-reference/next-config-js/headers)
- [OWASP CSP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)

## Contact

For questions or issues related to CSP implementation, refer to:
- **Documentation**: `context/architecture/security-csp.md`
- **Configuration**: `src/lib/csp.ts`
- **Testing**: `scripts/test-csp.sh`
