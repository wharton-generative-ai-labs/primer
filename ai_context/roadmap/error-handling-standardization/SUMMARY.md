# Error Handling Standardization - Executive Summary

**Date:** January 12, 2026  
**Status:** Planning Complete, Ready for Implementation  
**Priority:** High  
**Estimated Effort:** 6 weeks (1 engineer)

---

## Problem

The Primer codebase has **40+ API routes** with **4-5 different error handling patterns**, leading to:

- ❌ Inconsistent HTTP status codes (most routes only return 500)
- ❌ Varying error response structures
- ❌ Mixed validation approaches (manual vs. Zod)
- ❌ Inconsistent error exposure (some leak internals in production)
- ❌ Poor client error handling experience

**Origin:** Code review finding: "Error handling consistency - Review error handling patterns across API routes for consistency"

---

## Solution

Implement a **standardized error handling pattern** across all API routes with:

1. **Appropriate HTTP status codes** (400, 401, 403, 404, 429, 500)
2. **Consistent error response structure**
3. **Zod validation** for complex inputs
4. **Environment-aware error exposure** (detailed in dev, generic in production)
5. **Layered validation order** (auth → rate limit → input → authz → existence → business logic)

---

## Benefits

### Security
- ✅ No internal error leaks in production
- ✅ Consistent rate limiting
- ✅ Proper authentication/authorization checks

### Developer Experience
- ✅ Easier to write new routes (less boilerplate)
- ✅ Clear debugging in development (detailed errors)
- ✅ Reusable utility functions
- ✅ Type-safe validation with Zod

### Client Experience
- ✅ Appropriate HTTP status codes
- ✅ Clear, actionable error messages
- ✅ Structured validation errors with field details
- ✅ Rate limit information in headers

### Maintainability
- ✅ Consistent patterns across codebase
- ✅ Centralized error handling logic
- ✅ Easier to test and debug
- ✅ Better code quality

---

## Implementation Plan

### Phase 1: Foundation (Week 1)
**Goal:** Create utilities and documentation

- Create error response utilities
- Create validation utilities
- Create authentication utilities
- Write comprehensive documentation
- Add tests for all utilities

**Deliverables:** Utility functions, migration guide, examples

### Phase 2: High-Traffic Routes (Weeks 2-3)
**Goal:** Migrate critical routes first

- Migrate 11 high-traffic routes
- Update tests
- Monitor for issues

**Routes:** Session, backend-agent, experiences, artifacts, resources, storage

### Phase 3: Remaining Routes (Weeks 4-5)
**Goal:** Migrate all remaining routes

- Migrate ~29 remaining routes in groups
- Update all tests
- Complete documentation

**Groups:** Classes, analytics, OpenAI, experience management, session data, misc

### Phase 4: Testing & Validation (Week 6)
**Goal:** Comprehensive testing

- Integration testing
- Error response validation
- Performance testing
- Production readiness review

---

## Recommended Pattern (Quick Reference)

```typescript
export async function POST(request: NextRequest) {
  try {
    // 1. Authentication (401)
    const token = await getToken({ req: request });
    if (!token?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Rate limiting (429)
    const limitResult = rateLimit(identifier, rateLimitConfigs.api);
    if (!limitResult.allowed) {
      return createRateLimitResponse(limitResult);
    }

    // 3. Input validation (400)
    const validationResult = Schema.safeParse(body);
    if (!validationResult.success) {
      return createValidationErrorResponse(validationResult.error);
    }

    // 4. Authorization (403)
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 5. Resource existence (404)
    if (!resource) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // 6. Business logic
    const result = await performOperation();
    return NextResponse.json({ success: true, data: result });

  } catch (error) {
    // 7. Error handling (500)
    logger.error(error, 'Error', { context });
    
    const isDevelopment = env.NODE_ENV === 'development';
    return NextResponse.json(
      {
        error: isDevelopment && error instanceof Error
          ? error.message
          : 'Internal server error',
        ...(isDevelopment && error instanceof Error && { details: error.stack })
      },
      { status: 500 }
    );
  }
}
```

---

## HTTP Status Codes

| Code | Use Case | Example |
|------|----------|---------|
| 400 | Bad Request | Validation failed, missing required field |
| 401 | Unauthorized | No token, invalid token |
| 403 | Forbidden | Valid token but insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 429 | Rate Limited | Too many requests |
| 500 | Server Error | Unexpected exception |

