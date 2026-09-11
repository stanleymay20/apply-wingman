# Apply Wingman

**AI-assisted job discovery, application tracking and ATS workflow automation**

Apply Wingman is the maintained implementation of the job-application automation project in this GitHub portfolio. It combines a React/Vite application, Supabase data and edge functions, and a Playwright browser worker for supported application flows.

The system is designed to automate repeatable parts of a job search while keeping unsupported, blocked or ambiguous application steps visible for human action.

## What the repository contains

### Job discovery and tracking

- job discovery and ingestion workflows;
- application status tracking;
- source/platform normalization;
- recruiter-email extraction support;
- posting availability checks and stalled-application recovery;
- user-facing jobs, applications and settings views.

### ATS routing

The browser worker currently routes supported flows for:

- Greenhouse;
- Lever;
- Ashby;
- Workable;
- Recruitee;
- Personio;
- SmartRecruiters;
- Workday.

Generic form handling is used where appropriate, with a dedicated Workday adapter. Unsupported or blocked steps return for manual action rather than being silently treated as successful.

LinkedIn automation is deliberately excluded from the worker because authenticated automated applying conflicts with the platform constraints encoded by the project.

### Application architecture

**Frontend:** React · TypeScript · Vite · Tailwind CSS · shadcn/ui

**Backend:** Supabase · PostgreSQL · Deno Edge Functions

**Automation worker:** Node.js · TypeScript · Playwright

**Validation/state:** Zod · TanStack Query

## High-level workflow

```text
Job discovery / import
        ↓
Posting validation and normalization
        ↓
Application-method / ATS detection
        ↓
Supported automation or manual-action routing
        ↓
Attempt result and application tracking
        ↓
Human review / follow-up
```

## Local frontend setup

```bash
npm ci
cp .env.example .env
npm run dev
```

Required frontend variables are documented in `.env.example`.

Never commit `.env`, provider credentials, database passwords or access tokens. If a credential has ever been committed to Git history, removing the file from the latest tree is not sufficient; rotate or revoke that credential separately.

## Quality checks

```bash
npm run lint
npm run build
```

The repository also contains dedicated workflows for the browser worker and Supabase deployment path.

## Backend deployment note

The current backend is managed through Lovable Cloud. A GitHub merge alone does not prove that Supabase Edge Functions or database migrations have reached the live backend. Backend releases should be verified against the actual deployed runtime and migration state.

## Automation boundary

Application automation is not equivalent to a confirmed job application. CAPTCHAs, authentication, anti-bot controls, unusual questions, site changes and incomplete form data can require human action. The system should record those states explicitly rather than fabricating completion.

## Repository lineage

`apply-wingman` is the canonical maintained repository for this project family. The older `JobAutoPilot` repository is retained only as historical lineage; its reachable current history no longer contains the application source.
