# Apply Wingman browser worker

External Playwright worker that completes **public** ATS application forms that
Supabase Edge Functions cannot (Edge Functions have no browser).

It talks only to the `browser-queue` edge function — it never holds a
service-role key and never touches the database directly.

## Safety rules (enforced in code, not just documented)

- CAPTCHA, Cloudflare/anti-bot interstitials, MFA prompts and sign-in walls →
  stop and report `manual_action_required`. Nothing is ever bypassed or solved.
- A required question with no stored answer → stop. No value is ever invented.
- Legal / privacy / EEO / consent checkboxes → ticked **only** when the user has
  stored an explicit consent for that declaration (`application_answers.consent`).
- Salary expectations and screening questions needing judgement → always manual.
- `submitted` is reported **only** when a real confirmation state was observed
  (success text or a confirmation URL); proof travels with the report.
- LinkedIn is not attempted at all — authenticated session + ToS.
- All logs run through `redact.ts`: emails, phone numbers and tokens are masked.

## Run locally

```bash
cd worker
npm install
npx playwright install --with-deps chromium
SUPABASE_FUNCTIONS_URL="https://<project-ref>.functions.supabase.co" \
BROWSER_WORKER_TOKEN="<token>" \
WORKER_ID="local-1" \
npm start
```

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `SUPABASE_FUNCTIONS_URL` | yes | Base URL of the project's edge functions |
| `BROWSER_WORKER_TOKEN` | yes | Shared secret; must match the backend secret of the same name |
| `WORKER_ID` | no | Identifies the worker in leases and logs |
| `WORKER_BATCH_SIZE` | no | Items per run (default 3, max 10) |
| `WORKER_LEASE_SECONDS` | no | Lease length (default 900) |
| `WORKER_ITEM_TIMEOUT_MS` | no | Per-application timeout (default 180000) |

## Hosting

`.github/workflows/browser-worker.yml` runs it on a schedule with a batch cap and
a single-concurrency group — fine for low volume. Sustained throughput or any
flow needing a persistent authenticated session needs a long-lived host instead.
