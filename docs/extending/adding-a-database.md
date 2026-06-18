# Adding a Database

Primer currently stores everything on the local filesystem via `LocalStorageService`. This works well for single-server deployments on Render (with a persistent disk) but does not survive Heroku dynos restarting and cannot support horizontal scaling or advanced querying. Adding a relational database is straightforward because all storage access is routed through a clean interface.

---

## How storage works today

Every read and write goes through the `StorageService` interface defined in `src/app/lib/storage/StorageService.ts`:

```
storeFile / readFile / deleteFile / listFiles / listDirectories /
fileExists / getFileUrl / getFileStats / createDirectory / deleteDirectory
```

`StorageServiceFactory` (`src/app/lib/storage/StorageServiceFactory.ts`) instantiates `LocalStorageService`. The only thing you need to change is what that factory returns.

User/role data has a separate path via `src/config/user-storage.ts` (reads `storage/config/users.json`) and in-env via `USER_ROLE_MAPPINGS`.

---

## Recommended stack: PostgreSQL + Prisma

### 1. Install dependencies

```bash
npm install prisma @prisma/client
npx prisma init
```

Set `DATABASE_URL` in `.env`:

```
DATABASE_URL="postgresql://user:password@host:5432/primer"
```

### 2. Define the schema

Create `prisma/schema.prisma`. Start with the tables that mirror what the filesystem currently stores:

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  roles     String[] // RoleKey values
  createdAt DateTime @default(now())
}

model Experience {
  id        String   @id
  config    Json     // experience.json contents
  ownerId   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  sessions  Session[]
  classes   Class[]
}

model Session {
  id           String     @id @default(cuid())
  experienceId String
  experience   Experience @relation(fields: [experienceId], references: [id])
  data         Json
  createdAt    DateTime   @default(now())
}

model Class {
  id           String     @id @default(cuid())
  experienceId String
  experience   Experience @relation(fields: [experienceId], references: [id])
  name         String
  memberEmails String[]
}

model Artifact {
  id           String   @id @default(cuid())
  experienceId String
  sessionId    String?
  name         String
  content      String
  revision     Int      @default(1)
  createdAt    DateTime @default(now())
}
```

Run `npx prisma migrate dev --name init` to create the tables.

### 3. Implement a database-backed StorageService (for binary files)

For binary assets (images, audio, uploaded zips) you have two options:

- **S3** — `@aws-sdk/client-s3` is already in `package.json`. Create `S3StorageService.ts` implementing the same `StorageService` interface and swap it in `StorageServiceFactory`.
- **Database BLOBs** — suitable only for small files; not recommended for media.

For structured data (users, sessions, classes, artifacts) bypass the file-based `StorageService` entirely and write Prisma-backed service classes.

### 4. Replace user storage

Edit `src/config/user-storage.ts`. Replace the `readUsersFile` / `writeUsersFile` functions with Prisma calls:

```ts
import { prisma } from '@/lib/prisma';

export async function getMergedUserRolesForUser(email: string): Promise<Role[]> {
  // Check env first (existing behaviour)
  const envRoles = getEnvUserRoles(email);
  if (envRoles.length) return envRoles;

  // Fall back to database
  const user = await prisma.user.findUnique({ where: { email } });
  return (user?.roles ?? []).map(key => ROLES[key as RoleKey]).filter(Boolean);
}
```

Create `src/lib/prisma.ts` as the singleton client:

```ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: ['warn', 'error'] });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

### 5. Replace in-memory Socket.IO session state

`server.ts` holds agent sessions in a `Map`. On restart these are lost. Move them to a Redis store or a `sessions` table:

```ts
// Instead of: const sessions = new Map<string, Session>();
// Use:
await prisma.session.upsert({ where: { id }, update: { data }, create: { id, experienceId, data } });
```

For high-frequency Socket.IO events, prefer Redis (`ioredis`) to avoid write amplification on the DB.

---

## Migration path from the filesystem

1. Keep `LocalStorageService` in place for binary file storage initially.
2. Migrate user records first (lowest risk — small data, clear schema).
3. Migrate classes and session metadata next.
4. Move binary assets to S3 last.

Run both systems in parallel during the transition: read from the DB, fall back to the filesystem, write to both. Once the DB has all data, remove the filesystem fallback.

---

## Key files to change

| File | Change |
|------|--------|
| `src/app/lib/storage/StorageServiceFactory.ts` | Return S3 or DB service |
| `src/config/user-storage.ts` | Replace JSON file reads with Prisma |
| `server.ts` | Replace in-memory `Map` with DB/Redis |
| `src/app/api/classes/` | Replace filesystem class JSON with Prisma |
| `src/app/lib/artifacts/` | Replace artifact file writes with Prisma |
| `src/app/lib/storage/LocalStorageService.ts` | Keep as fallback during migration |
