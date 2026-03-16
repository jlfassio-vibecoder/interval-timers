# Post-Workout Recap Modal — SWOT Analysis

The **PostWorkoutRecapModal** appears once when an AMRAP With Friends workout finishes. It shows a summary (rounds, duration), optional “Continue on phone” QR (heartPulse/recovery PWA), and actions: **Done**, **View in History**, **Copy results**. This doc analyzes the modal with focus on the actions and why there is no “View Results” in the modal.

---

## What the modal is

- **Component:** `apps/amrap/src/components/PostWorkoutRecapModal.tsx`
- **When it opens:** `result.timerPhase === 'finished' && !recapDismissed` (AmrapSessionPage).
- **Content:** “Workout complete!”, rounds/duration copy, optional QR + “Copy link” for recovery PWA, then three buttons: Done, View in History, Copy results.

---

## Actions: what actually happens

### 1. **Done**

- **Handler:** `handleDone()` in PostWorkoutRecapModal.
- **Behavior:** `onClose()` then `navigate('/with-friends')`.
- **Effect:** Closes the recap and leaves the session screen to the “With Friends” lobby. Same outcome as closing the modal and tapping “Done” on the in-page finished state.

### 2. **View in History**

- **Handler:** `handleViewInHistory()` in PostWorkoutRecapModal.
- **Behavior:** `onClose()` then `window.open(HUD_REDIRECT_URL, '_blank', 'noopener,noreferrer')`.
- **URL used:** `HUD_REDIRECT_URL` from `apps/amrap/src/lib/account-redirect-url.ts`:
  - Resolves to `VITE_HUD_REDIRECT_URL` unless that value is wrong (e.g. contains `?hud=1`).
  - Fallback: dev → `http://localhost:3006/account`, prod → `/account`.
- **Effect:** Recap closes; a **new tab** opens the **account page** (e.g. `/account` or `localhost:3006/account`), not a dedicated “workout history” or “this workout’s results” view. The label “View in History” is aspirational: it sends users to the account/hub, where they may find history or HUD depending on app structure.

**Implication:** “View in History” does not show this workout’s results in-app; it changes context to the account site in another tab.

### 3. **Copy results**

- **Handler:** `handleCopyResults()` → `onCopyResults()`. In AmrapSessionPage, `onCopyResults` is `pageState.copyResults`.
- **Behavior (in useSocialAmrap):** `copyResults` builds text with `getResultsText({ forCopy: true })` (workout list, round count, duration, session URL, round splits; compact format if many rounds) and writes it to the clipboard via `navigator.clipboard.writeText(text)`. Sets a toast (e.g. “Copied to clipboard!” / “Failed to copy”).
- **Effect:** The same summary that could be shown in “View Results” is **only** copied to the clipboard. The modal does not display that text; the user has to paste elsewhere to “view” it.

**Implication:** “Copy results” is the only way from the recap modal to get the results text; there is no in-app “view” of that text from the modal.

---

## Why there isn’t a “View Results” in the modal

- **ViewResultsModal** exists and is used elsewhere: it shows `resultsText` (same content as copy), optional round-duration chart, and a “Copy results” button. It is opened from the **in-page** finished state (useSocialAmrap’s `finishedActionsSlot`) via **“View results”** → `handleOpenViewResults()`.
- **PostWorkoutRecapModal** was never wired to that flow:
  - Its props are: `isOpen`, `onClose`, `myRounds`, `durationMinutes`, `onCopyResults`, `recoveryUrl`.
  - There is no prop such as `onViewResults` or `onOpenViewResults`.
  - AmrapSessionPage does not pass `pageState.handleOpenViewResults` (or equivalent) into the recap modal.
- So:
  - **Design/implementation gap:** The recap modal was built with only Done, View in History, and Copy results. “View Results” was added to the in-page finished UI (same hook, different slot) but not to the recap modal.
  - **Result:** Users who act only from the recap modal can copy results but cannot see the results in-app. Users who dismiss the recap and use the page see “View results” and can open ViewResultsModal.

---

## SWOT summary

| Dimension | Assessment |
|-----------|------------|
| **Strengths** | Clear “Workout complete!” moment; Done and Copy results work; QR + recovery link support heartPulse flow; Escape/backdrop close; accessible dialog. |
| **Weaknesses** | “View in History” goes to account, not a dedicated history/results view; no “View Results” in the modal, so no in-app view of the same text that “Copy results” copies; recap and in-page finished state offer different actions (recap lacks View results). |
| **Opportunities** | Add “View Results” to the recap modal (e.g. pass `onViewResults={pageState.handleOpenViewResults}` and a button) so behavior matches the in-page finished state; consider renaming or clarifying “View in History” (e.g. “Open Account” or “View in Account”) or linking to a real history/results URL if one exists. |
| **Threats** | Users who expect “View in History” to show this workout may be confused when they land on a generic account page; users who want to see results before copying may not discover that they must dismiss the modal and use the page, or paste after copy. |

---

## Recommendations

1. **Add “View Results” to the recap modal**  
   - Add an optional prop, e.g. `onViewResults?: () => void`.  
   - In AmrapSessionPage, pass `onViewResults={pageState.handleOpenViewResults}`.  
   - In PostWorkoutRecapModal, add a “View results” button that calls `onViewResults` (and optionally `onClose()` so the recap closes and ViewResultsModal opens).  
   - This aligns the modal with the in-page finished state and gives a single, consistent way to view the same text that “Copy results” uses.

2. **Clarify “View in History”**  
   - Either rename to match behavior (e.g. “Open Account” / “View in Account”) or, if the app has a dedicated workout/history view, point `HUD_REDIRECT_URL` (or a separate URL) to that view and keep the “View in History” label.

3. **Optional: “Copy results” feedback in the modal**  
   - The toast for copy is driven by `pageState.copyResultsToast`, but the recap modal does not receive or show it. Consider passing `copyResultsToast` into the recap modal and showing “Copied!” / “Failed to copy” there so feedback is visible without dismissing the modal.
