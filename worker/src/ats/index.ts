import type { AttemptResult } from "../types.js";
import type { FillContext } from "./common.js";
import { applyGeneric } from "./generic.js";
import { applyWorkday } from "./workday.js";

/**
 * ATS platforms the worker is allowed to attempt.
 * LinkedIn is deliberately absent: Easy Apply requires an authenticated
 * session and automated applying breaches LinkedIn's terms, so those items
 * always come back as manual action.
 */
export const SUPPORTED_ATS = [
  "greenhouse",
  "lever",
  "ashby",
  "workable",
  "recruitee",
  "personio",
  "smartrecruiters",
  "workday",
] as const;

const BLOCKED_ATS: Record<string, string> = {
  linkedin: "LinkedIn requires an authenticated session and forbids automated applying",
};

export function routeAts(atsType: string | null): {
  supported: boolean;
  reason?: string;
  run?: (ctx: FillContext) => Promise<AttemptResult>;
} {
  const ats = (atsType ?? "").toLowerCase();

  if (BLOCKED_ATS[ats]) return { supported: false, reason: BLOCKED_ATS[ats] };
  if (ats === "workday") return { supported: true, run: applyWorkday };
  if (!ats || (SUPPORTED_ATS as readonly string[]).includes(ats)) {
    return { supported: true, run: applyGeneric };
  }
  return { supported: false, reason: `Unsupported ATS: ${ats}` };
}
