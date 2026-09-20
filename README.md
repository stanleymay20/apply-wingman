# Apply Wingman

**AI-Assisted Job Discovery · ATS Routing · Browser Automation · Human-in-the-Loop Application Workflows**

Apply Wingman is a React/Supabase application with a Playwright automation worker for job discovery, application tracking and supported ATS workflows.

The engineering goal is not “auto-apply at any cost.” The system separates **what can be automated safely** from steps that require authentication, human judgment, anti-bot handling or missing information, and records those states explicitly instead of fabricating successful submissions.

## Recruiter quick scan

**What this repository demonstrates**

- React + TypeScript + Vite product engineering;
- Supabase/PostgreSQL application state and Edge Functions;
- Node.js/TypeScript browser automation with Playwright;
- ATS detection and routing across multiple recruitment platforms;
- explicit automation/manual-action state transitions;
- Zod validation and TanStack Query state management;
- application attempt tracking and recovery workflows;
- defensive handling for blocked, unsupported and ambiguous flows;
- separation between browser automation and backend deployment state.

## System workflow

```text
Job discovery / import
        ↓
Posting validation + normalization
        ↓
ATS / application-method detection
        ↓
Supported browser automation
        │
        ├── success → record attempt/result
        └── blocked / ambiguous / unsupported
                         ↓
                    manual action
                         ↓
                 human confirmation
```

A browser action is not treated as a confirmed application unless the system has evidence for that state.

## ATS routing

The worker currently identifies and routes supported flows for platforms including:

- Greenhouse;
- Lever;
- Ashby;
- Workable;
- Recruitee;
- Personio;
- SmartRecruiters;
- Workday.

The routing layer also contains domain-level detection for common ATS hosts. Generic form handling is used where appropriate, while Workday has a dedicated adapter.

LinkedIn authenticated auto-applying is deliberately excluded from the worker because the project treats platform constraints as an engineering boundary rather than something to silently bypass.

## Architecture

**Frontend:** React · TypeScript · Vite · Tailwind CSS · shadcn/ui

**Backend/data:** Supabase · PostgreSQL · Deno Edge Functions

**Automation worker:** Node.js · TypeScript · Playwright

**Validation/state:** Zod · TanStack Query

```text
React application
      ↓
Supabase application state
      ↓
Job / application orchestration
      ↓
Browser queue + ATS detection
      ↓
Playwright worker / adapter
      ↓
Result, blocker or manual-action state
```

## Reliability boundaries

Automation failures are first-class states.

CAPTCHAs, authentication, anti-bot controls, unusual employer questions, site redesigns, incomplete candidate data or unsupported application flows can require human action. The system should expose those conditions instead of turning them into a false “submitted” state.

This distinction is especially important in application automation, where a technically successful browser interaction is not necessarily evidence that an employer received a valid application.

## Local development

```bash
npm ci
cp .env.example .env
npm run dev
```

Required frontend variables are documented in `.env.example`.

Never commit provider credentials, database passwords, access tokens or live `.env` files. Removing a credential from the latest tree does not undo historical exposure; exposed credentials must be rotated or revoked separately.

## Quality checks

```bash
npm run lint
npm run build
```

The repository also contains dedicated workflow logic for the browser worker and backend deployment path.

## Deployment boundary

The current backend is managed through Lovable Cloud. A GitHub merge alone does not prove that Supabase Edge Functions or database migrations have reached the live backend.

Backend releases therefore need runtime/deployment verification in addition to source-control status.

## Repository lineage

`apply-wingman` is the canonical maintained repository for this project family.

The older `JobAutoPilot` repository is retained only as historical lineage; its reachable current history no longer contains the active application source.

## Engineering principle

**Automate repeatable work; escalate ambiguity; never manufacture completion.**
