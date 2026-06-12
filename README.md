# NextFlow

NextFlow is a production-oriented workflow studio for building image and text pipelines in a visual canvas. It combines a polished Next.js frontend, Clerk authentication, Neon Postgres via Prisma, Trigger.dev task execution, Gemini model integration, and Transloadit-backed media processing into one workspace.

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-0ea5e9?style=flat-square&logo=tailwindcss)
![Neon](https://img.shields.io/badge/Neon-Postgres-00e599?style=flat-square)
![Trigger.dev](https://img.shields.io/badge/Trigger.dev-v4-6d28d9?style=flat-square)
![Clerk](https://img.shields.io/badge/Clerk-Auth-6c47ff?style=flat-square)

## Overview

NextFlow is designed around a simple idea:

- authenticate the user first
- bring them into a personal workflow workspace
- let them build visually with nodes
- run workflows with real execution infrastructure
- inspect results and return later without losing context

The app includes:

- a marketing homepage
- protected sign-in and sign-up routes
- a workflow dashboard at `/workflows`
- a node-based studio at `/workflows/:id`
- workflow templates
- execution history with a run inspector panel
- background execution via Trigger.dev
- text generation with Gemini
- image crop through Transloadit (client-side canvas crop fallback included)

## Core Features

### Product Features

- visual workflow editor for text and image tasks
- create, rename, switch, duplicate, and delete workflows
- starter templates for common creative flows
- inline node results and a dedicated history inspector
- quick-access node palette with search
- import/export workflow JSON
- authentication-first access flow
- persistent workspace state (localStorage + Neon Postgres via API)

### Node Types

- `Request Input`
  - composable input node with text and image fields
  - each field emits its own output handle for connecting downstream
- `Crop Image`
  - crops an image using canvas (client-side) or Transloadit (server-side)
  - accepts x/y/width/height as percentages
- `Gemini 2.5 Flash`
  - accepts optional system prompt, required prompt, optional image
  - returns text inline on the node
- `Response`
  - collects outputs from connected upstream nodes
  - displays all results in an expandable panel

### Execution Features

- full workflow execution
- selected-node execution
- single-node execution
- Trigger.dev-backed background tasks for crop/LLM
- model fallback for Gemini text generation when a model is under temporary high demand
- execution history with status, timing, inputs, outputs, and errors

## Tech Stack

### Frontend

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- React Flow (@xyflow/react)
- Zustand
- shadcn/ui component library
- Lucide icons

### Backend / Infrastructure

- Prisma ORM
- Neon Postgres
- Clerk authentication
- Trigger.dev v4
- Google Gemini API
- Transloadit

## Architecture

### High-Level System

```text
+--------------------------+
|       Next.js App        |
| Homepage + Workflow UI   |
+-------------+------------+
              |
              | Auth
              v
        +------------+
        |   Clerk    |
        +------------+
              |
              | API calls
              v
+------------------------------------+
|  Next.js Route Handlers / APIs     |
|  /api/workflows                    |
|  /api/workflows/[id]               |
|  /api/workflows/[id]/runs          |
|  /api/gemini                       |
+-------------+----------------------+
              |
      +-------+--------+---------------+
      |       |        |               |
      v       v        v               v
   Prisma   Trigger   Gemini       Transloadit
     + DB     tasks   text/image    crop/frame
      |
      v
    Neon
```

### Workflow Execution Flow

1. User builds or opens a workflow in the studio
2. The frontend executes nodes in topological order (level by level)
3. Nodes call the Gemini API route or Trigger.dev tasks depending on type
4. Outputs are piped into connected downstream nodes automatically
5. The studio updates node results and writes a run entry to history
6. The user can inspect the full run in the history drawer

### State and Persistence

There are two persistence layers:

- **Browser persistence**
  - workspace state uses localStorage for instant load on page revisit
- **Neon Postgres via API**
  - workflows are created, updated, and deleted through REST routes
  - runs are written to the database after each execution

## Authentication Flow

The app uses Clerk for authentication.

- `/workflows` is protected when Clerk environment variables are configured
- unauthenticated users are redirected to `/sign-in`
- sign-up is available at `/sign-up`
- if Clerk is not configured, the app remains bootable and surfaces configuration gaps instead of crashing

## Database Schema

The Prisma schema lives at [`prisma/schema.prisma`](prisma/schema.prisma).

Main models:

- `Workflow`
  - stores workflow structure
  - includes `nodesJson` and `edgesJson`
- `WorkflowRun`
  - stores each run summary, status, timing, and scope
- `WorkflowNodeRun`
  - stores per-node execution detail

Enums:

- `WorkflowRunScope`
  - `FULL`
  - `SELECTED`
  - `SINGLE`
- `WorkflowRunStatus`
  - `SUCCESS`
  - `FAILED`
  - `RUNNING`
  - `PARTIAL`

## Environment Variables

Create a `.env` file in the project root (copy `.env.example` as a starting point).

```env
DATABASE_URL=
SESSION_SECRET=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
TRANSLOADIT_KEY=
TRANSLOADIT_SECRET=
TRIGGER_SECRET_KEY=
```

### Variable Reference

- `DATABASE_URL`
  - Neon Postgres connection string used by Prisma
  - format: `postgresql://user:pass@host/db?sslmode=require`
- `SESSION_SECRET`
  - reserved app secret value for secure server-side flows
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - Clerk frontend publishable key (starts with `pk_`)
- `CLERK_SECRET_KEY`
  - Clerk backend secret key (starts with `sk_`)
- `GOOGLE_GENERATIVE_AI_API_KEY`
  - Gemini API key for text generation
  - get it at: https://aistudio.google.com/app/apikey
- `TRANSLOADIT_KEY`
  - Transloadit auth key for media processing
- `TRANSLOADIT_SECRET`
  - Transloadit secret for token and assembly creation
- `TRIGGER_SECRET_KEY`
  - Trigger.dev access token for server-side task dispatch
  - format: `tr_dev_...` (dev) or `tr_prod_...` (prod)

## Installation

### Prerequisites

- Node.js 18+
- npm
- Neon database
- Clerk project
- Trigger.dev project
- Gemini API key
- Transloadit project (optional — crop falls back to canvas if missing)

### Install Dependencies

```bash
npm install
```

## Local Development

### 1. Configure environment variables

Copy the example file and fill in your keys:

```bash
cp .env.example .env
```

Edit `.env` with your actual values.

### 2. Generate Prisma client

```bash
npm run db:generate
```

### 3. Push the schema to Neon

```bash
npm run db:push
```

### 4. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Start the Trigger.dev worker in another terminal

```bash
npm run trigger:dev
```

This is required for:

- LLM tasks via Trigger.dev backend
- image crop via Transloadit

If you skip this step, the app still runs — Gemini calls fall through to the `/api/gemini` route directly, and crop uses client-side canvas processing as a fallback.

## Available Scripts

### App Scripts

```bash
npm run dev         # start local dev server
npm run build       # build production bundle
npm run start       # start production server
npm run lint        # run ESLint
```

### Database Scripts

```bash
npm run db:generate   # regenerate Prisma client
npm run db:push       # push schema to Neon (no migrations)
npm run db:migrate    # apply committed Prisma migrations
```

### Debug Scripts

```bash
npm run debug:gemini           # test Gemini text generation
npm run debug:gemini-image     # test Gemini image generation
npm run debug:extract-frame    # test Transloadit frame extraction
```

### Trigger.dev Scripts

```bash
npm run trigger:dev      # run local Trigger.dev worker
npm run trigger:deploy   # deploy tasks to Trigger.dev cloud
```

## Debugging Scripts

### Test Gemini Text

```bash
npm run debug:gemini -- --model=gemini-2.5-flash-lite --prompt="Say hello in one line"
```

Optional image input:

```bash
npm run debug:gemini -- --model=gemini-2.5-flash-lite --prompt="Describe this image" --image="C:\path\to\image.jpg"
```

### Test Gemini Image Generation

```bash
npm run debug:gemini-image -- --model=gemini-3.1-flash-image-preview --prompt="Create a cinematic illustrated scene"
```

## Project Structure

```text
src/
├── app/
│   ├── api/
│   │   ├── gemini/route.ts
│   │   └── workflows/
│   │       ├── route.ts
│   │       ├── [id]/route.ts
│   │       ├── [id]/runs/route.ts
│   │       └── run/route.ts
│   ├── sign-in/
│   ├── sign-up/
│   ├── workflows/
│   │   ├── [workflowId]/page.tsx
│   │   └── page.tsx
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── providers/
│   │   └── app-providers.tsx
│   └── workflow/
│       ├── custom-edge.tsx
│       ├── nodes.tsx
│       ├── workflow-store.ts
│       ├── workflow-studio.tsx
│       └── workflows-dashboard.tsx
├── lib/
│   ├── client-media.ts
│   ├── db.ts
│   ├── env.ts
│   ├── utils.ts
│   ├── workflow-sample.ts
│   └── workflow-utils.ts
└── trigger/
    └── tasks.ts

scripts/
├── test-extract-frame.ts
├── test-gemini-image.ts
└── test-gemini.ts

prisma/
├── migrations/
└── schema.prisma

trigger.config.mjs
```

## API Endpoints

### `GET /api/workflows`

Returns all workflows for the current user.

### `POST /api/workflows`

Creates a new workflow record through Prisma.

Payload:

```json
{
  "id": "uuid",
  "userId": "user_123",
  "name": "Homepage flow",
  "nodesJson": [],
  "edgesJson": []
}
```

### `PUT /api/workflows/:id`

Updates workflow nodes and edges.

```json
{
  "nodesJson": [],
  "edgesJson": []
}
```

### `DELETE /api/workflows/:id`

Deletes a workflow and all associated runs.

### `GET /api/workflows/:id/runs`

Returns all runs for a workflow.

### `POST /api/gemini`

Calls Gemini directly for text generation.

```json
{
  "model": "gemini-2.5-flash",
  "prompt": "Write a haiku",
  "systemPrompt": "Optional system message",
  "imageInput": "https://... or data:image/png;base64,..."
}
```

### `POST /api/workflows/run`

Runs a workflow or subset of nodes.

```json
{
  "workflowId": "workflow-id",
  "scope": "full",
  "targetIds": [],
  "nodes": [],
  "edges": []
}
```

Scopes:

- `full`
- `selected`
- `single`

## Hosting / Production Deployment

Recommended stack:

- **Vercel** for the Next.js app
- **Neon** for Postgres
- **Clerk** for auth
- **Trigger.dev** for background tasks

### Step-by-step Deployment

#### 1. Set up Neon Postgres

1. Create an account at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string (it looks like `postgresql://user:pass@host/db?sslmode=require`)

#### 2. Set up Clerk

1. Create a project at [clerk.com](https://clerk.com)
2. In the Clerk dashboard:
   - go to **API Keys**
   - copy the **Publishable Key** (`pk_live_...`)
   - copy the **Secret Key** (`sk_live_...`)
3. Under **Domains**, add your Vercel deployment URL (e.g. `https://your-app.vercel.app`)
4. Configure redirect URLs if needed (Clerk usually handles these automatically)

#### 3. Set up Trigger.dev

1. Create an account at [trigger.dev](https://trigger.dev)
2. Create a new project — note the **project ref** (e.g. `proj_aynpkitmssjglhbluaik`)
3. Go to **API Keys** in the Trigger.dev dashboard
4. Create a new **Production** secret key (`tr_prod_...`)
5. Deploy your tasks:

```bash
# Login to Trigger.dev CLI
npx trigger.dev@latest login

# Deploy tasks to production
npm run trigger:deploy
```

> **Important**: The Trigger.dev CLI resolves TypeScript path aliases using relative imports. The task file at `src/trigger/tasks.ts` already uses `../lib/env` (relative) instead of `@/lib/env` (alias) to ensure the build succeeds.

If you see a build error like:
```
Error: Build failed with 1 error:
../home/builder/.npm/.../esbuild/lib/...
```
Check that no file in `src/trigger/` uses `@/` path aliases — convert them to relative imports (e.g. `../lib/env`).

#### 4. Set up Transloadit (optional)

1. Create an account at [transloadit.com](https://transloadit.com)
2. Go to **Credentials** → copy **Auth Key** and **Auth Secret**
3. Without Transloadit, image crop falls back to browser-side canvas processing automatically

#### 5. Get a Gemini API Key

1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Create a new API key

#### 6. Deploy to Vercel

1. Push your repo to GitHub
2. Import the repo at [vercel.com/new](https://vercel.com/new)
3. In the Vercel project settings, add all environment variables:

```
DATABASE_URL=postgresql://...
SESSION_SECRET=any-random-string-32-chars
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
GOOGLE_GENERATIVE_AI_API_KEY=AIza...
TRANSLOADIT_KEY=...
TRANSLOADIT_SECRET=...
TRIGGER_SECRET_KEY=tr_prod_...
```

4. Deploy. Vercel auto-detects Next.js and configures the build.

#### 7. Apply the Database Schema

After deploying, push the Prisma schema to your Neon database:

```bash
# Set DATABASE_URL in your local .env to the production Neon connection string
npm run db:push
```

Or if using migrations:

```bash
npm run db:migrate
```

#### 8. Verify the Deployment

1. Open your Vercel URL — you should see the marketing homepage
2. Click **Get started** — Clerk should redirect you to sign-in
3. Sign up or sign in
4. Create a new workflow, add nodes, and run it
5. Check the Trigger.dev dashboard for task executions

### Vercel Environment Variables Reference

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Neon project → Connection Details |
| `SESSION_SECRET` | Generate any random 32+ char string |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk → API Keys → Publishable Key |
| `CLERK_SECRET_KEY` | Clerk → API Keys → Secret Key |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google AI Studio → API Keys |
| `TRANSLOADIT_KEY` | Transloadit → Credentials |
| `TRANSLOADIT_SECRET` | Transloadit → Credentials |
| `TRIGGER_SECRET_KEY` | Trigger.dev → API Keys → Production |

## Verification

Run the full verification set before shipping:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Current Constraints

- the interactive studio persists its main working state in localStorage (fast, offline-capable) and syncs to Neon Postgres in the background
- media-processing tasks via Transloadit depend on reachable public URLs — local `file://` or `data:` URLs fall back to client-side canvas processing
- Trigger.dev tasks must use relative imports (not `@/` path aliases) because the esbuild bundler used by the Trigger.dev CLI does not read `tsconfig.json` paths

## Author

**Deekshant Gupta**

- Portfolio: [https://deekshant-g.netlify.app/](https://deekshant-g.netlify.app/)
- GitHub: [https://github.com/deekshant4758](https://github.com/deekshant4758)

## License

This project is licensed under the MIT License.
