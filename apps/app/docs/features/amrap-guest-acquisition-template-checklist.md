# AMRAP guest acquisition template checklist

Use this rollout checklist for interval apps that want the same "work out first, save after account" flow.

## 1) Identify post-session entry points

- List every place a guest can finish a workout or view results/history.
- Confirm both modal and inline/strip actions are included.

## 2) Gate save/sync intents for guests

- Intercept dismiss/close, "View in History", and "View results" for guests.
- Show `Sign in`, `Sign up`, and `Not now`.
- Keep signed-in behavior unchanged.

## 3) Standardize auth chrome

- Use header labels `Sign in` and `Sign up`.
- Reuse shared `AuthModal` with consistent app source metadata.

## 4) Redirect to minimal onboarding

- On auth success, route users to `/account/onboarding/minimal`.
- Collect only baseline + ranked `fitness_goal_ranking`.
- Redirect to app-specific return URL when complete.
- Preserve nested `returnUrl` for both password auth and OAuth.

## 5) Persist canonical goal ids only

- Convert display labels to canonical ids through `onboarding-fitness-goal-map`.
- Never write free-form goal strings to profile persistence.

## 6) Add analytics hooks for reverse trial analysis

- Track prompt shown (`guest_save_prompt_shown`).
- Track signup intent (`guest_save_prompt_signup`).
- Track onboarding completion (`minimal_onboarding_complete`).
- Track guest claim result (`guest_amrap_claim_succeeded`, `guest_amrap_claim_failed`).

## 7) Add secure guest claim persistence

- Return a one-time claim token for guest joins and store only a token hash in DB.
- Pass `(guest_session, guest_participant, guest_claim)` to onboarding via auth `returnUrl`.
- After auth and baseline/goal saves, call `claim_amrap_guest_session` to persist:
  - `shared.amrap_session_results`
  - `workout_logs` with `source='amrap_with_friends'`, `handoff_dedupe_key`, and `goal_snapshot`
- Invalidate the claim token after successful claim (single use).

## 8) Verify end-to-end manually before rollout

- Guest joins session, completes workout, then signs up.
- Onboarding completes and redirects back to account HUD.
- Confirm AMRAP result appears in history and training log.
- Confirm no duplicate rows on refresh/retry (dedupe key + upsert behavior).
