# apply-wingman

Job-application automation app: React + Vite frontend, Supabase backend with
Deno edge functions (`supabase/functions/`). Built and managed through
Lovable; the Supabase project is Lovable Cloud–managed
(project ref `jlsoiujwcjgmvijcmvas`).

## Critical: how the backend actually deploys

Merging to `main` on GitHub does **not** deploy anything to the Supabase
backend. The GitHub↔Lovable sync covers source code and the frontend build
only. Edge functions and SQL migrations (`supabase/migrations/`) only reach
production when one of these happens:

1. **Through Lovable** — prompt the Lovable agent, e.g.
   "Redeploy all edge functions and apply pending database migrations."
2. **Via the `Deploy Supabase backend` GitHub Action** — it only activates if
   the `SUPABASE_ACCESS_TOKEN` / `SUPABASE_DB_PASSWORD` repo secrets are set
   (Lovable Cloud may not expose these; without them it skips with a notice).

Skipping this step causes silent staleness. On 2026-07-08 the deployed
`discover-jobs` turned out to be running code from before three merged PRs,
and a July 1 migration (`jobs.recruiter_email`) had never been applied,
crashing `rescue-stalled-applications` on every 10-minute cron run for a
week. Verify deploys against runtime behaviour (edge function logs in
Lovable Cloud), not the Lovable "up to date" indicator — that indicator only
reflects the code sync.

## Notes for Claude sessions

- The Supabase MCP connector is scoped to the user's personal Supabase org
  and **cannot see this Lovable Cloud project** — reads, deploys, and SQL
  against `jlsoiujwcjgmvijcmvas` fail with permission errors. Production
  schema/data fixes must ship as migration files (applied via Lovable), or
  be performed by the Lovable agent directly.
- Outbound HTTPS to `*.supabase.co` may be blocked by the sandbox proxy, so
  the live endpoints can't be probed from a session either.