---

## Error Response Structures

### Simple Error
```json
{
  "error": "Unauthorized"
}
```

### Validation Error
```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### Rate Limit Error
```json
{
  "error": "Rate limit exceeded"
}
```
Plus headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`

### Development Error (500)
```json
{
  "error": "Cannot read property 'id' of undefined",
  "details": "TypeError: Cannot read property...\n    at handler..."
}
```

### Production Error (500)
```json
{
  "error": "Internal server error"
}
```

---

## Key Findings from Analysis

### Current State
- **40+ API routes** analyzed
- **4-5 different patterns** identified
- **Only 2 routes** use Zod validation
- **Only 1 route** has dev/prod error switching
- **~70% of routes** only return 500 for all errors

### Patterns Found
1. **Basic try-catch** (~40%) - Generic 500 errors
2. **Conditional error exposure** (~30%) - Exposes `error.message`
3. **Validation + status codes** (~20%) - Better, but verbose
4. **Zod validation** (~5%) - Best practice, rarely used
5. **Special cases** (~5%) - Health checks, streaming

---

## Resource Requirements

### Engineering Time
- **Phase 1:** 40 hours (1 week)
- **Phase 2:** 80 hours (2 weeks)
- **Phase 3:** 80 hours (2 weeks)
- **Phase 4:** 40 hours (1 week)
- **Total:** 240 hours (6 weeks)

### Additional
- Code review: 12 hours
- QA testing: 20 hours
- **Grand Total:** 272 hours (~7 weeks)

---

## Success Metrics

### Quantitative
- [ ] 100% of routes follow standard pattern (40+ routes)
- [ ] 100% test coverage for utilities
- [ ] 0 production error detail leaks
- [ ] <5% increase in response time
- [ ] 0 critical bugs in production

### Qualitative
- [ ] Improved developer experience
- [ ] Better client error handling
- [ ] Clearer error messages
- [ ] More maintainable codebase

---

## Risk Assessment

### Low Risk Initiative
- ✅ Changes are mostly internal
- ✅ Error response structures remain compatible
- ✅ Comprehensive testing planned
- ✅ Gradual implementation allows early issue detection

### Mitigation Strategies
- Thorough testing in Phase 4
- Backward compatibility checks
- Performance benchmarking
- Staged rollout option available

---

## Documentation Structure

```
error-handling-standardization/
├── README.md                    # Overview and navigation
├── SUMMARY.md                   # This file - executive summary
├── analysis.md                  # Detailed analysis of current patterns
├── recommended-pattern.md       # The standardized pattern
├── implementation-phases.md     # Phased rollout plan
├── migration-guide.md          # Step-by-step migration instructions
├── utilities.md                # Shared utility functions
└── examples/
    └── complete-route.ts       # Fully annotated example
```

---

## Next Steps

1. **Review & Approve** - Team review of this plan
2. **Schedule** - Allocate engineer time
3. **Kickoff** - Team meeting to discuss approach
4. **Phase 1** - Begin utility implementation
5. **Iterate** - Weekly progress updates

---

## Related Documents

### Planning Documents
- [README.md](./README.md) - Initiative overview
- [analysis.md](./analysis.md) - Current state analysis
- [recommended-pattern.md](./recommended-pattern.md) - Standard pattern
- [implementation-phases.md](./implementation-phases.md) - Rollout plan

### Implementation Documents
- [migration-guide.md](./migration-guide.md) - How to migrate a route
- [utilities.md](./utilities.md) - Utility functions to create
- [examples/complete-route.ts](./examples/complete-route.ts) - Full example

### Related Work
- [Complete Zod Validation](../../bugs-and-todo-items/complete-zod-validation.md)
- [API Routes Reference](../../reference/api-routes.md)
- [Testing Overview](../../testing/overview.md)

---

## Questions?

For questions or clarifications:
- Review the detailed documents in this folder
- Check the complete example in `examples/complete-route.ts`
- Ask in team chat
- Review existing migrated routes (after Phase 2)

---

## Approval

- [ ] Engineering Lead
- [ ] Security Review
- [ ] Product Owner
- [ ] QA Lead

**Approved By:** _______________  
**Date:** _______________
