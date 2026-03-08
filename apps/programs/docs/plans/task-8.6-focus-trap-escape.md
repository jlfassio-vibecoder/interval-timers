# Task 8.6: Focus trap and Escape (a11y)

## Goal

- **Focus trap:** When the modal is open, focus the first focusable element (e.g. the close button) and keep Tab/Shift+Tab inside the modal (loop from last to first and vice versa).
- **Escape:** When the user presses Escape, call `onClose()` so the modal closes from keyboard.
- Ensures keyboard-only users can open, navigate, and close the modal without focus leaving the modal.

## Current state

- **Escape:** AppIslands already has a global `keydown` listener that calls `setSelectedArtist(null)` when Escape is pressed. WorkoutDetailModal is also used from ActiveProgramView and ProgramSalesView, which may not have the same global handler. Adding Escape inside the modal makes it self-contained and works from any parent.
- **Focus:** No focus management today. When the modal opens, focus can remain on the trigger or elsewhere; Tab can move focus to elements behind the backdrop.
- **Structure:** The modal renders a backdrop `motion.div` and an inner content `motion.div` (the card). Focusable elements include: close (X) button, optional "Start workout" button, "Log Session Data" button, "Abort View" button, and each ExerciseCard (rendered as `<button>`).

## Implementation

### 1. Ref and focusable selector

- Add a **ref** to the modal content container. The right node is the **inner** `motion.div` (the card with `rounded-[3rem]` and `max-w-7xl`), which wraps all focusable content.
- Use a standard focusable selector, e.g.  
  `'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'`  
  and filter to elements that are visible if needed.

### 2. Focus on open

- In a **useEffect** that runs when `workout` is truthy: after a short delay (e.g. `requestAnimationFrame` twice or `setTimeout(..., 100)`), query the first focusable element inside the container ref and call `.focus()`. The **close (X) button** is the first focusable in DOM order and is a good initial focus target.

### 3. Tab trap (loop focus)

- In the same or a separate **useEffect** when the modal is open: add a `keydown` listener (on `document` or the container). When `e.key === 'Tab'`:
  - Query the list of focusable elements inside the container ref.
  - If **Tab (no Shift)** and the currently focused element is the **last** focusable, call `e.preventDefault()` and focus the **first** focusable.
  - If **Shift+Tab** and the currently focused element is the **first** focusable, call `e.preventDefault()` and focus the **last** focusable.
- Remove the listener on cleanup when the modal closes.

### 4. Escape key

- In a **useEffect** when the modal is open: add a `keydown` listener. When `e.key === 'Escape'`, call `onClose()`. Optionally call `e.stopPropagation()`. Clean up the listener when the modal is closed.

### 5. Accessibility attributes

- Add **role="dialog"** and **aria-modal="true"** to the modal content container (the inner `motion.div` that has the trap).
- Optionally add **aria-label** or **aria-labelledby** (e.g. pointing to the workout name heading) for an accessible name.

### 6. Return focus (optional)

- Not required for 8.6. If desired later: when opening, store `document.activeElement` in a ref; when closing, restore focus to that element.

## Files to change

- **src/components/react/WorkoutDetailModal.tsx:** Add `useRef` for the modal content container, add `useEffect`(s) for focus-on-open, Tab trap, and Escape; add `role="dialog"` and `aria-modal="true"` (and optional `aria-label` / `aria-labelledby`). No new dependencies.

## Edge cases

- **No focusable elements:** If the query returns no nodes, focus-on-open and Tab trap do nothing; Escape still closes.
- **AnimatePresence:** Run focus logic after a brief delay so the DOM is painted (e.g. 100ms).
- **Multiple modals:** If another modal opens on top (e.g. ExerciseDetailModal), focus will move there; this task does not change that.

## Verification

- `npm run verify:quick` (lint and type-check).
- Manual: Open the workout modal with keyboard. Confirm focus moves to the close button. Tab through and confirm focus loops (last → first with Tab, first → last with Shift+Tab). Press Escape and confirm the modal closes. Repeat when opened from ProgramSalesView or ActiveProgramView to ensure Escape still closes.
