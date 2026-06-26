# Modifying the Auth System

Primer's auth is built on **NextAuth v4** with a custom RBAC layer on top. The two parts are independent: NextAuth handles *who you are* (identity), while Primer's role system handles *what you can do* (authorization). Both are easy to extend.

---

## How it works today

```
User visits /  →  middleware.ts (JWT check)  →  /auth/signin if unauthenticated
User signs in  →  NextAuth (Google OAuth)    →  session callback merges roles
                                             →  session.user.roles + privileges
```

**Key files:**

| File | Purpose |
|------|---------|
| `src/lib/authOptions.ts` | NextAuth config (providers, callbacks) |
| `src/middleware.ts` | Edge middleware — JWT check, route protection |
| `src/config/auth.ts` | Role and permission definitions |
| `src/config/user-storage.ts` | Merges env-var and file-based role assignments |
| `src/app/api/auth/[...nextauth]/route.ts` | NextAuth catch-all route |

---

## Adding a second OAuth provider

NextAuth supports many providers. Adding GitHub (for example) takes three steps:

### 1. Install (if needed) and import

Most providers are bundled with `next-auth`:

```ts
// src/lib/authOptions.ts
import GitHubProvider from 'next-auth/providers/github';
```

### 2. Add to the providers array

```ts
providers: [
  GoogleProvider({ clientId: env.GOOGLE_CLIENT_ID!, clientSecret: env.GOOGLE_CLIENT_SECRET! }),
  GitHubProvider({ clientId: env.GITHUB_CLIENT_ID!, clientSecret: env.GITHUB_CLIENT_SECRET! }),
],
```

### 3. Add env vars

```
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

The sign-in page at `src/app/auth/signin/page.tsx` automatically renders a button for each configured provider via `getProviders()`.

---

## Adding Microsoft / Azure AD (SAML/OIDC)

Use `next-auth/providers/azure-ad` for Microsoft 365 / Entra ID:

```ts
import AzureADProvider from 'next-auth/providers/azure-ad';

AzureADProvider({
  clientId: env.AZURE_AD_CLIENT_ID!,
  clientSecret: env.AZURE_AD_CLIENT_SECRET!,
  tenantId: env.AZURE_AD_TENANT_ID!,
})
```

For generic SAML, use the community `next-auth-saml` adapter or mount a `passport-saml` route in `server.ts` alongside the Next.js handler.

---

## Changing role assignment logic

Roles are currently resolved in two places (merged in `src/config/user-storage.ts`):

1. `USER_ROLE_MAPPINGS` env var — JSON object `{ "email": ["ROLE"] }`.
2. `storage/config/users.json` — managed via the admin UI.

To add a third source (e.g. an external directory or database):

```ts
// src/config/user-storage.ts

export function getMergedUserRolesForUser(email: string): Role[] {
  const envRoles = getEnvUserRoles(email);
  const fileRoles = getFileUserRoles(email);
  const dbRoles = getDbUserRoles(email);   // ← add this

  // Env takes precedence; others are merged
  if (envRoles.length) return envRoles;
  return uniqueRoles([...fileRoles, ...dbRoles]);
}
```

You can also assign roles dynamically in the `session` callback in `authOptions.ts` based on the OAuth profile (e.g. assign `EDUCATOR` to anyone with an `@yourschool.edu` email domain):

```ts
session: async ({ session }) => {
  if (session?.user?.email?.endsWith('@yourschool.edu')) {
    session.user.roles = [ROLES.EDUCATOR];
    session.user.privileges = ROLES.EDUCATOR.permissions;
  }
  return session;
},
```

---

## Adding a new role

Edit `src/config/auth.ts`:

1. Add the key to `RoleKey`:
   ```ts
   export type RoleKey = 'PLAYER' | 'EDUCATOR' | ... | 'TEACHING_ASSISTANT';
   ```
2. Add the role to `ROLES` with the permissions it should carry:
   ```ts
   TEACHING_ASSISTANT: {
     key: 'TEACHING_ASSISTANT',
     permissions: [
       Permission.PLAY_EXPERIENCE,
       Permission.LIST_EXPERIENCES,
       Permission.MANAGE_OWN_CLASS_MEMBERS,
     ]
   }
   ```
3. Assign it to users via the admin UI or `USER_ROLE_MAPPINGS`.

---

## Disabling authentication entirely (dev/private deploy)

Set `NEXT_PUBLIC_DEV_AUTH_BYPASS=true` in your `.env`. The middleware (`src/middleware.ts`) detects this and skips the JWT check in non-production builds. All users are treated as having admin privileges.

**Do not use this in production.** It is intended for local development where you do not want to configure Google OAuth.

---

## Replacing NextAuth completely

If you need a fundamentally different auth system (e.g. institutional SSO with `passport.js`, a JWT-based API gateway, or a service like Auth0 or Clerk):

1. **Remove** `src/lib/authOptions.ts` and `src/app/api/auth/[...nextauth]/route.ts`.
2. **Replace** `src/middleware.ts`'s `getToken` call with your system's session validator.
3. **Ensure** your session shape includes `session.user.email`, `session.user.roles`, and `session.user.privileges` — everything else in Primer reads from those three fields.
4. Update `src/app/auth/signin/page.tsx` to redirect to your new login URL.

The permission check helpers (`hasPermission`, `hasRole`) in `src/config/auth.ts` are pure functions that work on the resolved roles array — they do not depend on NextAuth and require no changes.
