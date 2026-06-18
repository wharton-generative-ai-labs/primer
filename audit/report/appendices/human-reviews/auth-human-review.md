# Authentication & Authorization - Human Review

---

??? info "AI Review Guidance :material-robot-outline:"
    The AI review (see `auth-ai-review.md`) was conducted through static code analysis only. It identified the architectural issues — open registration and fail-open middleware — but could not trace live session flows, test JWT behavior, or verify authorization on specific routes.

    ### Where You Add the Most Value

    1. **End-to-end authorization audit.** The AI flagged that middleware only checks authentication, not authorization. It did not enumerate which routes are actually exposed. Pick 3-4 sensitive API routes (artifact modification, AI calls, user data access) and verify each has proper permission checks. A single unprotected route confirms the AI's architectural concern with concrete evidence.

    2. **Live session testing.** Sign in with a non-allowlisted Google account and observe what you can access. Check the JWT contents (decode from cookies via jwt.io) — what claims are present? Is the signing algorithm strong? What is the session expiry?

    3. **Session revocation behavior.** Remove a user from `users.json` and check whether access revokes immediately or only on next sign-in. The AI did not test this.

    4. **OAuth CSRF protection.** The AI did not verify whether NextAuth's CSRF `state` parameter is active. Confirm it's present in the OAuth flow.

    5. **Role escalation paths.** Check if any API endpoint can write to the filesystem in a way that could modify `users.json` or role definitions. The file-based user storage is an unusual attack surface the AI noted but couldn't probe.

    ### Practical Test Steps

    1. Open the app, sign in with a non-allowlisted Google account
    2. Note what you can access (inspect routes and API calls in Network tab)
    3. Decode your JWT from cookies — check claims, algorithm, expiry
    4. curl 3-4 sensitive API routes directly with your token
    5. Remove your account from users.json — does access revoke?
    6. Inspect the OAuth redirect for state parameter presence

    ### V1 PoC Focus

    **Context:** This is a proof-of-concept release for trusted users (researchers, educators, students) in a controlled environment. Focus your review on PoC blockers rather than production-scale concerns.

    #### PoC Blockers to Validate

    The AI review identified one blocker requiring human validation:

    | Finding                   | AI Assessment   | Human Action                      |
    | ------------------------- | --------------- | --------------------------------- |
    | AUTH-1: Open registration | **PoC Blocker** | Validate and confirm fix approach |

    #### PoC Acceptable (Validate or Dispute)

    | Finding                         | AI Assessment  | Notes                                              |
    | ------------------------------- | -------------- | -------------------------------------------------- |
    | AUTH-2: Fail-open authorization | PoC Acceptable | Check if distributed route checks are consistent   |
    | Session fixation via WebSocket  | PoC Acceptable | Verify socket sessions bind to auth sessions       |

    ### Focused Review Areas

    Rather than a full review, focus on:

    1. **Validate AUTH-1 fix approach** - Is allowlist enforcement sufficient?
    2. **Spot-check authorization** - Pick 2-3 sensitive routes and verify they check permissions
    3. **Identify any missed blockers** - Are there issues the AI didn't catch that block PoC release?

---

## Findings

### AI Finding Validation

<!-- For each AI finding, confirm or dispute -->

**AUTH-1 (Open Registration):**

- [ ] ~~Confirmed as blocker~~ **Disputed — Documentation Requirement**

The `signIn` callback returns `true` for any Google user. Initially flagged as a blocker, but reconsidered given the release context.

This is distributable PoC code, not a managed deployment. Deployers must already configure:
- Google OAuth credentials
- OpenAI/Anthropic API keys
- Environment variables

Adding "configure allowed users" to that list is a documentation issue, not a code defect. The route spot-check showed no-role users get 403 on sensitive endpoints — they can authenticate but can't *do* anything harmful.

**Recommendation:** Document prominently in setup instructions:
> :material-alert: By default, any Google user can sign in. Configure `USER_ROLE_MAPPINGS` or `users.json` before deploying.

For deployers who want a closed system, the fix is straightforward — update `signIn` callback to check `isEnvDefinedUser()` or `userExists()`.

**AUTH-2 (Fail-open Authorization):**

- [x] Agree: PoC Acceptable

**Challenge:** While acceptable for PoC, the "Fail-open" nature of the middleware (checking only auth, not role) puts immense pressure on every individual API route to implement its own checks correctly. A "deny-by-default" middleware strategy for `/api/admin` or `/api/write` routes would be a safer default, even for a PoC.

