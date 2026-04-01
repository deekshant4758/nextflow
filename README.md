# NextFlow

NextFlow is a production-oriented workflow studio for building image, video, and text pipelines in a visual canvas. It combines a polished Next.js frontend, Clerk authentication, Neon Postgres via Prisma, Trigger.dev task execution, Gemini model integration, and Transloadit-backed media processing into one workspace.

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
- a workflow studio at `/workflows`
- node-based editing with React Flow
- workflow templates
- execution history with a run inspector modal
- background execution via Trigger.dev
- text generation with Gemini
- image generation with Gemini
- image crop and frame extraction through Transloadit

## Core Features

### Product Features

- visual workflow editor for text, image, and video tasks
- create, rename, switch, and delete workflows
- starter templates for common creative flows
- inline node results and a dedicated run inspector
- quick-access node palette
- import/export workflow JSON
- authentication-first access flow
- persistent local workspace state in the browser

### Node Types

- `Text`
  - used for prompts, system guidance, or plain text values
- `Upload Image`
  - accepts image URL or local file input
- `Upload Video`
  - accepts video URL or local file input
- `Run Any LLM`
  - accepts:
    - optional `system_prompt`
    - required `user_message`
    - optional multiple `images`
  - returns text inline on the node
- `Generate Image`
  - accepts:
    - optional style guidance
    - required prompt
    - optional multiple reference images
  - returns generated image output
- `Crop Image`
  - crops an image using backend media processing
- `Extract Frame`
  - extracts a still frame from a video using backend media processing

### Execution Features

- full workflow execution
- selected-node execution
- single-node execution
- Trigger.dev-backed background tasks
- model fallback for Gemini text generation when a model is under temporary high demand
- execution history with status, timing, inputs, outputs, and errors

## Tech Stack

### Frontend

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- React Flow
- Zustand
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
|  /api/workflows/run                |
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
2. The frontend sends node and edge state to `/api/workflows/run`
3. The API sorts the graph and executes nodes in dependency order
4. Runnable nodes dispatch work to Trigger.dev tasks
5. Trigger tasks call Gemini or Transloadit depending on node type
6. Outputs are returned to the app
7. The studio updates node results and writes a run entry to history
8. The user can inspect the full run in the modal inspector

### State and Persistence

There are currently two persistence layers in the project:

- **Browser persistence**
  - the main workspace state uses local storage so users can return to their last in-browser state during development
- **Database schema + API**
  - Prisma models and a workflow creation API are present for Neon-backed persistence

Important:

- the Prisma schema and workflow create API exist
- the interactive studio still primarily uses local browser persistence for day-to-day editing
- this makes local iteration fast while the backend data model is already in place for production expansion

## Authentication Flow

The app uses Clerk for authentication.

- `/workflows` is protected when Clerk environment variables are configured
- unauthenticated users are redirected to `/sign-in`
- sign-up is available at `/sign-up`
- if Clerk is not configured, the app remains bootable and surfaces configuration gaps instead of crashing

## Database Schema

The Prisma schema lives at [`prisma/schema.prisma`](C:/Users/deeks/Documents/New%20project/prisma/schema.prisma).

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

Create a `.env.local` file in the project root.

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
- `SESSION_SECRET`
  - reserved app secret value for secure server-side flows
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - Clerk frontend key
- `CLERK_SECRET_KEY`
  - Clerk backend secret
- `GOOGLE_GENERATIVE_AI_API_KEY`
  - Gemini API key for text and image generation
- `TRANSLOADIT_KEY`
  - Transloadit auth key
- `TRANSLOADIT_SECRET`
  - Transloadit secret for token and assembly creation
- `TRIGGER_SECRET_KEY`
  - Trigger.dev access token for server-side task dispatch

## Installation

### Prerequisites

- Node.js 18+
- npm
- Neon database
- Clerk project
- Trigger.dev project
- Gemini API key
- Transloadit project

### Install Dependencies

```bash
npm install
```

## Local Development

### 1. Start the app

```bash
npm run dev
```

Open:

- [http://localhost:3000](http://localhost:3000)

### 2. Start the Trigger.dev worker in another terminal

```bash
npm run trigger:dev
```

This is required for:

- LLM tasks
- image generation
- image crop
- video frame extraction

### 3. Generate Prisma client

```bash
npm run db:generate
```

### 4. Push the schema to Neon

```bash
npm run db:push
```

### 5. Or apply committed migrations

```bash
npm run db:migrate
```

## Available Scripts

### App Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

### Database Scripts

```bash
npm run db:generate
npm run db:push
npm run db:migrate
```

### Debug Scripts

```bash
npm run debug:gemini
npm run debug:gemini-image
npm run debug:extract-frame
```

### Trigger.dev Scripts

```bash
npm run trigger:dev
npm run trigger:deploy
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

With a reference image:

```bash
npm run debug:gemini-image -- --model=gemini-3.1-flash-image-preview --prompt="Create a stylized version of this image" --image="C:\path\to\image.jpg"
```

### Test Trigger Frame Extraction

```bash
npm run debug:extract-frame -- --video="https://www.w3schools.com/html/mov_bbb.mp4" --timestamp="1.2"
```

This script:

- triggers `extract-frame-node`
- polls Trigger.dev
- prints the raw task output
- prints the resolved output URL

## Project Structure

```text
src/
├── app/
│   ├── api/
│   │   └── workflows/
│   │       ├── route.ts
│   │       └── run/route.ts
│   ├── sign-in/
│   ├── sign-up/
│   ├── workflows/
│   │   ├── client-workflow-studio.tsx
│   │   └── page.tsx
│   ├── favicon.ico
│   ├── globals.css
│   ├── icon.svg
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── providers/
│   │   └── app-providers.tsx
│   └── workflow/
│       ├── nodes.tsx
│       ├── workflow-store.ts
│       └── workflow-studio.tsx
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

trigger.config.ts
```

## API Endpoints

### `POST /api/workflows`

Creates a workflow record through Prisma.

Payload:

```json
{
  "userId": "user_123",
  "name": "Homepage flow",
  "description": "optional",
  "nodesJson": [],
  "edgesJson": []
}
```

### `POST /api/workflows/run`

Runs a workflow or subset of nodes.

Payload:

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

- Vercel for the Next.js app
- Neon for Postgres
- Clerk for auth
- Trigger.dev for tasks

### Deployment Order

1. Create your Neon production database
2. Create your Clerk production instance and configure domains
3. Import the repo into Vercel
4. Add production environment variables in Vercel
5. Deploy Trigger.dev tasks
6. Test auth, workflow execution, and media processing

### Vercel

Add all environment variables in the Vercel project settings, then redeploy.

### Trigger.dev

Deploy tasks with:

```bash
npx trigger.dev@latest login
npm run trigger:deploy
```

The current Trigger.dev project config is:

- project ref: `proj_aynpkitmssjglhbluaik`

## Verification

Run the full verification set before shipping:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Current Constraints

- the interactive studio still persists its main working state in local storage
- backend workflow creation exists, but full workflow CRUD persistence is not yet fully wired into the studio UI
- media-processing tasks depend on reachable public URLs for the most reliable backend execution path

## Author

**Deekshant Gupta**

- Portfolio: [https://deekshant-g.netlify.app/](https://deekshant-g.netlify.app/)
- GitHub: [https://github.com/deekshant4758](https://github.com/deekshant4758)

## License

This project is licensed under the MIT License.
