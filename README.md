# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## ATS browser automation

Email applications are handled by the Supabase `auto-apply` function. Public Greenhouse and Lever applications that cannot be verified server-side are queued for a Playwright worker instead of being falsely marked as submitted.

The browser worker is intentionally conservative:

- it never bypasses CAPTCHA or anti-bot challenges;
- it never invents answers to required screening questions;
- it does not automatically accept legal, privacy, EEO, or consent declarations;
- it only marks an application `delivered` after detecting a reliable success page or confirmation message;
- otherwise it leaves the application as `manual_action_required` so the applicant can finish it safely.

The queue is created by `supabase/migrations/20260817095200_browser_application_tasks.sql`. The worker is `scripts/ats-browser-worker.mjs`, scheduled by `.github/workflows/ats-browser-worker.yml` every 15 minutes after the change is merged to the default branch.

To enable the scheduled worker, configure this GitHub Actions repository secret:

- `SUPABASE_SERVICE_ROLE_KEY` — required; never expose this in frontend code or commit it to the repository.

`SUPABASE_URL` is optional because the workflow currently defaults to this project's public Supabase URL. Set it as a repository secret if the backend moves to another Supabase project.

Local frontend configuration belongs in `.env`; copy `.env.example` and fill only the public Vite values. `.env` and `.env.*` are ignored by Git.

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
