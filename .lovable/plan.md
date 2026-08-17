# ATS form automation via a queued Playwright worker

## What exists today (verified)

- Email applications go out through Resend in `supabase/functions/auto-apply/index.ts` and return a real `deliveryStatus: "delivered"` with the provider message id.
- Greenhouse / Lever / Workday / LinkedIn paths return `manual_action_required` — nothing submits a form.
- `applications` already carries the lifecycle fields a worker needs: `status`, `application_method`, `delivery_provider`, `delivery_provider_message_id`, `delivery_verified_at`, `idempotency_key`, `correlation_id`, `retry_count` / `max_retries` / `next_retry_at`, `error_code` / `error_message`, `custom_responses`, `tailored_cv_pdf_url`, `cover_letter`.
- There is **no** browser queue table, no `browser-queue` function, no `_shared/applyRouting.ts` in the repo at commit `3625a76`/`d9fcfac`.
- `.github/workflows/deploy-supabase.yml` exists and self-skips without credentials.
- `.env` is tracked by git and `.gitignore` does not list it — a real secret-hygiene problem.

## Approach

Supabase Edge Functions cannot run Chromium, so the browser lives outside: a queue table in the database, a service-role HTTP contract for claim/heartbeat/report, and an external Playwright worker that only ever submits public ATS forms with data the user already stored.

```text
scheduled-automation / auto-apply
        │  route: email? -> Resend (unchanged)
        │  else -> enqueue
        ▼
browser_application_queue  (lease, attempts, status)
        ▲ claim / heartbeat / report (service-role token)
        │
external Playwright worker (self-hosted or GH Actions)
```

### Safety rules encoded in the worker, not just documented

- CAPTCHA / anti-bot / login wall / MFA detected -> stop, report `manual_action_required` with a reason code. No solving, no third-party solver.
- Any required field with no stored answer -> stop, `manual_action_required`. Never guess, never infer, never leave a fabricated value.
- Legal / privacy / EEO / sponsorship / consent checkboxes -> only ticked when an explicit stored user answer exists for that exact question type; otherwise manual.
- `delivered` only after a positive submission signal is observed (confirmation URL, ATS success text, or application-id in response) **and** a screenshot/HTML proof blob is attached. Anything ambiguous is `manual_action_required`.
- Logs redact email, phone, address, CV text, cookies and tokens; screenshots are stored in a private bucket, never inlined in logs.

## File-by-file work

**Database**
- `supabase/migrations/<ts>_browser_application_queue.sql` — new `public.browser_application_queue` (user_id, application_id UNIQUE, job_id, target_url, platform, ats_type, tailored_cv_url, cover_letter, candidate_payload jsonb, status check `queued|claimed|submitted|manual_action_required|failed|cancelled`, attempts, max_attempts, priority, claimed_by, claimed_at, lease_expires_at, last_error, manual_reason, result jsonb, proof jsonb, run_id, correlation_id, timestamps). GRANTs for `authenticated` (select own) and `service_role` (all), RLS on, owner-read policy. Plus `claim_browser_applications(worker_id text, batch int, lease_seconds int)` security-definer RPC doing `FOR UPDATE SKIP LOCKED` so two workers never claim the same row.
- `supabase/migrations/<ts>_application_answers.sql` — `public.application_answers` for user-stored reusable answers and explicit consents (question_key, answer, consent boolean, updated_at) so the worker can fill legal/EEO fields only from real user input.
- Private storage bucket `application-proofs` for screenshots.

**Edge functions**
- `supabase/functions/_shared/browserQueue.ts` — ATS detection + `enqueueBrowserApplication()` (idempotent on `application_id`).
- `supabase/functions/_shared/applyRouting.ts` — single `resolveApplyRoute()`: email only when a validated recruiter address exists, otherwise browser queue, otherwise manual. Honours company cooldown and daily cap before enqueueing.
- `supabase/functions/browser-queue/index.ts` — actions `claim`, `heartbeat`, `report`; authenticates on a `BROWSER_WORKER_TOKEN` secret; validates bodies with Zod; `report` is idempotent per `(application_id, attempt)` and is the only place that may set `delivered` + `delivery_verified_at` + proof.
- `supabase/functions/auto-apply/index.ts` — replace the "opened the form = done" branch with enqueue; keep the Resend path untouched.
- `supabase/functions/scheduled-automation/index.ts` — route via `resolveApplyRoute`, count queued as *attempted*, not submitted.
- `supabase/functions/drain-pending-applications/index.ts`, `process-retries/index.ts` — requeue expired leases, respect `max_attempts` and existing backoff.

**Worker (new top-level `worker/`, not deployed by Lovable)**
- `worker/package.json`, `worker/src/index.ts` (claim loop, lease heartbeat, bounded batch), `worker/src/ats/{greenhouse,lever,workday,generic}.ts` (per-ATS field mapping), `worker/src/guards.ts` (CAPTCHA/login/unknown-question detection), `worker/src/redact.ts`, `worker/README.md`.
- `.github/workflows/browser-worker.yml` — scheduled + manual run, small batch cap, concurrency group of 1. **LinkedIn is excluded**: it requires an authenticated session and its ToS forbid automated applying; those stay `manual_action_required`.

**Frontend**
- `src/components/common/StatusBadge.tsx` — distinct labels for queued / preparing / submitted / delivered (verified) / manual action needed / retrying / failed.
- `src/pages/Applications.tsx` — show queue state, manual reason, and a link to proof when present.
- New `src/components/profile/ApplicationAnswers.tsx` + hook — where the user stores reusable answers and explicit consents.

**Secret hygiene (do first, separately)**
- Add `.env` to `.gitignore`, `git rm --cached .env`, commit. Because the repo is public and the file is in history, every key it contains must be treated as leaked and rotated at the provider (Resend, Firecrawl, Groq/Google, Supabase anon is publishable so it is fine). History scrubbing (`git filter-repo`) is optional but the rotation is not. No secret values will be printed anywhere in this work.

## Blockers needing your action

1. `BROWSER_WORKER_TOKEN` — I generate it and set it as a backend secret; you add the same value as a GitHub Actions secret.
2. `SUPABASE_URL` + service-role access for the worker: the worker calls only the `browser-queue` function with the worker token, so no service-role key leaves the backend — but the function URL must be a repo variable.
3. GitHub Actions runners as a worker host is fine for low volume; sustained/authenticated flows need a persistent host. Confirm which you want.
4. Rotation of the leaked `.env` credentials is yours to do at each provider.

## Explicitly not claimed

Nothing submits an ATS form until the worker in `worker/` is actually running somewhere. Until then every form job stays `queued` or `manual_action_required` — the app will not report them as applied.
