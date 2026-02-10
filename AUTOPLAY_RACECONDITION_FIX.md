# Autoplay Race Condition Fix

## Problem

When the user confirms autoplay and immediately spams the spin button to stop it, there is a brief window where all disabled slot controller buttons get re-enabled even though the symbols have just started dropping (or the first spin is still being initiated).

## Root Cause

- **Manual spins**: The spin button’s `pointerdown` handler sets `isProcessingSpin = true` *before* calling `handleSpin()`, so `stopAutoplay()` correctly keeps controls disabled while a spin is in progress.
- **Autoplay spins**: The first (and subsequent) autoplay spin is triggered from `performAutoplaySpin()` → `handleSpin()` **without** going through the spin button. So `isProcessingSpin` was never set at the start of that path.
- If the user clicks “stop” (spin button) while `handleSpin()` is already running (e.g. waiting on the API or before reels start), `isReelSpinning` and `isProcessingSpin` can both still be `false`. `stopAutoplay()` then re-enables all controls. The spin continues (symbols drop) with buttons incorrectly enabled.

## Solution

Set `isProcessingSpin = true` at the **start** of `handleSpin()` (right after the GameAPI check), so that:

- Every spin is marked as “in progress” as soon as `handleSpin()` runs, whether started from the spin button or from autoplay.
- When the user stops autoplay during that window, `stopAutoplay()` sees `isProcessingSpin === true` and keeps slot controller buttons disabled until the current spin finishes (REELS_STOP / WIN_STOP re-enable as usual).

## Code Change

In **SlotController.ts**, inside `handleSpin()`:

1. Keep the existing early return when `!this.gameAPI` (and its `isProcessingSpin = false`).
2. Immediately after that block, add:

```ts
// Mark spin as in progress immediately (covers autoplay path where spin button handler doesn't run).
// Prevents stopAutoplay() from re-enabling buttons when user stops autoplay right after confirm
// while the first spin is still starting (handleSpin in flight, reels not yet dropping).
(gameStateManager as any).isProcessingSpin = true;
```

3. All existing early returns and error paths in `handleSpin()` that clear spin state already set `isProcessingSpin = false` where needed, so no extra clearing is required for this change.

## Where Applied

- **felice_in_space**: [SlotController.ts](src/game/components/SlotController.ts) – `handleSpin()` (after GameAPI check).
- **sugar_wonderland**: [SlotController.ts](../sugar_wonderland/src/game/components/SlotController.ts) – same change in `handleSpin()`.
- **zero_law**: [SlotController.ts](../zero_law/src/game/components/SlotController.ts) – same change in `handleSpin()`. Zero_law’s [GameStateManager](../zero_law/src/managers/GameStateManager.ts) was also extended with `isProcessingSpin` (getter, setter, reset, getState); it is cleared when `isReelSpinning` is set to false. The AUTO_STOP handler and `stopAutoplay()` were updated to keep controls disabled when `isProcessingSpin` (or other “spin still active”) flags are true.

## Related Logic

- `stopAutoplay()` keeps controls disabled when `gameStateManager.isReelSpinning` **or** `(gameStateManager as any).isProcessingSpin` (or related flags) is true.
- The AUTO_STOP handler in SlotController also uses the same “spin still active” checks before re-enabling; this fix ensures the in-progress state is set as soon as a spin is initiated, so both `stopAutoplay()` and AUTO_STOP see a consistent state.