### Additional Findings

<!-- Only document NEW findings not covered by AI review -->

**AUTH-3 (Implicit Role Assignment):**
The `getMergedUserPrivileges` function implies that if a user isn't found, they get no roles. However, the system allows them to have a valid session. This creates a state where a user is "Authenticated but Unauthorized," which can confuse frontend logic that assumes `session => user`.
_Recommendation:_ Ensure the frontend handles "no-role" users gracefully, or strictly block them at the `signIn` level (preferred).

**AUTH-4 (Session-to-WebSocket Binding Gap):**
Traced the auth flow from NextAuth through to WebSocket connections. The WebSocket layer (`server.ts`) does not verify the NextAuth JWT, meaning a user can be revoked in NextAuth but still maintain an active socket session until they reconnect. This is a session revocation timing issue.
_Tested:_ Removed user from `users.json` mid-session - WebSocket remained active until page refresh.
_Severity:_ Low for PoC (known users, manual oversight).
_Recommendation:_ Bind socket sessions to NextAuth session lifecycle, or implement periodic re-validation.

**AUTH-5 (Dual User Storage - Priority Confusion):**
The system has two user sources: environment variables (`USER_ROLE_MAPPINGS`) and file-based (`users.json`). Code indicates env takes precedence over file. However, if an admin adds a user to `users.json` without realizing the same email exists in env with different roles, the file entry is silently ignored. This could lead to privilege confusion.
_Severity:_ Low (operational, not security).
_Recommendation:_ Log a warning when a file-based user is shadowed by an env-defined user.

**AUTH-6 (OAuth State Parameter - Verified):**
Per the Review Strategy, verified OAuth CSRF protection. NextAuth's default Google provider includes the `state` parameter in the OAuth flow. Confirmed by inspecting the redirect URL during sign-in:
```text
https://accounts.google.com/o/oauth2/v2/auth?...&state=<random_token>...
```
_Assessment:_ Positive - CSRF protection is active.

---

## Live Session Testing Notes

Performed the manual testing steps from Review Strategy:

### JWT Analysis

Decoded JWT from `next-auth.session-token` cookie:
- **Algorithm:** HS256 (symmetric, acceptable for this use case)
- **Expiry:** 30 days default (configurable via `NEXTAUTH_SESSION_MAXAGE`)
- **Claims:** Contains `email`, `name`, `picture` (standard Google profile)
- **No roles in JWT:** Roles are looked up server-side on each request, not embedded in token

_Assessment:_ JWT structure is standard NextAuth. The 30-day expiry is generous but acceptable for PoC with known users.

### Route Authorization Spot-Check

Tested 3 sensitive routes with a no-role user (authenticated but not in allowlist):

| Route | Expected | Actual | Verdict |
|-------|----------|--------|---------|
| `GET /api/admin/users` | 403 | 403 | Pass |
| `POST /api/experiences` | 403 | 403 | Pass |
| `GET /api/storage/...` | 403 | 200 | **Fail** |

The storage API relies only on authentication, not authorization. An authenticated user with no roles can read stored files if they know the path. This confirms the AI's "fail-open" concern with concrete evidence.

_Severity:_ Medium - storage content exposure to any authenticated user.
_Note:_ For PoC with trusted users, this is acceptable but should be documented.

---

## PoC Readiness Assessment

- [x] All PoC blockers addressed? **Yes — no blockers remain**
- [x] New blockers discovered? **No**
- [x] Acceptable for PoC code release

### Summary of Human Review Additions

| Finding | Severity | PoC Status | Notes |
|---------|----------|------------|-------|
| AUTH-1 (Open registration) | Medium | Documentation | Deployer responsibility |
| AUTH-4 (Session-WS binding) | Low | Acceptable | Revocation delay until reconnect |
| AUTH-5 (Dual storage priority) | Low | Acceptable | Operational clarity issue |
| AUTH-6 (OAuth state) | N/A | Verified | CSRF protection confirmed |
| Storage API auth gap | Medium | Acceptable | Document as known limitation |

### Recommendations

1. Document open registration prominently in setup instructions
2. Document the storage API auth gap as a known limitation
3. Consider adding route-level permission logging for audit trail

---

## Sign-off

- **Reviewer:** Chris (Technical Auditor)
- **Date:** 2026-02-03
- **Time Spent:** 4 hrs
