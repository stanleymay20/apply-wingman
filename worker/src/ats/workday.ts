// Workday adapter. Workday almost always requires an account (create/sign in)
// before an application can be submitted, so the worker only proceeds when it
// lands directly on an anonymous apply form; otherwise it hands back to the user.
import { detectBlockers } from "../guards.js";
import type { AttemptResult } from "../types.js";
import { applyGeneric } from "./generic.js";
import type { FillContext } from "./common.js";

export async function applyWorkday(ctx: FillContext): Promise<AttemptResult> {
  const { page } = ctx;

  const blocker = await detectBlockers(page);
  if (blocker) return { outcome: "manual_action_required", manualReason: blocker.reason, detail: blocker.detail };

  const needsAccount =
    (await page.locator("button:has-text('Create Account'), a:has-text('Create Account')").count()) > 0 ||
    (await page.locator("button:has-text('Sign In'), a:has-text('Sign In')").count()) > 0;

  if (needsAccount) {
    return {
      outcome: "manual_action_required",
      manualReason: "login_required",
      detail: "Workday requires a candidate account before applying",
    };
  }

  return applyGeneric(ctx);
}
