---
id: setup
title: Setup
sidebar_position: 2
---

# Developer Setup

Get Primer running on your local machine for development.

## What You're Setting Up

```
Frontend (Next.js 15 / React 19)
     ↕ Socket.IO
Backend (Node.js / Express / NextAuth)
     ↕
AI Providers (OpenAI / Anthropic / Google AI)
```

## Prerequisites

### System Requirements

- **Node.js** 20.x or higher ([Download](https://nodejs.org/))
- **npm** (comes with Node.js)
- **Git** for version control
- A code editor (VS Code, WebStorm, etc.)

### Required API Keys

#### 1. OpenAI API Key (Required)

Primer uses OpenAI's Realtime API for voice interactions.

1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Click **Create new secret key**
4. Configure the key:
   - **Owned by**: Select **You**
   - **Name**: Give it a descriptive name (e.g., "primer-dev")
   - **Project**: Select **Default project** (or your preferred project)
   - **Permissions**: Select **All**
5. Click **Create secret key**
6. Copy and save the key securely (starts with `sk-proj-...`) — you won't be able to see it again

:::warning
To use the Realtime API, you need an OpenAI account with active billing and permission to access the supported realtime models.
:::

#### 2. Google OAuth Credentials (Required)

For user authentication via Google sign-in:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the **project selector dropdown** at the top-left of the page (next to "Google Cloud")
3. In the modal that appears, click **New Project** in the top-right
4. Enter a project name (e.g., "Primer Dev") and click **Create**
5. Make sure your new project is selected in the project selector dropdown
6. Navigate to **APIs & Services** → **Credentials** (use the left sidebar or search bar)
7. Click **Create Credentials** → **OAuth client ID**
8. If prompted to configure the OAuth consent screen first:
   - User Type: Select **External**, then click **Create**
   - App name: "Primer Local Dev" (or your preference)
   - User support email: Select your email
   - Developer contact information: Enter your email
   - Click **Save and Continue** through the remaining steps (Scopes, Test Users) — defaults are fine
9. Back on **Credentials**, click **Create Credentials** → **OAuth client ID**
10. Configure the OAuth client:
    - Application type: **Web application**
    - Name: "Primer Local"
    - Under **Authorized redirect URIs**, click **Add URI** and enter: `http://localhost:3000/api/auth/callback/google`
11. Click **Create**
12. Copy the **Client ID** and **Client Secret** from the confirmation dialog

#### 3. Optional API Keys

- **Anthropic API Key** (for Claude models): [console.anthropic.com](https://console.anthropic.com/)
- **Google AI API Key** (for Gemini models): [makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/wharton-generative-ai-labs/primer.git
cd primer
```

### 2. Install Dependencies

```bash
npm install
```

:::tip
The `package-lock.json` is committed for deterministic builds. Always commit changes to it when updating dependencies.
:::

### 3. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

First, generate a random secret for NextAuth:

```bash
openssl rand -base64 32
```

Copy the output — you'll use it as your `NEXTAUTH_SECRET` below.

Now open `.env` in your editor and fill in the required values:

```bash
# Required — Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Required — NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="paste-the-generated-secret-here"

# Required — OpenAI
OPENAI_API_KEY="sk-proj-your-openai-api-key-here"
```

**Optional variables:**

```bash
# Anthropic (for Claude models)
ANTHROPIC_API_KEY="sk-ant-api03-your-key-here"

# Google AI (for Gemini models)
GOOGLE_AI_API_KEY="your-google-ai-api-key-here"

# Agent timeout (default: 15 min / 900000ms)
# NEXT_PUBLIC_DELEGATION_TIMEOUT_MS=900000
```

See `.env.example` for all available options.

:::caution Security
Use separate credentials for development, staging, and production. Never commit your `.env` file to git.
:::

### 4. Set Up Admin Access (Recommended)

To create and manage experiences locally, grant your Google account admin access by adding this to your `.env`:

```bash
USER_ROLE_MAPPINGS='{"your-email@example.com":["ADMIN"]}'
```

Replace `your-email@example.com` with the Google email you'll sign in with.

:::tip
Without this, you'll see a "Please contact an administrator" message after signing in and won't be able to create or manage experiences.
:::

### 5. Start the Development Server

```bash
npm run dev
```

You should see output including:

```
CORS allowed origins: [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000"
]
INFO: Server ready
    port: 3000
INFO: Socket.IO server ready
    path: "/api/socketio"
```

### 6. Verify It Works

1. Open [http://localhost:3000](http://localhost:3000)
2. Click **Sign in with Google** and authenticate
3. Load a sample experience from the catalog
4. Start an interactive session and test voice input (grant microphone permission if prompted)

## Project Structure

```
primer/
├── server.ts              # Custom server (Socket.IO + Next.js)
├── src/
│   ├── app/               # Next.js app directory
│   │   ├── api/           # API routes
│   │   ├── lib/tools/     # Tool system (20+ tools)
│   │   ├── lib/agents/    # Agent management
│   │   ├── lib/ToolRegistry.ts
│   │   ├── play/          # Experience player
│   │   └── manage/        # Experience editor
│   ├── components/        # React UI components
│   ├── lib/               # Shared utilities
│   └── middleware.ts       # Edge middleware
├── storage/               # Runtime storage (git-ignored)
├── ai_context/            # Architecture docs
├── public/                # Static assets
└── docs/                  # This documentation
```

## Common Commands

```bash
npm run dev          # Development with hot reload
npm run build        # Production build
npm start            # Production server
npm run lint         # Run ESLint
npm test             # Run tests
```

## Working with Experiences

Experiences are stored in the `storage/` directory:

```bash
storage/
└── my-experience/
    ├── experience.json
    └── resources/
        ├── scenes/
        ├── sounds/
        └── instructions/
```

1. Navigate to `storage/{experienceId}/`
2. Edit `experience.json` or instruction files
3. Reload the experience in the browser

## Environment-Specific Notes

### Edge Runtime (Middleware)

The middleware runs in Next.js Edge Runtime:

- No Node.js APIs (fs, path, etc.)
- Keep imports minimal
- Authentication only, no heavy logic

### Node.js Runtime (API Routes)

API routes have full Node.js access:

- File system operations
- Child processes
- All Node.js modules

## Troubleshooting

### Port Already in Use

```
Error: Port 3000 is already in use
```

```bash
# Kill process on port 3000
kill -9 $(lsof -ti:3000)

# Or use a different port
PORT=3001 npm run dev
```

### Module Not Found / Installation Issues

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Google OAuth Not Working

If you see `redirect_uri_mismatch` or authentication fails:

1. Verify `NEXTAUTH_URL` in `.env` matches exactly: `http://localhost:3000`
2. Check Google Cloud Console redirect URI is: `http://localhost:3000/api/auth/callback/google`
3. Ensure you're using the correct Client ID and Secret
4. Try regenerating `NEXTAUTH_SECRET` with `openssl rand -base64 32`

### OpenAI API Errors

If you see `401 Unauthorized` or API key invalid:

1. Verify your API key starts with `sk-proj-`
2. Check your OpenAI account has [billing enabled](https://platform.openai.com/settings/organization/billing)
3. Ensure you have access to GPT-4 models

### Socket.IO Connection Issues

If the browser console shows WebSocket connection errors:

1. Ensure the dev server is fully started before opening the browser
2. Check no firewall is blocking `localhost:3000`
3. Clear browser cache and cookies
4. Try a different browser

### TypeScript / Build Errors

```bash
rm -rf .next
npm run dev
```

### Environment Variables Not Loading

1. Ensure `.env` file is in the project root (same level as `package.json`)
2. Restart the dev server after changing `.env`
3. Check for syntax errors in `.env` (no spaces around `=`)
4. Verify the file is named `.env` exactly (not `.env.txt`)

## Next Steps

- Read [Project Structure](/developer/project-structure) for detailed code organization
- Check [Architecture Guide](/developer/architecture/architecture-guide) to understand the system
- Try [Creating Your First Experience](/developer/guides/creating-first-experience)
- See [Custom Tools](/developer/guides/custom-tools) to extend functionality

## Getting Help

- Check this documentation
- Review code comments
- Open an issue on GitHub
- See [Contributing](/developer/contributing) guide
