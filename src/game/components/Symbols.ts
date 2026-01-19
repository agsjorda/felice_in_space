import { Data } from "../../tmp_backend/Data";
import { GameObjects } from 'phaser';
import { Game } from "../scenes/Game";
import { GameData, setSpeed, pauseAutoplayForWinlines, resumeAutoplayAfterWinlines } from "./GameData";
import { ScatterAnimationManager } from "../../managers/ScatterAnimationManager";
import { SymbolDetector, Grid, Wins } from "../../tmp_backend/SymbolDetector";
import { gameEventManager, GameEventType } from '../../event/EventManager';
import { gameStateManager } from '../../managers/GameStateManager';
import { TurboConfig } from '../../config/TurboConfig';
import { SLOT_ROWS, SLOT_COLUMNS, DELAY_BETWEEN_SPINS, MULTIPLIER_SYMBOLS } from '../../config/GameConfig';
import { SoundEffectType } from '../../managers/AudioManager';
import { ensureSpineFactory } from '../../utils/SpineGuard';

export class Symbols {
  private static readonly WINLINE_CHECKING_DISABLED: boolean = true;
  
  public static FILLER_COUNT: number = 20;
  public reelCount: number = 0;
  public scene: Game;
  public container: Phaser.GameObjects.Container;
  public displayWidth: number;
  public displayHeight: number;
  public horizontalSpacing: number;
  public verticalSpacing: number;
  public symbols: any[][]; // Changed to any to support both Sprite and Spine objects
  public newSymbols: any[][]; // Changed to any to support both Sprite and Spine objects
  public slotX: number;
  public slotY: number;
  public totalGridWidth: number;
  public totalGridHeight: number;
  public scatterAnimationManager: ScatterAnimationManager;
  public symbolDetector: SymbolDetector;
  public winLineDrawer: any | null;
  private overlayRect?: Phaser.GameObjects.Graphics;
  public currentSpinData: any = null; // Store current spin data for access by other components
  private overlayContainer: Phaser.GameObjects.Container | null = null;

  // --- Idle "float" motion (weightless) ---
  // We don't always have usable Spine idle animations for symbols; this tween-based motion
  // gives a subtle, consistent idle feel for both PNG sprites and Spine objects.
  private idleFloatEnabled: boolean = true;
  private idleFloatAmplitudePx: number = 6;          // base bob amount in pixels
  private idleFloatDurationMs: number = 1600;        // base bob duration
  private idleFloatDurationJitterMs: number = 500;   // per-symbol random variance
  private idleFloatRotationRad: number = 0.015;      // tiny sway (radians). Set 0 to disable

  // Track whether any wins occurred during the current spin item (including all tumbles)
  private hadWinsInCurrentItem: boolean = false;
  
  // Track multiplier animation completion promise for last spin
  private multiplierAnimationsPromise: Promise<void> | null = null;
  
  // Track if multiplier animations are currently in progress
  private multiplierAnimationsInProgress: boolean = false;

 

  // Configuration for Spine symbol scales - adjust these values manually
  private spineSymbolScales: { [key: number]: number } = {
    0:  1.2,   // Symbol0_KA (scatter) scale
    1:  0.30,  // Symbol1_KA scale
    2:  0.33,  // Symbol2_KA scale (increased by 10% from 0.041)
    3:  0.33,  // Symbol3_KA scale (increased by 10% from 0.041)
    4:  0.31,  // Symbol4_KA scale
    5:  0.30,  // Symbol5_KA scale
    6:  0.30,  // Symbol6_KA scale
    7:  0.30,  // Symbol7_KA scale
    8:  0.30,  // Symbol8_KA scale
    9:  0.30,  // Symbol9_KA scale
    10: 0.5,  // Symbol10_KA scale (increased by 30%)
    11: 0.5,  // Symbol11_KA scale (increased by 30%)
    12: 0.8,  // Symbol12_KA (wildcard x2) scale (increased by 30%)
    13: 0.122,  // Symbol13_KA (wildcard x3) scale
    14: 0.122  // Symbol14_KA (wildcard x4) scale
  };

  // Store current symbol data for reset purposes
  public currentSymbolData: number[][] | null = null;
  
  // Store free spins data for autoplay
  private pendingFreeSpinsData: { scatterIndex: number; actualFreeSpins: number } | null = null;
  
  // Free spin autoplay state
  public freeSpinAutoplayActive: boolean = false;
  private freeSpinAutoplaySpinsRemaining: number = 0;
  private freeSpinAutoplayTimer: Phaser.Time.TimerEvent | null = null;
  private freeSpinAutoplayWaitingForReelsStop: boolean = false;
  private freeSpinAutoplayWaitingForWinlines: boolean = false;
  private freeSpinAutoplayTriggered: boolean = false;
  private freeSpinAutoplayAwaitingReelsStart: boolean = false;
  // Pending retrigger sequence info to run after WIN_STOP in bonus
  private pendingScatterRetrigger: { scatterGrids: Array<{ x: number; y: number }> } | null = null;
  // Track if scatter retrigger animation is in progress
  private scatterRetriggerAnimationInProgress: boolean = false;

  // --- Live "scatter symbols on screen" counter ---
  // This is updated:
  // - incrementally as symbols finish dropping (main drop + tumble drops)
  // - decrementally when scatter symbols are removed during tumbles
  // - recalculated from the live grid at safe checkpoints to prevent drift
  private scatterOnScreenCount: number = 0;
  
  /**
   * Mark a scatter retrigger to run after WIN_STOP during bonus mode.
   */
  public setPendingScatterRetrigger(scatterGrids: Array<{ x: number; y: number }>): void {
    this.pendingScatterRetrigger = { scatterGrids };
    // IMPORTANT: A retrigger means bonus is NOT finished, even if some other
    // system (e.g. SlotController REELS_STOP) tentatively flagged it.
    // Clear the isBonusFinished flag here to prevent premature congrats/end-of-bonus
    // flows while the retrigger dialog is pending.
    try {
      if (gameStateManager.isBonusFinished) {
        console.log('[Symbols] Retrigger scheduled - clearing isBonusFinished flag to avoid premature congrats');
      }
      gameStateManager.isBonusFinished = false;
    } catch {}
  }
  
  /**
   * Check if there's a pending scatter retrigger that will add more free spins
   */
  public hasPendingScatterRetrigger(): boolean {
    return !!(this.pendingScatterRetrigger && Array.isArray(this.pendingScatterRetrigger.scatterGrids) && this.pendingScatterRetrigger.scatterGrids.length > 0);
  }
  
  /**
   * Synchronize the internal free spin autoplay counter with server-reported spinsLeft.
   * Use this when a retrigger occurs during bonus so our loop continues correctly.
   */
  public setFreeSpinAutoplaySpinsRemaining(spinsRemaining: number): void {
    const normalized = Math.max(0, Number(spinsRemaining) || 0);
    this.freeSpinAutoplaySpinsRemaining = normalized;
    console.log(`[Symbols] Synced free spin autoplay counter to server spinsLeft: ${normalized}`);
  }
  private dialogListenerSetup: boolean = false;

  constructor() { 
    this.scatterAnimationManager = ScatterAnimationManager.getInstance();
    this.symbolDetector = new SymbolDetector();
  }

  /**
   * Scatter (and some win) animations scale/move symbols beyond the grid bounds.
   * If the symbol is still parented to the masked grid container, it will be clipped.
   * This helper detaches the object from the masked container and clears any direct mask.
   */
  private liftOutOfGridMask(obj: any): void {
    try {
      if (!obj || (obj as any).destroyed) return;
      // If the grid mask is applied to the container, anything inside will be clipped.
      if ((obj as any).parentContainer === this.container) {
        try { this.container.remove(obj); } catch {}
        try {
          const childrenAny: any = this.scene?.children as any;
          if (childrenAny && typeof childrenAny.exists === 'function') {
            if (!childrenAny.exists(obj)) {
              this.scene.add.existing(obj);
            }
          } else {
            this.scene.add.existing(obj);
          }
        } catch {}
      }
      // Clear any mask directly applied on the object itself.
      try { if (typeof (obj as any).setMask === 'function') (obj as any).setMask(null); } catch {}
      try { if (typeof (obj as any).clearMask === 'function') (obj as any).clearMask(true); } catch {}
    } catch {}
  }

  private isScatterSymbolObject(obj: any): boolean {
    try {
      const v = (obj as any)?.symbolValue;
      if (v === 0) return true;
      if ((obj as any)?.texture?.key === 'symbol_0') return true;
    } catch {}
    return false;
  }

  private emitScatterOnScreenCountChanged(reason?: string): void {
    try {
      gameEventManager.emit(GameEventType.SCATTER_ON_SCREEN_COUNT_CHANGED, { count: this.scatterOnScreenCount, reason } as any);
    } catch {}
  }

  public getScatterOnScreenCount(): number {
    return Number(this.scatterOnScreenCount || 0);
  }

  public resetScatterOnScreenCount(reason: string = 'reset'): void {
    this.scatterOnScreenCount = 0;
    this.emitScatterOnScreenCountChanged(reason);
  }

  public recalcScatterOnScreenCountFromGrid(reason: string = 'recalc'): number {
    let count = 0;
    try {
      if (this.symbols && this.symbols.length > 0) {
        for (let col = 0; col < this.symbols.length; col++) {
          const column = this.symbols[col];
          if (!Array.isArray(column)) continue;
          for (let row = 0; row < column.length; row++) {
            const obj = column[row];
            if (!obj) continue;
            if (this.isScatterSymbolObject(obj)) count++;
          }
        }
      }
    } catch {}
    const next = Math.max(0, count);
    const changed = next !== this.scatterOnScreenCount;
    this.scatterOnScreenCount = next;
    if (changed) this.emitScatterOnScreenCountChanged(reason);
    return this.scatterOnScreenCount;
  }

  /**
   * Call when a symbol finishes its drop animation (main spin drop or tumble drop).
   */
  public handleSymbolDropCompleteForScatterCounter(symbolObj: any, reason: string = 'drop_complete'): void {
    try {
      if (!symbolObj) return;
      // Guard: don't double-count the same object if callbacks fire twice.
      if ((symbolObj as any).__scatterCountDropAccounted) return;
      (symbolObj as any).__scatterCountDropAccounted = true;

      if (!this.isScatterSymbolObject(symbolObj)) return;
      const before = Math.max(0, Number(this.scatterOnScreenCount || 0));
      const after = Math.max(0, before + 1);
      this.scatterOnScreenCount = after;
      this.emitScatterOnScreenCountChanged(reason);
    } catch {}
  }

  /**
   * Call when a symbol is actually removed from the grid (tumble removal completion).
   */
  public handleSymbolRemovedForScatterCounter(symbolObj: any, reason: string = 'removed'): void {
    try {
      if (!symbolObj) return;
      // Guard: don't double-decrement the same object (listener + safety timeout paths).
      if ((symbolObj as any).__scatterCountRemoveAccounted) return;
      (symbolObj as any).__scatterCountRemoveAccounted = true;

      if (!this.isScatterSymbolObject(symbolObj)) return;
      this.scatterOnScreenCount = Math.max(0, Number(this.scatterOnScreenCount || 0) - 1);
      this.emitScatterOnScreenCountChanged(reason);
    } catch {}
  }

  public create(scene: Game) {
    this.scene = scene;
    // WinLineDrawer is no longer used in this game (cluster/tumble only).
    // Keep the property for compatibility but never instantiate it.
    this.winLineDrawer = null;
    initVariables(this);
    createContainer(this);
    onStart(this);
    onSpinDataReceived(this);
    this.onSpinDone(this.scene);
    this.setupDialogEventListeners();
    this.setupSpinEventListener(); // Re-enabled to clean up symbols at spin start
    

    // Listen for a full free spin reset request (after congrats/bonus end)
    this.scene.events.on('resetFreeSpinState', () => {
      console.log('[Symbols] resetFreeSpinState received - clearing free spin autoplay state');
      if (this.freeSpinAutoplayTimer) {
        this.freeSpinAutoplayTimer.destroy();
        this.freeSpinAutoplayTimer = null;
      }
      this.freeSpinAutoplayActive = false;
      this.freeSpinAutoplaySpinsRemaining = 0;
      this.freeSpinAutoplayWaitingForReelsStop = false;
      this.freeSpinAutoplayWaitingForWinlines = false;
      this.freeSpinAutoplayTriggered = false;
      this.dialogListenerSetup = false;
    });
  }

  private forEachLiveSymbol(fn: (obj: any) => void): void {
    const grid = this.symbols;
    if (!Array.isArray(grid)) return;
    for (let col = 0; col < grid.length; col++) {
      const column = grid[col];
      if (!Array.isArray(column)) continue;
      for (let row = 0; row < column.length; row++) {
        const obj = column[row];
        if (!obj) continue;
        try { fn(obj); } catch {}
      }
    }
  }

  private stopIdleFloatForSymbol(obj: any, restoreTransform: boolean = true): void {
    if (!obj) return;
    try {
      const arr: any[] | undefined = (obj as any).__idleFloatTweens;
      if (Array.isArray(arr)) {
        for (const t of arr) {
          try {
            // Phaser.Tween API: stop() + remove() is safest to fully detach from manager
            if (t && typeof t.stop === 'function') t.stop();
            if (t && typeof t.remove === 'function') t.remove();
          } catch {}
        }
      }
    } catch {}

    try { delete (obj as any).__idleFloatTweens; } catch {}

    if (restoreTransform) {
      try {
        const baseY = (obj as any).__idleFloatBaseY;
        if (typeof baseY === 'number' && typeof obj.y === 'number') {
          obj.y = baseY;
        }
      } catch {}
      try {
        const baseRot = (obj as any).__idleFloatBaseRotation;
        if (typeof baseRot === 'number' && typeof obj.rotation === 'number') {
          obj.rotation = baseRot;
        }
      } catch {}
    }

    try { delete (obj as any).__idleFloatBaseY; } catch {}
    try { delete (obj as any).__idleFloatBaseRotation; } catch {}
  }

  private startIdleFloatForSymbol(obj: any): void {
    if (!this.idleFloatEnabled) return;
    if (!this.scene || !this.scene.tweens) return;
    if (!obj || typeof obj.y !== 'number') return;

    // Avoid stacking multiple idle tweens.
    if (Array.isArray((obj as any).__idleFloatTweens) && (obj as any).__idleFloatTweens.length > 0) {
      return;
    }

    // Do not float during spinning/active symbol motion phases.
    if (gameStateManager?.isReelSpinning) return;
    if (this.scatterAnimationManager && this.scatterAnimationManager.isAnimationInProgress()) return;

    const baseY = obj.y;
    try { (obj as any).__idleFloatBaseY = baseY; } catch {}
    if (typeof obj.rotation === 'number') {
      try { (obj as any).__idleFloatBaseRotation = obj.rotation; } catch {}
    }

    const rand = (min: number, max: number) => min + Math.random() * (max - min);
    const amp = Math.max(0, this.idleFloatAmplitudePx) * rand(0.75, 1.25);
    const duration = Math.max(300, this.idleFloatDurationMs + rand(-this.idleFloatDurationJitterMs, this.idleFloatDurationJitterMs));
    const delay = rand(0, duration);

    const tweens: any[] = [];
    try {
      const tY = this.scene.tweens.add({
        targets: obj,
        y: baseY + amp,
        duration,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
        delay
      });
      tweens.push(tY);
    } catch {}

    // Tiny sway to sell "weightless". Only if the object supports rotation.
    if (this.idleFloatRotationRad > 0 && typeof obj.rotation === 'number') {
      try {
        const baseRot = typeof (obj as any).__idleFloatBaseRotation === 'number' ? (obj as any).__idleFloatBaseRotation : obj.rotation;
        const rotAmp = this.idleFloatRotationRad * rand(0.7, 1.2);
        const tR = this.scene.tweens.add({
          targets: obj,
          rotation: baseRot + rotAmp,
          duration: duration * rand(1.05, 1.45),
          yoyo: true,
          repeat: -1,
          ease: 'Sine.inOut',
          delay: delay * rand(0.5, 1.0)
        });
        tweens.push(tR);
      } catch {}
    }

    if (tweens.length > 0) {
      try { (obj as any).__idleFloatTweens = tweens; } catch {}
    }
  }

  public stopIdleFloatForAllSymbols(restoreTransform: boolean = true): void {
    this.forEachLiveSymbol((obj) => this.stopIdleFloatForSymbol(obj, restoreTransform));
  }

  public startIdleFloatForAllSymbols(): void {
    this.forEachLiveSymbol((obj) => this.startIdleFloatForSymbol(obj));
  }

  

  private setupSpinEventListener() {
    // Listen for spin events to reset any lingering Spine symbols
    gameEventManager.on(GameEventType.SPIN, () => {
      console.log('[Symbols] Spin event detected, ensuring clean state');

      // Stop idle float immediately on spin trigger (manual or autoplay) to avoid tween conflicts.
      try { this.stopIdleFloatForAllSymbols(true); } catch {}
      
      // CRITICAL: Block autoplay spin actions if win dialog is showing, but allow manual spins
      // This fixes the timing issue where manual spin symbol cleanup was blocked
      if (gameStateManager.isShowingWinDialog && gameStateManager.isAutoPlaying) {
        console.log('[Symbols] Autoplay SPIN event BLOCKED - win dialog is showing');
        console.log('[Symbols] Manual spins are still allowed to proceed');
        return;
      }
      
      // Check if scatter animation is in progress before proceeding
      if (this.scatterAnimationManager && this.scatterAnimationManager.isAnimationInProgress()) {
        console.log('[Symbols] WARNING: SPIN event received during scatter bonus - this should not happen!');
        console.log('[Symbols] Stack trace:', new Error().stack);
        return;
      }
      
      this.ensureCleanSymbolState();
      
      // Win line checking/clearing disabled
      // Hide winning overlay when spin starts
      this.hideWinningOverlay();
      // Reset symbol depths
      this.resetSymbolDepths();
      // Restore symbol visibility for new spin
      this.restoreSymbolVisibility();
      
    });
    
    // WIN_START/WIN_STOP disabled

    // Listen for win dialog close
    gameEventManager.on(GameEventType.WIN_DIALOG_CLOSED, () => {
      console.log('[Symbols] WIN_DIALOG_CLOSED event received');
      // Reset dialog showing flag
      gameStateManager.isShowingWinDialog = false;

      // If bonus just finished, check if we need to wait for animations
      if (gameStateManager.isBonusFinished) {
        console.log('[Symbols] isBonusFinished is true on WIN_DIALOG_CLOSED');
        
        // If scatter retrigger animation is in progress, wait for it to complete before showing congrats
        if (this.scatterRetriggerAnimationInProgress) {
          console.log('[Symbols] Scatter retrigger animation in progress - waiting for retrigger dialog to close before showing congrats');
          // Set up one-time listener for retrigger dialog to close
          this.scene.events.once('dialogAnimationsComplete', () => {
            console.log('[Symbols] Retrigger dialog closed - now checking for multiplier animations before showing congrats');
            // After retrigger dialog closes, check for multiplier animations
            if (this.multiplierAnimationsInProgress) {
              console.log('[Symbols] Multiplier animations in progress - waiting for MULTIPLIER_ANIMATIONS_COMPLETE before showing congrats');
              gameEventManager.once(GameEventType.MULTIPLIER_ANIMATIONS_COMPLETE, () => {
                console.log('[Symbols] MULTIPLIER_ANIMATIONS_COMPLETE received - now showing congrats');
                this.showCongratsDialogAfterDelay();
                gameStateManager.isBonusFinished = false;
              });
            } else {
              console.log('[Symbols] No multiplier animations in progress - showing congrats now');
              this.showCongratsDialogAfterDelay();
              gameStateManager.isBonusFinished = false;
            }
          });
        } else if (this.multiplierAnimationsInProgress) {
          console.log('[Symbols] Multiplier animations in progress - waiting for MULTIPLIER_ANIMATIONS_COMPLETE before showing congrats');
          // Set up one-time listener for multiplier animations completion
          gameEventManager.once(GameEventType.MULTIPLIER_ANIMATIONS_COMPLETE, () => {
            console.log('[Symbols] MULTIPLIER_ANIMATIONS_COMPLETE received - now showing congrats');
            this.showCongratsDialogAfterDelay();
            gameStateManager.isBonusFinished = false;
          });
        } else {
          console.log('[Symbols] No animations in progress - showing congrats immediately');
          // Show congrats now and reset the flag; bonus mode exit happens on congrats close
          this.showCongratsDialogAfterDelay();
          gameStateManager.isBonusFinished = false;
        }
      } else {
        // Fallback: if in bonus mode and spin data indicates no spins left, also proceed to congrats
        try {
          const fsData = this.currentSpinData?.slot?.freespin || this.currentSpinData?.slot?.freeSpin;
          const items = Array.isArray(fsData?.items) ? fsData.items : [];
          const totalRemaining = items.reduce((sum: number, it: any) => sum + (it?.spinsLeft || 0), 0);
          if (gameStateManager.isBonus && totalRemaining <= 0) {
            console.log('[Symbols] Bonus mode with 0 spins detected on WIN_DIALOG_CLOSED - showing congrats (fallback)');
            this.showCongratsDialogAfterDelay();
          }
        } catch {}
      }
    });
    
    // Track multiplier animation state
    gameEventManager.on(GameEventType.MULTIPLIERS_TRIGGERED, () => {
      console.log('[Symbols] MULTIPLIERS_TRIGGERED - setting multiplierAnimationsInProgress to true');
      this.multiplierAnimationsInProgress = true;
    });
    
    gameEventManager.on(GameEventType.MULTIPLIER_ANIMATIONS_COMPLETE, () => {
      console.log('[Symbols] MULTIPLIER_ANIMATIONS_COMPLETE - setting multiplierAnimationsInProgress to false');
      this.multiplierAnimationsInProgress = false;
      
      // Reset scatter retrigger animation tracking for new spin
      this.scatterRetriggerAnimationInProgress = false;
    });

  }

  /**
   * Check if multiplier animations are currently in progress
   * @returns true if multiplier animations are running, false otherwise
   */
  public isScatterRetriggerAnimationInProgress(): boolean {
    return this.scatterRetriggerAnimationInProgress;
  }

  public isMultiplierAnimationsInProgress(): boolean {
    return this.multiplierAnimationsInProgress;
  }

  /**
   * Ensure symbols are in a clean state before spin animation (no conversion back to PNG)
   */
  public ensureCleanSymbolState(): void {
    if (!this.symbols || this.symbols.length === 0) {
      return;
    }
    
    console.log('[Symbols] Ensuring clean symbol state for spin (no PNG reversion)');

    // Stop any idle motion tweens so spin/drop/tumble tweens don't fight with them.
    try { this.stopIdleFloatForAllSymbols(true); } catch {}
    let spineTracksCleared = 0;
    let multiplierWinsCleared = 0;
    
    // Stop any Spine tracks but keep objects intact (no conversion to PNG)
    for (let col = 0; col < this.symbols.length; col++) {
      for (let row = 0; row < this.symbols[col].length; row++) {
        const symbol = this.symbols[col][row];
        
        if (symbol && symbol.animationState) {
          try {
            // If this symbol is a multiplier with a paused Win from a previous item,
            // clear it back to Idle instead of resuming the Win on the next spin.
            const pausedInfo = (symbol as any)?.__pausedMultiplierWin;
            if (pausedInfo) {
              const animState: any = symbol.animationState;
              try {
                if (animState.clearTracks) { animState.clearTracks(); }
                // Attempt to return the multiplier to Idle state
                const base: string | undefined = pausedInfo?.base;
                if (base && animState.setAnimation) {
                  animState.setAnimation(0, `${base}_Idle`, true);
                }
                try { delete (symbol as any).__pausedMultiplierWin; } catch {}
                multiplierWinsCleared++;
              } catch {}
            } else {
              if (symbol.animationState.clearTracks) {
                symbol.animationState.clearTracks();
                spineTracksCleared++;
              }
            }
          } catch {}
        }
      }
    }
    
    if (spineTracksCleared > 0) {
      console.log(`[Symbols] Cleared tracks on ${spineTracksCleared} Spine symbols for spin`);
    }
    if (multiplierWinsCleared > 0) {
      console.log(`[Symbols] Cleared ${multiplierWinsCleared} paused multiplier Win animations back to Idle`);
    }
  }

  /**
   * Start dropping/clearing existing symbols as soon as a new spin is triggered.
   * This is intentionally decoupled from `dropReels` so the clear phase can
   * begin immediately at spin start (manual or autoplay), before new reels drop.
   */
  public startPreSpinDrop(): void {
    if (!this.symbols || this.symbols.length === 0) {
      console.log('[Symbols] startPreSpinDrop: no symbols to drop');
      return;
    }

    // Pre-spin drop animates symbol positions; ensure idle float is not running.
    try { this.stopIdleFloatForAllSymbols(true); } catch {}

    const firstCol = this.symbols[0];
    const numRows = Array.isArray(firstCol) ? firstCol.length : 0;
    if (numRows === 0) {
      console.log('[Symbols] startPreSpinDrop: symbol grid has zero rows');
      return;
    }
    
    // Ensure GameData timings are initialized before the very first drop.
    // This mirrors the logic in processSpinDataSymbols so the first pre-spin
    // drop does not use the tiny constructor defaults (which look "too fast").
    const gameData = this.scene?.gameData as GameData;
    let isTurbo = false;
    let rowDelay = 0;
    if (gameData) {
      const baseDelay = DELAY_BETWEEN_SPINS; // 2500ms default
      const adjustedDelay = gameStateManager.isTurbo
        ? baseDelay * TurboConfig.TURBO_SPEED_MULTIPLIER
        : baseDelay;
      setSpeed(gameData, adjustedDelay);
      isTurbo = !!gameData.isTurbo;
      rowDelay = typeof (gameData as any).dropReelsDelay === 'number'
        ? (gameData as any).dropReelsDelay
        : 0;
    }

    const extendLastReelDrop = false;

    console.log('[Symbols] Starting pre-spin drop of existing symbols', {
      numRows,
      isTurbo,
      rowDelay,
    });

    // Reverse the sequence: start from bottom row to top row
    for (let step = 0; step < numRows; step++) {
      const actualRow = (numRows - 1) - step;
      const isLastReel = actualRow === 0;
      const startDelay = isTurbo ? 0 : rowDelay * step;

      this.scene.time.delayedCall(startDelay, () => {
        console.log(`[Symbols] Pre-spin dropping row ${actualRow}/${numRows - 1}`);
        try {
          dropPrevSymbols(this, actualRow, isLastReel && extendLastReelDrop);
        } catch (e) {
          console.warn('[Symbols] Error during pre-spin drop for row', actualRow, e);
        }
      });
    }
  }

  private onSpinDone(scene: Game) {
    gameEventManager.on(GameEventType.REELS_STOP, (data: any) => {
      console.log('[Symbols] REELS_STOP event received');
      
      // Check if scatter animation is in progress - if so, don't trigger a new spin
      if (this.scatterAnimationManager && this.scatterAnimationManager.isAnimationInProgress()) {
        console.log('[Symbols] REELS_STOP received during scatter bonus - not triggering new spin');
        return;
      }

      // Re-enable subtle idle motion once reels have stopped.
      // (This is especially important because we stop/kill it at SPIN/REELS_START/pre-spin drop.)
      try { this.startIdleFloatForAllSymbols(); } catch {}
      
      // Note: Autoplay continuation is now handled in onSpinDataReceived after winline animations complete
      // This prevents conflicts and ensures proper timing
      console.log('[Symbols] REELS_STOP received - autoplay continuation handled separately in onSpinDataReceived');
    });
  }

  private setupDialogEventListeners() {
    // Listen for dialog events to re-enable symbols
    this.scene.events.on('enableSymbols', () => {
      console.log('[Symbols] Re-enabling symbols after dialog transition');
      
      // Make sure symbols container is visible and interactive
      if (this.container) {
        this.container.setAlpha(1);
        this.container.setVisible(true);
        console.log('[Symbols] Symbols container re-enabled and visible');
      }
      
      // Reset any symbol tints/effects that might be active
      this.resetSymbolsState();
    });

    // Listen for scatter bonus activation to capture free spins data
    this.scene.events.on('scatterBonusActivated', (data: { scatterIndex: number; actualFreeSpins: number }) => {
      console.log(`[Symbols] Scatter bonus activated with ${data.actualFreeSpins} free spins - storing data for autoplay`);
      this.pendingFreeSpinsData = data;
    });

    // Listen for scatter bonus completion to restore symbol visibility
    this.scene.events.on('scatterBonusCompleted', () => {
      console.log('[Symbols] Scatter bonus completed event received - restoring symbol visibility');
      
      // Restore all symbols to visible state
      this.restoreSymbolVisibility();
      
      // Specifically ensure scatter symbols are visible
      this.ensureScatterSymbolsVisible();
      
      // Set up dialog animations complete listener only once
      if (!this.dialogListenerSetup) {
        console.log('[Symbols] Setting up dialog animations complete listener for the first time');
        this.dialogListenerSetup = true;
        
        // Wait for dialog animations (including iris transition) to complete before starting autoplay
        // This ensures the iris transition has fully completed before starting autoplay
        // Then wait an additional 3000ms before starting autoplay
        console.log('[Symbols] Waiting for dialog animations to complete before triggering free spins autoplay');
        this.scene.events.once('dialogAnimationsComplete', () => {
          console.log('[Symbols] Dialog animations complete - waiting additional 3000ms before starting autoplay');
          // Add 3000ms delay AFTER the iris transition completes
          this.scene.time.delayedCall(1000, () => {
            console.log('[Symbols] Additional 1200ms delay completed - now triggering autoplay for free spins');
            this.triggerAutoplayForFreeSpins();
          });
        });
      } else {
        console.log('[Symbols] Dialog animations complete listener already set up, skipping duplicate setup');
      }
      
      console.log('[Symbols] Symbol visibility restored after scatter bonus completion');
    });

    // Listen for reels stop to continue free spin autoplay
    gameEventManager.on(GameEventType.REELS_STOP, () => {
      if (this.freeSpinAutoplayActive && this.freeSpinAutoplayWaitingForReelsStop) {
        console.log('[Symbols] REELS_STOP received - continuing free spin autoplay');
        // Reset the waiting flag immediately to prevent multiple responses
        this.freeSpinAutoplayWaitingForReelsStop = false;
        this.continueFreeSpinAutoplay();
      }
    });
    
    // Listen for reels start to safely decrement the free spins counter
    gameEventManager.on(GameEventType.REELS_START, () => {
      // Reels are moving; ensure idle float is stopped so it doesn't fight reel/drop tweens.
      try { this.stopIdleFloatForAllSymbols(true); } catch {}
      if (this.freeSpinAutoplayActive && this.freeSpinAutoplayAwaitingReelsStart) {
        // Decrement exactly once per spin, only after reels actually start
        const before = this.freeSpinAutoplaySpinsRemaining;
        if (this.freeSpinAutoplaySpinsRemaining > 0) {
          this.freeSpinAutoplaySpinsRemaining -= 1;
        }
        this.freeSpinAutoplayAwaitingReelsStart = false;
        console.log(`[Symbols] Free spin counter decremented on REELS_START: ${before} -> ${this.freeSpinAutoplaySpinsRemaining}`);
      }
    });
    
    // Listen for win stop to run retrigger scatter sequence (bonus) and/or schedule next free spin
    gameEventManager.on(GameEventType.WIN_STOP, async () => {
      // If we have a pending retrigger (bonus scatter), run its sequence LAST
      if (gameStateManager.isBonus && this.pendingScatterRetrigger && Array.isArray(this.pendingScatterRetrigger.scatterGrids)) {
        const retrigger = this.pendingScatterRetrigger;
        this.pendingScatterRetrigger = null;
        console.log('[Symbols] WIN_STOP: Running delayed scatter retrigger sequence (bonus)');
        // Set flag to indicate retrigger animation is starting
        this.scatterRetriggerAnimationInProgress = true;
        console.log('[Symbols] Set scatterRetriggerAnimationInProgress to true');
        try {
          // Re-scan the live grid to ensure we animate the actual current scatters
          const liveGrids = this.getLiveScatterGrids();
          await this.playScatterRetriggerSequence(liveGrids);
        } catch (e) {
          console.warn('[Symbols] Retrigger scatter sequence failed:', e);
        }
        // Show retrigger dialog (+5 spins)
        try {
          this.scatterAnimationManager?.showRetriggerFreeSpinsDialog(5);
        } catch (e) {
          console.warn('[Symbols] Failed to show retrigger dialog:', e);
        }
        // Continue free spin autoplay after dialog finishes
        this.scene.events.once('dialogAnimationsComplete', () => {
          // Clear the retrigger animation flag when retrigger dialog closes
          this.scatterRetriggerAnimationInProgress = false;
          console.log('[Symbols] Set scatterRetriggerAnimationInProgress to false (retrigger dialog closed)');
          
          // Ensure autoplay is marked active
          try {
            this.freeSpinAutoplayActive = true;
            gameStateManager.isAutoPlaying = true;
            if (this.scene?.gameData) this.scene.gameData.isAutoPlaying = true;
          } catch {}

          // After retrigger dialog closes, wait for all subsequent dialogs to finish
          // (e.g., any win dialog(s) that will show) before resuming autoplay.
          this.waitForAllDialogsToCloseThenResume();
        });
        // Do not run normal autoplay continuation now; we will continue after dialog
        return;
      }
      
      // No retrigger pending: continue autoplay if active
      if (this.freeSpinAutoplayActive) {
        this.handleFreeSpinAutoplayWinStop();
      }
    });
  }

  /**
   * Read current scatter symbol cells from the live symbols grid.
   * Uses [col][row] indexing consistent with internal storage.
   */
  private getLiveScatterGrids(): Array<{ x: number; y: number }> {
    const grids: Array<{ x: number; y: number }> = [];
    try {
      if (this.symbols && this.symbols.length > 0) {
        for (let col = 0; col < this.symbols.length; col++) {
          const column = this.symbols[col];
          if (!Array.isArray(column)) continue;
          for (let row = 0; row < column.length; row++) {
            const obj: any = column[row];
            if (!obj) continue;
            const isScatter = (obj as any)?.symbolValue === 0 || (obj?.texture?.key === 'symbol_0');
            if (isScatter) grids.push({ x: col, y: row });
          }
        }
      }
    } catch {}
    return grids;
  }

  /**
   * Get the configured scale for a specific symbol's Spine animation
   */
  public getSpineSymbolScale(symbolValue: number): number {
    const base = this.spineSymbolScales[symbolValue] || 0.6; // Default scale if not configured
    return base * 0.93; // Slight nudge larger
  }

  /**
   * Restore symbol visibility for new spin
   */
  public restoreSymbolVisibility(): void {
    console.log('[Symbols] Restoring symbol visibility for new spin');
    
    // Reset container alpha
    if (this.container) {
      this.container.setAlpha(1);
      console.log('[Symbols] Container alpha reset to 1');
    }
    
    // Reset visibility of any symbols that might have been hidden
    if (this.symbols && this.symbols.length > 0) {
      let resetCount = 0;
      let visibleCount = 0;
      for (let col = 0; col < this.symbols.length; col++) {
        for (let row = 0; row < this.symbols[col].length; row++) {
          const symbol = this.symbols[col][row];
          if (!symbol) continue;

          // Default: show symbol
          if (typeof symbol.setVisible === 'function') {
            symbol.setVisible(true);
            visibleCount++;
          }
          resetCount++;

          
        }
      }
      console.log(`[Symbols] Restored visibility for ${resetCount} symbols, set ${visibleCount} to visible`);
      
      // Also log the current state of the container
      if (this.container) {
        console.log(`[Symbols] Container alpha after restore: ${this.container.alpha}, visible: ${this.container.visible}`);
      }
      
      // Log the state of any scatter symbols specifically
      this.logScatterSymbolsState();
      
      // Force all symbols to be visible as a final safety measure
      this.forceAllSymbolsVisible();
    }
  }

  /**
   * Log the current state of scatter symbols for debugging
   */
  private logScatterSymbolsState(): void {
    if (!this.symbols || this.symbols.length === 0) {
      return;
    }
    
    let scatterCount = 0;
    let visibleScatterCount = 0;
    
    for (let col = 0; col < this.symbols.length; col++) {
      for (let row = 0; row < this.symbols[col].length; row++) {
        const symbol = this.symbols[col][row];
        if (symbol && symbol.texture && symbol.texture.key === 'symbol_0') {
          scatterCount++;
          if (symbol.visible) {
            visibleScatterCount++;
          }
          console.log(`[Symbols] Scatter symbol at (${row}, ${col}): visible=${symbol.visible}, alpha=${symbol.alpha}, inContainer=${symbol.parentContainer === this.container}`);
        }
      }
    }
    
    console.log(`[Symbols] Scatter symbols state: ${visibleScatterCount}/${scatterCount} visible`);
  }

  /**
   * Stop all Spine animations on symbols (without converting them)
   */
  public stopAllSpineAnimations(): void {
    console.log('[Symbols] Stopping all Spine animations on symbols...');
    
    if (this.symbols && this.symbols.length > 0) {
      let spineAnimationsStopped = 0;
      
      for (let col = 0; col < this.symbols.length; col++) {
        for (let row = 0; row < this.symbols[col].length; row++) {
          const symbol = this.symbols[col][row];
          if (symbol && symbol.animationState) {
            try {
              if (symbol.animationState.clearTracks) {
                symbol.animationState.clearTracks();
                spineAnimationsStopped++;
                console.log(`[Symbols] Stopped Spine animation at (${row}, ${col})`);
              }
            } catch (error) {
              console.warn(`[Symbols] Could not stop Spine animation at (${row}, ${col}):`, error);
            }
          }
        }
      }
      
      console.log(`[Symbols] Stopped ${spineAnimationsStopped} Spine animations`);
    }
  }

  /**
   * Stop all active animations on symbols (no conversion back to PNG)
   */
  public stopAllSymbolAnimations(): void {
    console.log('[Symbols] Stopping all active symbol animations (no PNG reversion)...');
    
    if (this.symbols && this.symbols.length > 0) {
      let animationsStopped = 0;
      let spineTracksCleared = 0;
      
      for (let col = 0; col < this.symbols.length; col++) {
        for (let row = 0; row < this.symbols[col].length; row++) {
          const symbol = this.symbols[col][row];
          if (symbol) {
            // Kill any active tweens on this symbol
            this.scene.tweens.killTweensOf(symbol);
            animationsStopped++;
            
            // If this is a Spine animation, just stop tracks; do not convert
            if (symbol.animationState) {
              // Stop the Spine animation immediately
              try {
                if (symbol.animationState.clearTracks) {
                  symbol.animationState.clearTracks();
                  spineTracksCleared++;
                }
              } catch (error) {
                console.warn(`[Symbols] Could not stop Spine animation at (${row}, ${col}):`, error);
              }
            }
          }
        }
      }
      
      console.log(`[Symbols] Stopped animations on ${animationsStopped} symbols, cleared tracks on ${spineTracksCleared} Spine symbols`);
    }
    
    // Also kill any tweens on the container
    if (this.container) {
      this.scene.tweens.killTweensOf(this.container);
      console.log('[Symbols] Container tweens killed');
    }
  }

  /**
   * Specifically ensure scatter symbols are visible
   */
  public ensureScatterSymbolsVisible(): void {
    console.log('[Symbols] Specifically ensuring scatter symbols are visible');
    
    if (this.symbols && this.symbols.length > 0) {
      let scatterFound = 0;
      let scatterMadeVisible = 0;
      
      for (let col = 0; col < this.symbols.length; col++) {
        for (let row = 0; row < this.symbols[col].length; row++) {
          const symbol = this.symbols[col][row];
          if (symbol && symbol.texture && symbol.texture.key === 'symbol_0') {
            scatterFound++;
            
            if (typeof symbol.setVisible === 'function') {
              symbol.setVisible(true);
              scatterMadeVisible++;
              console.log(`[Symbols] Made scatter symbol visible at (${row}, ${col}): visible=${symbol.visible}, alpha=${symbol.alpha}`);
            }
          }
        }
      }
      
      console.log(`[Symbols] Found ${scatterFound} scatter symbols, made ${scatterMadeVisible} visible`);
      
      // Log the state after making them visible
      if (scatterFound > 0) {
        console.log('[Symbols] Scatter symbols state after ensuring visibility:');
        this.logScatterSymbolsState();
      }
    }
  }

  /**
   * Force all symbols to be visible (for debugging and recovery)
   */
  public forceAllSymbolsVisible(): void {
    console.log('[Symbols] Force setting all symbols to visible');
    
    if (this.symbols && this.symbols.length > 0) {
      let forceVisibleCount = 0;
      for (let col = 0; col < this.symbols.length; col++) {
        for (let row = 0; row < this.symbols[col].length; row++) {
          const symbol = this.symbols[col][row];
          if (symbol && typeof symbol.setVisible === 'function') {
            symbol.setVisible(true);
            forceVisibleCount++;
          }
        }
      }
      console.log(`[Symbols] Force set ${forceVisibleCount} symbols to visible`);
    }
    
    // Also ensure container is visible
    if (this.container) {
      this.container.setAlpha(1);
      this.container.setVisible(true);
      console.log('[Symbols] Container forced to visible with alpha 1');
    }
  }

  /**
   * Reset any Spine symbols back to PNG sprites (called when spin button is clicked)
   */
  public resetSpineSymbolsToPNG(): void {
    if (!this.symbols || this.symbols.length === 0) {
      console.warn('[Symbols] Cannot reset: symbols array is empty or null');
      return;
    }
    
    if (!this.currentSymbolData) {
      console.warn('[Symbols] Cannot reset: currentSymbolData is null');
      return;
    }
    
    console.log('[Symbols] Resetting Spine symbols back to PNG sprites');
    console.log('[Symbols] Current symbol data:', this.currentSymbolData);
    
    let spineCount = 0;
    let pngCount = 0;
    let resetCount = 0;
    
    // First, let's see what we have before cleanup
    for (let col = 0; col < this.symbols.length; col++) {
      for (let row = 0; row < this.symbols[col].length; row++) {
        const symbol = this.symbols[col][row];
        if (symbol) {
          if (symbol.animationState) {
            spineCount++;
            console.log(`[Symbols] Found Spine symbol at (${col}, ${row}): ${symbol.constructor.name}`);
          } else {
            pngCount++;
            console.log(`[Symbols] Found PNG symbol at (${col}, ${row}): ${symbol.texture?.key || 'unknown'}`);
          }
        } else {
          console.log(`[Symbols] Empty slot at (${col}, ${row})`);
        }
      }
    }
    
    console.log(`[Symbols] Before cleanup: ${spineCount} Spine symbols, ${pngCount} PNG symbols`);
    
    for (let col = 0; col < this.symbols.length; col++) {
      for (let row = 0; row < this.symbols[col].length; row++) {
        const symbol = this.symbols[col][row];
        
        // Check if this is a Spine object (has animationState property)
        if (symbol && symbol.animationState) {
          console.log(`[Symbols] Processing Spine symbol at (${col}, ${row})`);
          
          try {
            // Get the original symbol value from stored data
            const symbolValue = this.currentSymbolData[col][row];
            console.log(`[Symbols] Symbol value for (${col}, ${row}): ${symbolValue}`);
            
            if (symbolValue !== undefined) {
              
              // Store original position and dimensions
              const x = symbol.x;
              const y = symbol.y;
              console.log(`[Symbols] Position: (${x}, ${y}), Size: ${this.displayWidth}x${this.displayHeight}`);
              
              // Destroy the Spine object
              symbol.destroy();
              
              // Create PNG sprite in its place
              const spriteKey = 'symbol_' + symbolValue;
              console.log(`[Symbols] Creating PNG sprite with key: ${spriteKey}`);
              
              // Check if the sprite texture exists
              if (!this.scene.textures.exists(spriteKey)) {
                console.error(`[Symbols] Sprite texture '${spriteKey}' does not exist!`);
                console.log('[Symbols] Available textures:', this.scene.textures.getTextureKeys().filter(key => key.includes('symbol')));
                continue;
              }
              
              const pngSprite = this.scene.add.sprite(x, y, spriteKey);
              pngSprite.displayWidth = this.displayWidth;
              pngSprite.displayHeight = this.displayHeight;
              
              // Add to container and update reference
              this.container.add(pngSprite);
              this.symbols[col][row] = pngSprite;
              
              resetCount++;
              console.log(`[Symbols] Successfully reset Spine symbol back to PNG: ${spriteKey} at (${col}, ${row})`);
            } else {
              console.warn(`[Symbols] Symbol value is undefined for (${col}, ${row})`);
            }
          } catch (error) {
            console.error(`[Symbols] Failed to reset Spine symbol at (${col}, ${row}):`, error);
          }
        }
      }
    }
    
    console.log(`[Symbols] Reset complete: Found ${spineCount} Spine symbols, successfully reset ${resetCount}`);
  }

  public resetSymbolsState() {
    // Reset any active symbol animations or tints
    if (this.symbols && this.symbols.length > 0) {
      for (let col = 0; col < this.symbols.length; col++) {
        for (let row = 0; row < this.symbols[col].length; row++) {
          const symbol = this.symbols[col][row];
          
          if (symbol && symbol.active) {
            // Check if symbol has the required methods before calling them
            if (typeof symbol.clearTint === 'function') {
              symbol.clearTint();
            }
            if (typeof symbol.setBlendMode === 'function') {
              symbol.setBlendMode(Phaser.BlendModes.NORMAL);
            }
            if (typeof symbol.setAlpha === 'function') {
              symbol.setAlpha(1);
            }
            
            // Stop any active tweens on this symbol
            //this.scene.tweens.killTweensOf(symbol);
          }
        }
      }
      console.log('[Symbols] Reset symbols state - cleared tints and stopped animations');
    }
  }

  /**
   * Ensure all Spine symbols continue animating by forcing them into their Idle loops
   * and restoring any paused timeScale to 1. Keeps PNG symbols untouched.
   */
  public resumeIdleAnimationsForAllSymbols(): void {
    if (!this.symbols || this.symbols.length === 0) {
      return;
    }

    let resumedCount = 0;
    for (let col = 0; col < this.symbols.length; col++) {
      for (let row = 0; row < this.symbols[col].length; row++) {
        const obj: any = this.symbols[col][row] as any;
        if (!obj) continue;

        const animState: any = obj.animationState;
        if (!animState || typeof animState.setAnimation !== 'function') {
          continue; // PNG or non-spine
        }

        // Determine idle animation name from symbol value or multiplier base
        try {
          // If a multiplier Win was previously paused near the end, clear that state
          const pausedInfo = obj.__pausedMultiplierWin;
          if (pausedInfo) {
            try { delete obj.__pausedMultiplierWin; } catch {}
          }
        } catch {}

        try {
          // Determine idle animation name from symbol value
          const value: number | null = typeof obj.symbolValue === 'number' ? obj.symbolValue : null;
          if (value !== null && value !== undefined) {
            // For symbols 0-9, use Symbol{number}_FIS_Idle
            if (value >= 0 && value <= 9) {
              const idleAnim = `Symbol${value}_FIS_Idle`;
              try {
                const entry = animState.setAnimation(0, idleAnim, true);
                if (entry) {
                  if (animState.timeScale !== undefined) {
                    animState.timeScale = 1;
                  }
                  // Disable felice gun and felice eyes for Symbol0_FIS during idle
                  if (value === 0) {
                    disableFeliceAttachmentsForIdle(obj);
                  }
                }
              } catch {
                // Fallback to freezing on frame 1 if idle animation doesn't exist
                try {
                  const entry = animState.setAnimation(0, 'animation', false);
                  if (entry) {
                    (entry as any).trackTime = 0;
                    if (animState.timeScale !== undefined) {
                      animState.timeScale = 0;
                    }
                  }
                } catch {}
              }
            } else {
              // For multipliers (10-22), freeze "animation" on frame 1
              try {
                const entry = animState.setAnimation(0, 'animation', false);
                if (entry) {
                  (entry as any).trackTime = 0;
                  if (animState.timeScale !== undefined) {
                    animState.timeScale = 0;
                  }
                }
              } catch {}
            }
          }

          resumedCount++;
        } catch (e) {
          // Non-fatal: continue with other symbols
        }
      }
    }

    if (resumedCount > 0) {
      console.log(`[Symbols] Resumed idle animations on ${resumedCount} Spine symbols`);
    }

    // Always layer in the tween-based idle float as well (covers cases where Spine idle is missing).
    // If an idle animation exists, this simply adds subtle drift on top.
    try { this.startIdleFloatForAllSymbols(); } catch {}
  }

  /**
   * Manually trigger win line drawing (for testing)
   */
  public showWinLines(data: Data): void {
    if (this.winLineDrawer && data.wins && data.wins.allMatching.size > 0) {
      this.winLineDrawer.drawWinLines(data); // Now starts looping automatically
    }
  }

  /**
   * Clear win lines and stop looping
   */
  public clearWinLines(): void {
    if (this.winLineDrawer) {
      this.winLineDrawer.stopLooping();
      this.winLineDrawer.clearLines();
    }
  }

  

  /**
   * Check if there are currently visible wins (win lines or overlay)
   */
  public hasCurrentWins(): boolean {
    // Check if win line drawer has active lines
    const hasWinLines = this.winLineDrawer && this.winLineDrawer.hasActiveLines();
    
    // Check if black overlay is visible
    const hasOverlay = this.overlayRect && this.overlayRect.visible;
    
    return hasWinLines || (hasOverlay ?? false);
  }

  /**
   * Create semi-transparent rectangle overlay above symbols
   */
  private createOverlayRect(): void {
    if (this.overlayRect) {
      this.overlayRect.destroy();
    }
    
    // Create overlay graphics
    this.overlayRect = this.scene.add.graphics();
    
    // Set semi-transparent black fill
    this.overlayRect.fillStyle(0x000000, 0.7);
    
    // Fill rectangle covering the symbol grid area
    const gridBounds = this.getSymbolGridBounds();
    this.overlayRect.fillRect(
      gridBounds.x, 
      gridBounds.y, 
      gridBounds.width, 
      gridBounds.height
    );
    
    // Set depth to be above symbols but below winning symbols
    this.overlayRect.setDepth(500);
    
    // Hide by default
    this.overlayRect.setVisible(false);
    
    console.log('[Symbols] Semi-transparent overlay rectangle created (hidden by default)');
  }

  /**
   * Show overlay for winning patterns with fade in animation
   */
  public showWinningOverlay(): void {
    if (!this.overlayRect) {
      this.createOverlayRect();
    }
    if (this.overlayRect) {
      // Stop any existing tweens on the overlay
      this.scene.tweens.killTweensOf(this.overlayRect);
      
      // If already visible, ensure full opacity and avoid re-tweening to prevent flicker
      if (this.overlayRect.visible && this.overlayRect.alpha >= 1) {
        this.overlayRect.setAlpha(1);
        console.log('[Symbols] Winning overlay already visible - ensuring alpha 1');
        return;
      }
      
      // Set initial state for fade in
      this.overlayRect.setVisible(true);
      this.overlayRect.setAlpha(0);
      
      // Animate fade in
      this.scene.tweens.add({
        targets: this.overlayRect,
        alpha: 1,
        duration: 300,
        ease: 'Power2.easeOut',
        onComplete: () => {
          console.log('[Symbols] Winning overlay fade in completed');
        }
      });
    }
    console.log('[Symbols] Winning overlay fade in started');
  }

  /**
   * Hide the overlay with fade out animation
   */
  public hideWinningOverlay(): void {
    if (this.overlayRect && this.overlayRect.visible) {
      // Stop any existing tweens on the overlay
      this.scene.tweens.killTweensOf(this.overlayRect);
      
      // Animate fade out
      this.scene.tweens.add({
        targets: this.overlayRect,
        alpha: 0,
        duration: 200,
        ease: 'Power2.easeIn',
        onComplete: () => {
          if (this.overlayRect) {
            this.overlayRect.setVisible(false);
          }
          console.log('[Symbols] Winning overlay fade out completed');
        }
      });
      console.log('[Symbols] Winning overlay fade out started');
    }
  }


  /**
   * Move winning symbols to appear in front of the overlay
   */
  public moveWinningSymbolsToFront(data: Data): void {
    if (!data.wins || data.wins.allMatching.size === 0) {
      console.log('[Symbols] No wins to move to front');
      return;
    }

    // Collect all unique winning grids from all win patterns
    const allWinningGrids = new Set<string>();
    const uniqueGrids: { x: number, y: number }[] = [];

    for (const winningGrids of data.wins.allMatching.values()) {
      for (const grid of winningGrids) {
        const gridKey = `${grid.x},${grid.y}`;
        if (!allWinningGrids.has(gridKey)) {
          allWinningGrids.add(gridKey);
          uniqueGrids.push({ x: grid.x, y: grid.y });
        }
      }
    }

    console.log(`[Symbols] Found ${uniqueGrids.length} unique winning symbols to move to front`);

    // Set depth of winning symbols to be above the overlay
    let movedCount = 0;
    for (const grid of uniqueGrids) {
      if (this.symbols && this.symbols[grid.y] && this.symbols[grid.y][grid.x] && !this.symbols[grid.y][grid.x].destroyed) {
        const symbol = this.symbols[grid.y][grid.x];
        console.log(`[Symbols] Moving symbol at (${grid.x}, ${grid.y}) to front, current depth:`, symbol.depth);
        
        // Remove symbol from container and add directly to scene for independent depth control
        this.container.remove(symbol);
        this.scene.add.existing(symbol);
        
        if (typeof symbol.setDepth === 'function') {
          symbol.setDepth(600); // Above overlay (500) but below win lines (1000)
        }
        // If symbol has an overlay, move it to scene and keep above the symbol
        try {
          const overlayObj: any = (symbol as any).__overlayImage;
          if (overlayObj) {
            try { this.scene.tweens.killTweensOf(overlayObj); } catch {}
            if (overlayObj.parentContainer === this.container) {
              this.container.remove(overlayObj);
            } else {
              this.scene.children.remove(overlayObj);
            }
            this.scene.add.existing(overlayObj);
            overlayObj.setDepth((symbol.depth || 600) + 1);
          }
        } catch {}
        console.log(`[Symbols] Symbol at (${grid.x}, ${grid.y}) moved to scene with depth:`, symbol.depth);
        movedCount++;
      } else {
        console.warn(`[Symbols] Symbol at (${grid.x}, ${grid.y}) not found or invalid`);
      }
    }

    console.log(`[Symbols] Successfully moved ${movedCount} out of ${uniqueGrids.length} winning symbols to front`);
  }

  /**
   * Reset all symbol depths to default and move them back to container
   */
  public resetSymbolDepths(): void {
    if (!this.symbols || this.symbols.length === 0) {
      return;
    }

    let resetCount = 0;
    for (let col = 0; col < this.symbols.length; col++) {
      for (let row = 0; row < this.symbols[col].length; row++) {
        const symbol = this.symbols[col][row];
        if (symbol) {
          // Move symbol back to container if it's not already there
          if (symbol.parentContainer !== this.container) {
            this.scene.children.remove(symbol);
            this.container.add(symbol);
          }
          if (typeof symbol.setDepth === 'function') {
            symbol.setDepth(0); // Reset to default depth
          }
          // Move overlay (if any) back to container and keep above the symbol
          try {
            const overlayObj: any = (symbol as any).__overlayImage;
            if (overlayObj) {
              try { this.scene.tweens.killTweensOf(overlayObj); } catch {}
              if (overlayObj.parentContainer !== this.container) {
                this.scene.children.remove(overlayObj);
                this.container.add(overlayObj);
              }
              overlayObj.setDepth(1);
            }
          } catch {}
          resetCount++;
        }
      }
    }
    console.log(`[Symbols] Reset depths and container for ${resetCount} symbols`);
  }

  /**
   * Move scatter symbols to front (above overlay) - similar to winning symbols
   */
  public moveScatterSymbolsToFront(data: Data, scatterGrids: any[]): void {
    if (scatterGrids.length === 0) {
      console.log('[Symbols] No scatter symbols to move to front');
      return;
    }

    console.log(`[Symbols] Moving ${scatterGrids.length} scatter symbols to front`);

    // Set depth of scatter symbols to be above the overlay
    let movedCount = 0;
    for (const grid of scatterGrids) {
      if (this.symbols && this.symbols[grid.y] && this.symbols[grid.y][grid.x]) {
        const symbol = this.symbols[grid.y][grid.x];
        console.log(`[Symbols] Moving scatter symbol at (${grid.x}, ${grid.y}) to front, current depth:`, symbol.depth);
        
        // Remove symbol from container and add directly to scene for independent depth control
        this.container.remove(symbol);
        this.scene.add.existing(symbol);
        
        if (typeof symbol.setDepth === 'function') {
          symbol.setDepth(600); // Above overlay (500) but below win lines (1000)
        }
        // If symbol has an overlay, move it to scene and keep above the symbol
        try {
          const overlayObj: any = (symbol as any).__overlayImage;
          if (overlayObj) {
            if (overlayObj.parentContainer === this.container) {
              this.container.remove(overlayObj);
            } else {
              this.scene.children.remove(overlayObj);
            }
            this.scene.add.existing(overlayObj);
            overlayObj.setDepth((symbol.depth || 600) + 1);
          }
        } catch {}
        console.log(`[Symbols] Scatter symbol at (${grid.x}, ${grid.y}) moved to scene with depth:`, symbol.depth);
        movedCount++;
      } else {
        console.warn(`[Symbols] Scatter symbol at (${grid.x}, ${grid.y}) not found or invalid`);
      }
    }

    console.log(`[Symbols] Successfully moved ${movedCount} out of ${scatterGrids.length} scatter symbols to front`);
  }

  /**
   * Start the scatter animation sequence (called after win dialog closes or immediately if no dialog)
   */
  public startScatterAnimationSequence(mockData: any): void {
    console.log('[Symbols] Starting scatter animation sequence');
    
    // Keep animations running and symbols visible during scatter; do not stop or hide
    this.hideWinningOverlay();
    this.clearWinLines();
    
    // Do NOT hide the winnings display on scatter; keep it visible until bonus header takes over
    
    // Then trigger the scatter animation sequence (spinner, dialog, etc.)
    if (this.scatterAnimationManager) {
      console.log('[Symbols] Starting scatter animation sequence');
      this.scatterAnimationManager.playScatterAnimation(mockData);
    } else {
      console.warn('[Symbols] ScatterAnimationManager not available');
    }
  }

  /**
   * Animate scatter symbols with Spine animations (no winlines)
   */
  public async animateScatterSymbols(data: Data, scatterGrids: any[]): Promise<void> {
    if (scatterGrids.length === 0) {
      console.log('[Symbols] No scatter symbols to animate');
      return;
    }

    console.log(`[Symbols] Starting scatter symbol Spine animation for ${scatterGrids.length} symbols`);

    // Ensure any scatter symbols are not clipped by the grid mask before we scale/move them.
    try {
      for (const grid of scatterGrids) {
        const col = grid.x;
        const row = grid.y;
        const obj: any = this.symbols?.[col]?.[row];
        if (obj) this.liftOutOfGridMask(obj);
      }
    } catch {}

    // Replace scatter symbols with Spine animations
    const animationPromises = scatterGrids.map(grid => {
      return new Promise<void>((resolve) => {
        // Note: scatterGrids coordinates are [row][col] from transposed data
        // but this.symbols array is [col][row] format, so we need to swap coordinates
        const col = grid.x; // grid.x is actually the column in transposed data
        const row = grid.y; // grid.y is actually the row in transposed data
        
        console.log(`[Symbols] ScatterGrid coordinates: grid.x=${grid.x}, grid.y=${grid.y} -> col=${col}, row=${row}`);
        console.log(`[Symbols] Accessing this.symbols[${col}][${row}]`);
        
        if (this.symbols && this.symbols[col] && this.symbols[col][row]) {
          const currentSymbol = this.symbols[col][row];
          
          try {
            // If the current symbol is still under the masked grid container, detach first.
            this.liftOutOfGridMask(currentSymbol);

            // Use scatter spine (Symbol0) frozen on frame 1
            const symbolValue = 0; // Scatter
            const spineKey = `symbol_${symbolValue}_spine`;
            const spineAtlasKey = spineKey + '-atlas';
            
            // Store original position and scale
            const x = currentSymbol.x;
            const y = currentSymbol.y;
            const displayWidth = currentSymbol.displayWidth;
            const displayHeight = currentSymbol.displayHeight;
            
            console.log(`[Symbols] Replacing scatter sprite with Spine animation: ${spineKey} at column ${col}, row ${row}`);
            
            // Remove the current sprite
            currentSymbol.destroy();

            const attemptCreate = (attempts: number) => {
              try {
                if (!(this.scene.cache.json as any).has(spineKey)) {
                  if (attempts < 5) {
                    console.warn(`[Symbols] Spine json '${spineKey}' not ready. Retrying (${attempts + 1}/5)...`);
                    this.scene.time.delayedCall(150, () => attemptCreate(attempts + 1));
                    return;
                  }
                }
                if (!ensureSpineFactory(this.scene, `[Symbols] replaceScatterSprite(${spineKey})`)) {
                  if (attempts < 5) {
                    console.warn(`[Symbols] Spine factory not available for '${spineKey}'. Retrying (${attempts + 1}/5)...`);
                    this.scene.time.delayedCall(150, () => attemptCreate(attempts + 1));
                    return;
                  }
                  console.warn(`[Symbols] Spine factory still unavailable for '${spineKey}'. Skipping spine replacement.`);
                  resolve();
                  return;
                }
                // Create Spine animation in its place
                const spineSymbol = (this.scene.add as any).spine?.(x, y, spineKey, spineAtlasKey);
                if (!spineSymbol) {
                  if (attempts < 5) {
                    console.warn(`[Symbols] add.spine returned null for '${spineKey}'. Retrying (${attempts + 1}/5)...`);
                    this.scene.time.delayedCall(150, () => attemptCreate(attempts + 1));
                    return;
                  }
                  console.warn(`[Symbols] add.spine still failing for '${spineKey}'. Skipping spine replacement.`);
                  resolve();
                  return;
                }
                spineSymbol.setOrigin(0.5, 0.5);
                try { (spineSymbol as any).symbolValue = 0; } catch {}
                // Fit to symbol box for consistent sizing
                try { fitSpineToSymbolBox(this, spineSymbol); } catch {}

                // Safety: ensure the new Spine symbol is not clipped by the grid mask.
                this.liftOutOfGridMask(spineSymbol);
                this.symbols[col][row] = spineSymbol;
                
                // Register the scatter symbol with the ScatterAnimationManager
                if (this.scatterAnimationManager) {
                  this.scatterAnimationManager.registerScatterSymbol(spineSymbol);
                }
                
                // Ensure the Spine animation maintains the elevated depth
                spineSymbol.setDepth(600); // Above overlay (500) but below win lines (1000)
                
                console.log(`[Symbols] Successfully replaced scatter sprite with Spine animation at column ${col}, row ${row} with depth:`, spineSymbol.depth);
                
                // Enable felice gun and felice eyes when scatter is hit
                enableFeliceAttachmentsForWin(spineSymbol);
                
                // Set idle animation for scatter symbol (symbol 0)
                // Note: Keep attachments enabled when scatter is hit - they'll stay visible during idle
                // and remain enabled during win animation. They'll only be disabled when returning to idle
                // after the win animation completes (handled in the win animation completion callback)
                try {
                  if (spineSymbol.animationState && spineSymbol.animationState.setAnimation) {
                    const idleAnim = `Symbol0_FIS_Idle`;
                    try {
                      const entry = spineSymbol.animationState.setAnimation(0, idleAnim, true);
                      if (entry && spineSymbol.animationState.timeScale !== undefined) {
                        spineSymbol.animationState.timeScale = 1;
                      }
                      // Keep attachments enabled during idle after hit (don't disable them here)
                    } catch {
                      // Fallback to freezing on frame 1 if idle animation doesn't exist
                      const entry = spineSymbol.animationState.setAnimation(0, 'animation', false);
                      if (entry) {
                        (entry as any).trackTime = 0;
                        if (spineSymbol.animationState.timeScale !== undefined) {
                          spineSymbol.animationState.timeScale = 0;
                        }
                      }
                    }
                  }
                } catch {}
                
                // Create smooth scale tween to increase size by 20%
                // Determine current scale after fit and scale up
                const currentScaleX = (spineSymbol as any)?.scaleX ?? 1;
                const currentScaleY = (spineSymbol as any)?.scaleY ?? 1;
                const enlargedScaleX = currentScaleX * 1.8;
                const enlargedScaleY = currentScaleY * 1.8;
                this.scene.tweens.add({
                  targets: spineSymbol,
                  scaleX: enlargedScaleX,
                  scaleY: enlargedScaleY,
                  duration: 500, // Smooth 500ms transition
                  ease: 'Power2.easeOut', // Smooth easing
                  onComplete: () => {
                    console.log(`[Symbols] Scatter symbol scale tween completed`);
                  }
                });
                
                console.log(`[Symbols] Applied smooth scale tween to scatter symbol ${symbolValue}`);
                
                // Resolve after a short delay to allow animation to start
                setTimeout(() => resolve(), 100);
              } catch (e) {
                if (attempts < 5) {
                  this.scene.time.delayedCall(150, () => attemptCreate(attempts + 1));
                  return;
                }
                throw e;
              }
            };
            attemptCreate(0);
            
          } catch (error) {
            console.warn(`[Symbols] Failed to replace scatter sprite with Spine animation at column ${col}, row ${row}:`, error);
            
            // Fallback to the old pulse method if Spine replacement fails
            if (this.symbols[col] && this.symbols[col][row]) {
              const symbol = this.symbols[col][row];
              // If we are falling back to a non-spine symbol, make sure it isn't clipped by the grid mask.
              this.liftOutOfGridMask(symbol);
              
              // Pulse effect: scale up and down with glow
              this.scene.tweens.add({
                targets: symbol,
                scaleX: 1.2,
                scaleY: 1.2,
                duration: 300,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: 2, // Pulse 3 times total
                onComplete: () => {
                  resolve();
                }
              });
              
              // Add glow effect - check if methods exist before calling
              if (typeof symbol.setTint === 'function') {
                symbol.setTint(0x00FFFF); // Cyan tint for scatter
              }
              if (typeof symbol.setBlendMode === 'function') {
                symbol.setBlendMode(Phaser.BlendModes.ADD);
              }
            } else {
              resolve();
            }
          }
        } else {
          resolve();
        }
      });
    });
    
    // Wait for all Spine animations to start
    await Promise.all(animationPromises);
    
    // Keep idle on hit, then after 0.5s gather all scatters to screen center while playing drop once
    await this.delay(500);
    try {
      // Center on the symbols grid (not the screen center)
      const centerX = this.slotX + 10;
      const centerY = this.slotY;
      const gatherDuration = 600;
      const symbolValue = 0; // Scatter symbol index
      
      const gatherPromises = scatterGrids.map(grid => {
        return new Promise<void>((resolve) => {
          const col = grid.x;
          const row = grid.y;
          const symbol: any = this.symbols?.[col]?.[row];
          if (!symbol) {
            resolve();
            return;
          }
          
          // No drop animation - symbols are frozen on frame 1
          let dropCompleted = true;
          let tweenCompleted = false;
          const maybeResolve = () => {
            if (dropCompleted && tweenCompleted) resolve();
          };
          
          // Tween the symbol to the center
          this.scene.tweens.add({
            targets: symbol,
            x: centerX,
            y: centerY,
            duration: gatherDuration,
            ease: 'Sine.easeInOut',
            onComplete: () => {
              tweenCompleted = true;
              maybeResolve();
            }
          });
        });
      });
      
      await Promise.all(gatherPromises);
      console.log('[Symbols] Scatter symbols gathered to center and drop animation played once');
      
      // After gathering: scale each scatter by +100% (2x) then play the win animation
      try {
        const symbolValue = 0; // Scatter is symbol 0
        const winAnimationName = `Symbol${symbolValue}_FIS_Win`;
        const scaleTweens: Promise<void>[] = scatterGrids.map(grid => {
          return new Promise<void>((resolve) => {
            const col = grid.x;
            const row = grid.y;
            const symbol: any = this.symbols?.[col]?.[row];
            if (!symbol) {
              resolve();
              return;
            }
            const currentScaleX = (symbol as any)?.scaleX ?? 1;
            const currentScaleY = (symbol as any)?.scaleY ?? 1;
            const targetScaleX = currentScaleX * 2.5;
            const targetScaleY = currentScaleY * 2.5;
            
            this.scene.tweens.add({
              targets: symbol,
              scaleX: targetScaleX,
              scaleY: targetScaleY,
              duration: 400,
              ease: 'Sine.easeOut',
              onComplete: () => {
                try {
                  const state: any = symbol.animationState;
                  const canAnimate = state && typeof state.setAnimation === 'function';
                  if (canAnimate) {
                    let finished = false;
                    let listenerRef: any = null;
                    // Attach listener so that after Win plays once, we return to Idle loop
                    try {
                      if (typeof state.addListener === 'function') {
                        listenerRef = {
                          complete: (entry: any) => {
                            try {
                              if (!entry || entry.animation?.name !== winAnimationName) return;
                            } catch {}
                            if (finished) return;
                            finished = true;
                            // Return to idle animation after win animation completes
                            try {
                              const idleAnim = `Symbol${symbolValue}_FIS_Idle`;
                              try {
                                state.setAnimation(0, idleAnim, true);
                                // Disable felice gun and felice eyes when returning to idle
                                if (symbolValue === 0) {
                                  disableFeliceAttachmentsForIdle(symbol);
                                }
                              } catch {
                                // Fallback to freezing on frame 1 if idle animation doesn't exist
                                const entry = state.setAnimation(0, 'animation', false);
                                if (entry) {
                                  (entry as any).trackTime = 0;
                                  if (state.timeScale !== undefined) {
                                    state.timeScale = 0;
                                  }
                                }
                              }
                            } catch {}
                            try { if (state.removeListener && listenerRef) state.removeListener(listenerRef); } catch {}
                          }
                        };
                        state.addListener(listenerRef);
                      }
                    } catch {}

                    // Resume animation if it was frozen
                    if (state.timeScale !== undefined && state.timeScale === 0) {
                      state.timeScale = 1;
                    }
                    // Enable felice gun and felice eyes for Symbol0_FIS win animation (BEFORE animation is set)
                    if (symbolValue === 0) {
                      enableFeliceAttachmentsForWin(symbol);
                    }
                    const entry = state.setAnimation(0, winAnimationName, false);
                    // Enable again after animation is set to ensure they're active
                    if (symbolValue === 0) {
                      enableFeliceAttachmentsForWin(symbol);
                      // Also enable on next frame to ensure animation system has processed it
                      this.scene.time.delayedCall(16, () => {
                        enableFeliceAttachmentsForWin(symbol);
                      });
                    }
                    if (entry) {
                      // Slow down win animation for better visibility
                      try {
                        const base = (typeof (entry as any).timeScale === 'number' && (entry as any).timeScale > 0)
                          ? (entry as any).timeScale
                          : 1;
                        const newScale = base * 0.7; // 30% slower for better visibility
                        (entry as any).timeScale = newScale;
                      } catch {}
                    } else {
                      // Fallback: slow down the whole state if entry not available
                      try {
                        const baseState = (typeof state.timeScale === 'number' && state.timeScale > 0)
                          ? state.timeScale
                          : 1;
                        const newStateScale = baseState * 0.7; // 30% slower
                        state.timeScale = newStateScale;
                      } catch {}
                    }

                    // Safety timeout: if complete never fires, still return to idle animation
                    this.scene.time.delayedCall(2500, () => {
                      if (finished) return;
                      finished = true;
                      try {
                        const idleAnim = `Symbol${symbolValue}_FIS_Idle`;
                        try {
                          state.setAnimation(0, idleAnim, true);
                          // Disable felice gun and felice eyes when returning to idle (safety timeout)
                          if (symbolValue === 0) {
                            disableFeliceAttachmentsForIdle(symbol);
                          }
                        } catch {
                          // Fallback to freezing on frame 1 if idle animation doesn't exist
                          const entry = state.setAnimation(0, 'animation', false);
                          if (entry) {
                            (entry as any).trackTime = 0;
                            if (state.timeScale !== undefined) {
                              state.timeScale = 0;
                            }
                          }
                        }
                      } catch {}
                      try { if (state.removeListener && listenerRef) state.removeListener(listenerRef); } catch {}
                    });
                  }
                } catch {}
                resolve();
              }
            });
          });
        });
        await Promise.all(scaleTweens);
        console.log('[Symbols] Scatter symbols scaled up and win animation started');
      } catch (e2) {
        console.warn('[Symbols] Failed to scale scatters or start win animation:', e2);
      }
    } catch (e) {
      console.warn('[Symbols] Failed to gather scatter symbols to center:', e);
    }
    
    console.log('[Symbols] Scatter symbol Spine animation completed');
  }

  /**
   * During bonus mode, after all other wins/tumbles/multipliers complete (WIN_STOP),
   * play a lightweight retrigger animation on each scatter and then show dialog (+spins).
   * - Scale each visible scatter by +20%
   * - Play the scatter "win" animation once
   */
  private async playScatterRetriggerSequence(scatterGrids: Array<{ x: number; y: number }>): Promise<void> {
    if (!Array.isArray(scatterGrids) || scatterGrids.length === 0) {
      return;
    }
    console.log(`[Symbols] Playing scatter retrigger sequence for ${scatterGrids.length} symbol(s)`);
    
    const symbolValue = 0; // Scatter symbol id
    const winAnimationName = `Symbol${symbolValue}_FIS_Win`;

    // Prepare overlay container (above mask) and restore tracking
    if (!this.overlayContainer) {
      try {
        this.overlayContainer = this.scene.add.container(0, 0);
        this.overlayContainer.setDepth(930);
      } catch {}
    }
    const restoreEntries: Array<{ obj: any; parent: Phaser.GameObjects.Container | null; x: number; y: number }> = [];
    
    const tweens: Promise<void>[] = scatterGrids.map(grid => {
      return new Promise<void>((resolve) => {
        try {
          const col = grid.x;
          const row = grid.y;
          let symbol: any = this.symbols?.[col]?.[row];
          if (!symbol) {
            resolve();
            return;
          }
          
          // Ensure scatter at this cell is a Spine symbol so we can play win animation
          try {
            const isScatter = (symbol as any)?.symbolValue === 0 || (symbol?.texture?.key === 'symbol_0');
            const hasSpine = !!(symbol as any)?.animationState;
            if (isScatter && !hasSpine) {
              // Replace PNG with Spine scatter
              const x = symbol.x;
              const y = symbol.y;
              try { symbol.destroy(); } catch {}
              const spineKey = `symbol_0_spine`;
              const spineAtlasKey = spineKey + '-atlas';
              if (ensureSpineFactory(this.scene, `[Symbols] ensureScatterSpine(${spineKey})`)) {
                const spineSymbol = (this.scene.add as any).spine?.(x, y, spineKey, spineAtlasKey);
                if (!spineSymbol) {
                  resolve();
                  return;
                }
              try { (spineSymbol as any).symbolValue = 0; } catch {}
              spineSymbol.setOrigin(0.5, 0.5);
              // Apply configured scale for scatter
              spineSymbol.setScale(this.getSpineSymbolScale(0));
              // Store back into grid
              this.symbols[col][row] = spineSymbol;
              symbol = spineSymbol;
              // Enable felice gun and felice eyes for retrigger scatter animation
              enableFeliceAttachmentsForWin(spineSymbol);
              } else {
                resolve();
                return;
              }
            }
          } catch {}
          
          // Lift symbol above the masked grid: move to overlay at world coordinates
          try {
            if (this.overlayContainer) {
              const originalParent: any = (symbol as any)?.parentContainer || null;
              // Compute world coordinates to preserve on reparent
              let worldX = symbol.x, worldY = symbol.y;
              try {
                const m: any = symbol.getWorldTransformMatrix ? symbol.getWorldTransformMatrix() : null;
                if (m && typeof m.tx === 'number' && typeof m.ty === 'number') {
                  worldX = m.tx; worldY = m.ty;
                } else if (originalParent) {
                  worldX = symbol.x + (originalParent.x || 0);
                  worldY = symbol.y + (originalParent.y || 0);
                }
              } catch {}
              // Track restore info
              restoreEntries.push({ obj: symbol, parent: originalParent, x: symbol.x, y: symbol.y });
              // Detach from original parent and add to overlay (unmasked)
              try { if (originalParent) originalParent.remove(symbol); } catch {}
              this.overlayContainer.add(symbol);
              symbol.x = worldX;
              symbol.y = worldY;
              try { symbol.setDepth(931); } catch {}
            }
          } catch {}
          
          const currentScaleX = (symbol as any)?.scaleX ?? 1;
          const currentScaleY = (symbol as any)?.scaleY ?? 1;
          const targetScaleX = currentScaleX * 1.5;
          const targetScaleY = currentScaleY * 1.5;
          
          this.scene.tweens.add({
            targets: symbol,
            scaleX: targetScaleX,
            scaleY: targetScaleY,
            duration: 300,
            ease: 'Sine.easeOut',
            onComplete: () => {
              try {
                // If we have a Spine animation state, play the win animation once and wait for completion
                const state: any = symbol.animationState;
                const canAnimate = state && typeof state.setAnimation === 'function';
                if (canAnimate) {
                  try { if (typeof state.clearTracks === 'function') state.clearTracks(); } catch {}
                  // Resume animation if it was frozen
                  if (state.timeScale !== undefined && state.timeScale === 0) {
                    state.timeScale = 1;
                  }
                  let finished = false;
                  let listenerRef: any = null;
                  try {
                    if (typeof state.addListener === 'function') {
                      listenerRef = {
                        complete: (entry: any) => {
                          try {
                            if (!entry || entry.animation?.name !== winAnimationName) return;
                          } catch {}
                          if (finished) return;
                          finished = true;
                          // Return to idle animation after win animation completes
                          try {
                            const idleAnim = `Symbol${symbolValue}_FIS_Idle`;
                            try {
                              state.setAnimation(0, idleAnim, true);
                            } catch {
                              // Fallback to freezing on frame 1 if idle animation doesn't exist
                              const freezeEntry = state.setAnimation(0, 'animation', false);
                              if (freezeEntry) {
                                (freezeEntry as any).trackTime = 0;
                                if (state.timeScale !== undefined) {
                                  state.timeScale = 0;
                                }
                              }
                            }
                          } catch {}
                          try { if (state.removeListener && listenerRef) state.removeListener(listenerRef); } catch {}
                          resolve();
                        }
                      };
                      state.addListener(listenerRef);
                    }
                  } catch {}
                  // Enable felice gun and felice eyes for Symbol0_FIS win animation (BEFORE animation is set)
                  enableFeliceAttachmentsForWin(symbol);
                  // Start the win animation
                  try {
                    state.setAnimation(0, winAnimationName, false);
                  } catch {}

                  // Safety timeout in case 'complete' never fires
                  this.scene.time.delayedCall(2500, () => {
                    if (finished) return;
                    finished = true;
                    // Ensure we freeze on frame 1 even if complete doesn't fire
                    try {
                      if (state.clearTracks) state.clearTracks();
                      if (state.setEmptyAnimation) state.setEmptyAnimation(0, 0);
                    } catch {}
                    try { if (state.removeListener && listenerRef) state.removeListener(listenerRef); } catch {}
                    resolve();
                  });
                } else {
                  // No animation available; just resolve after the scale tween
                  resolve();
                }
              } catch {
                resolve();
              }
            }
          });
        } catch {
          resolve();
        }
      });
    });
    
    await Promise.all(tweens);
    console.log('[Symbols] Scatter retrigger animation completed');
    // Emit event to signal that retrigger animation is complete
    // Note: flag remains true until dialog closes
    gameEventManager.emit(GameEventType.SCATTER_RETRIGGER_ANIMATION_COMPLETE);
    console.log('[Symbols] Emitted SCATTER_RETRIGGER_ANIMATION_COMPLETE event');
    
    // Restore lifted symbols to original parents/positions
    try {
      for (const entry of restoreEntries) {
        const obj = entry.obj;
        try { if (this.overlayContainer) this.overlayContainer.remove(obj); } catch {}
        if (entry.parent) {
          try { entry.parent.add(obj); } catch {}
          obj.x = entry.x;
          obj.y = entry.y;
        } else {
          // Original parent was root; return to root display list
          try { this.scene.children.add(obj); } catch {}
          obj.x = entry.x;
          obj.y = entry.y;
        }
        try { obj.setDepth(0); } catch {}
      }
    } catch {}
  }
  /**
   * Helper method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      this.scene.time.delayedCall(ms, () => {
        resolve();
      });
    });
  }

  /**
   * Hide all symbols (including scatter symbols) by setting container alpha to 0
   */
  public hideAllSymbols(): void {
    if (this.container) {
      console.log('[Symbols] Hiding all symbols by setting container alpha to 0');
      this.container.setAlpha(0);
    }
  }

  /**
   * Hide scatter symbols specifically (ensure they are manageable via container), no PNG reversion
   */
  public hideScatterSymbols(scatterGrids: any[]): void {
    if (!scatterGrids || scatterGrids.length === 0) {
      return;
    }

    console.log(`[Symbols] Hiding ${scatterGrids.length} scatter symbols (no PNG reversion)`);
    
    let hiddenCount = 0;
    
    for (const grid of scatterGrids) {
      if (this.symbols && this.symbols[grid.y] && this.symbols[grid.y][grid.x]) {
        const symbol = this.symbols[grid.y][grid.x];
        
        // Ensure symbol is managed under container for consistent hiding
        if (symbol.parentContainer !== this.container) {
          this.scene.children.remove(symbol);
          this.container.add(symbol);
        }

        // Now hide the symbol in place
        const currentSymbol = this.symbols[grid.y][grid.x];
        if (currentSymbol && typeof currentSymbol.setVisible === 'function') {
          currentSymbol.setVisible(false);
          hiddenCount++;
          console.log(`[Symbols] Hidden symbol at (${grid.x}, ${grid.y}), visible: ${currentSymbol.visible}`);
        }
      }
    }
    
    console.log(`[Symbols] Hidden ${hiddenCount} scatter symbols (no PNG reversion)`);
  }

  /**
   * Get the bounds of the symbol grid
   */
  private getSymbolGridBounds(): { x: number, y: number, width: number, height: number } {
    // Add padding to make the overlay slightly larger than the symbol grid
    const paddingX = 9;
    const paddingY = 8;

    const offsetX = 1;
    const offsetY = 0.7;
    
    const x = this.slotX - this.totalGridWidth * 0.5 - paddingX + offsetX;
    const y = this.slotY - this.totalGridHeight * 0.5 - paddingY + offsetY;
    
    return {
      x: x + offsetX,
      y: y + offsetY,
      width: this.totalGridWidth + (paddingX * 2),
      height: this.totalGridHeight + (paddingY * 2)
    };
  }

  /**
   * Apply turbo mode to winline animations
   */
  public setTurboMode(isEnabled: boolean): void {
    if (this.winLineDrawer) {
      this.winLineDrawer.setTurboMode(isEnabled);
      console.log(`[Symbols] Turbo mode ${isEnabled ? 'enabled' : 'disabled'} for winline animations`);
    } else {
      console.warn('[Symbols] WinLineDrawer not available for turbo mode');
    }
  }

  /**
   * Reset winline animations to default timing
   */
  public resetWinlineTiming(): void {
    if (this.winLineDrawer) {
      this.winLineDrawer.resetToDefaultTiming();
      console.log('[Symbols] Winline timing reset to default values');
    } else {
      console.warn('[Symbols] WinLineDrawer not available for timing reset');
    }
  }

  /**
   * Ensure symbols remain visible and in their current state after autoplay is stopped
   */
  public ensureSymbolsVisibleAfterAutoplayStop(): void {
    console.log('[Symbols] Ensuring symbols remain visible after autoplay stop');
    
    // Ensure container is visible
    if (this.container) {
      this.container.setAlpha(1);
      this.container.setVisible(true);
      console.log('[Symbols] Container visibility ensured after autoplay stop');
    }
    
    // Ensure all symbols are visible
    if (this.symbols && this.symbols.length > 0) {
      let visibleCount = 0;
      for (let col = 0; col < this.symbols.length; col++) {
        for (let row = 0; row < this.symbols[col].length; row++) {
          const symbol = this.symbols[col][row];
          if (symbol && typeof symbol.setVisible === 'function') {
            symbol.setVisible(true);
            visibleCount++;
          }
        }
      }
      console.log(`[Symbols] Ensured ${visibleCount} symbols are visible after autoplay stop`);
    }
    
    // Clear any winlines that might be showing
    if (this.winLineDrawer) {
      this.winLineDrawer.clearLines();
      console.log('[Symbols] Cleared winlines after autoplay stop');
    }
    
    // Hide any winning overlay that might be showing
    this.hideWinningOverlay();
    console.log('[Symbols] Hidden winning overlay after autoplay stop');
  }

  /**
   * Trigger autoplay for free spins if available
   */
  private triggerAutoplayForFreeSpins(): void {
    // Prevent duplicate triggering - multiple checks for safety
    if (this.freeSpinAutoplayTriggered) {
      console.log('[Symbols] Free spin autoplay already triggered, skipping duplicate trigger');
      return;
    }
    
    // Additional check: if autoplay is already active, don't start another one
    if (this.freeSpinAutoplayActive) {
      console.log('[Symbols] Free spin autoplay already active, skipping duplicate trigger');
      return;
    }
    
    // Additional check: if we're not in bonus mode, don't start free spin autoplay
    if (!gameStateManager.isBonus) {
      console.log('[Symbols] Not in bonus mode, skipping free spin autoplay trigger');
      return;
    }

    let freeSpinsCount = 0;
    
    console.log('[Symbols] ===== TRIGGERING AUTOPLAY FOR FREE SPINS =====');
    console.log('[Symbols] Current state:');
    console.log('  - isBonus:', gameStateManager.isBonus);
    console.log('  - pendingFreeSpinsData:', this.pendingFreeSpinsData);
    console.log('  - currentSpinData:', this.currentSpinData);
    console.log('  - currentSpinData.slot:', this.currentSpinData?.slot);
    console.log('  - currentSpinData.slot.freespin:', this.currentSpinData?.slot?.freespin);
    console.log('  - freeSpinAutoplayActive:', this.freeSpinAutoplayActive);
    console.log('  - freeSpinAutoplayTriggered:', this.freeSpinAutoplayTriggered);
    
    // Check if we have pending free spins data (from scatter bonus activation)
    if (this.pendingFreeSpinsData) {
      // Only trust pending data if it's a positive number; otherwise, fall back to spinData
      if (this.pendingFreeSpinsData.actualFreeSpins > 0) {
        freeSpinsCount = this.pendingFreeSpinsData.actualFreeSpins;
        console.log(`[Symbols] Using pending free spins data: ${freeSpinsCount} free spins`);
        // Clear the pending data after use
        this.pendingFreeSpinsData = null;
      } else {
        console.log('[Symbols] Pending free spins data is 0; ignoring and falling back to spinData');
        // Clear to prevent blocking future detections
        this.pendingFreeSpinsData = null;
      }
    } 
    // Check if we're in bonus mode and have current spin data with free spins
    else if (gameStateManager.isBonus) {
      const fsLegacy = this.currentSpinData?.slot?.freespin?.count || 0;
      // Prefer the new format's first item's spinsLeft when available
      const fsItems = this.currentSpinData?.slot?.freeSpin?.items || this.currentSpinData?.slot?.freespin?.items || [];
      const firstItemSpinsLeft = Array.isArray(fsItems) && fsItems.length > 0 && typeof fsItems[0]?.spinsLeft === 'number'
        ? fsItems[0].spinsLeft
        : 0;
      // Fallback to items length if spinsLeft is not present
      const fsItemsLen = Array.isArray(fsItems) ? fsItems.length : 0;
      freeSpinsCount = Math.max(firstItemSpinsLeft, fsLegacy, fsItemsLen);
      if (freeSpinsCount > 0) {
        console.log(`[Symbols] Using free spins from spin data: ${freeSpinsCount} (legacy count=${fsLegacy}, firstItem.spinsLeft=${firstItemSpinsLeft}, items len=${fsItemsLen})`);
      }
    }
    
    if (freeSpinsCount > 0) {
      console.log(`[Symbols] Free spins available: ${freeSpinsCount}. Starting free spin autoplay.`);
      
      // Mark as triggered to prevent duplicates
      this.freeSpinAutoplayTriggered = true;
      
      // Start our custom free spin autoplay system
      this.startFreeSpinAutoplay(freeSpinsCount);
    } else {
      console.log('[Symbols] No free spins data available, not triggering autoplay.');
    }
    console.log('[Symbols] ===== END TRIGGERING AUTOPLAY FOR FREE SPINS =====');
  }

  /**
   * Start free spin autoplay using our custom system
   */
  private async startFreeSpinAutoplay(spinCount: number): Promise<void> {
    console.log(`[Symbols] ===== STARTING FREE SPIN AUTOPLAY =====`);
    console.log(`[Symbols] Starting free spin autoplay with ${spinCount} spins`);
    
    // Set free spin autoplay state
    this.freeSpinAutoplayActive = true;
    this.freeSpinAutoplaySpinsRemaining = spinCount;
    
    // Set global autoplay state
    gameStateManager.isAutoPlaying = true;
    gameStateManager.isAutoPlaySpinRequested = true;
    this.scene.gameData.isAutoPlaying = true;
    
    // Apply turbo mode to winline animations if turbo is enabled (same as normal autoplay)
    if (gameStateManager.isTurbo) {
      console.log('[Symbols] Applying turbo mode to winline animations for free spin autoplay');
      this.setTurboMode(true);
    }
    
    // Before starting autoplay, reset any scatter animations back to their grid positions and original scaling
    try {
      await this.resetScatterSymbolsToGrid();
    } catch (e) {
      console.warn('[Symbols] Failed to reset scatter symbols before free spin autoplay:', e);
    }
    
    // Start the first free spin immediately
    this.performFreeSpinAutoplay();
    
    console.log(`[Symbols] Free spin autoplay started with ${spinCount} spins`);
    console.log(`[Symbols] ===== FREE SPIN AUTOPLAY STARTED =====`);
  }

  /**
   * Reset scatter Spine symbols back to their original grid positions and scaling
   * so free spin autoplay starts from a clean board state.
   */
  private async resetScatterSymbolsToGrid(): Promise<void> {
    if (!this.symbols || !this.symbols.length || !this.symbols[0] || !this.symbols[0].length) {
      console.warn('[Symbols] resetScatterSymbolsToGrid: symbols grid not initialized');
      return;
    }
    
    const symbolTotalWidth = this.displayWidth + this.horizontalSpacing;
    const symbolTotalHeight = this.displayHeight + this.verticalSpacing;
    const startX = this.slotX - this.totalGridWidth * 0.5;
    const startY = this.slotY - this.totalGridHeight * 0.5;
    
    // Durations used for synchronized overlay and scatter resets
    const shrinkDuration = 350;
    const moveDuration = 500;
    
    let resetCount = 0;
    const tweenPromises: Promise<void>[] = [];
    
    for (let col = 0; col < this.symbols.length; col++) {
      for (let row = 0; row < this.symbols[col].length; row++) {
        const symbol: any = this.symbols[col][row];
        if (!symbol) continue;
        
        // Only adjust scatter spine symbols
        const isScatter = (symbol as any)?.symbolValue === 0;
        const isSpine = !!(symbol as any)?.animationState;
        if (!isSpine || !isScatter) continue;
        
        // Stop any running tweens on this symbol
        this.scene.tweens.killTweensOf(symbol);
        
        // Compute grid position
        const targetX = startX + col * symbolTotalWidth + symbolTotalWidth * 0.5;
        const targetY = startY + row * symbolTotalHeight + symbolTotalHeight * 0.5;
        
        // Set idle animation based on symbol value
        try {
          if (symbol.animationState && symbol.animationState.setAnimation) {
            const value: number | null = typeof (symbol as any).symbolValue === 'number' ? (symbol as any).symbolValue : null;
            if (value !== null && value >= 0 && value <= 9) {
              const idleAnim = `Symbol${value}_FIS_Idle`;
              try {
                symbol.animationState.setAnimation(0, idleAnim, true);
                if (symbol.animationState.timeScale !== undefined) {
                  symbol.animationState.timeScale = 1;
                }
              } catch {
                // Fallback to freezing on frame 1 if idle animation doesn't exist
                const entry = symbol.animationState.setAnimation(0, 'animation', false);
                if (entry) {
                  (entry as any).trackTime = 0;
                  if (symbol.animationState.timeScale !== undefined) {
                    symbol.animationState.timeScale = 0;
                  }
                }
              }
            } else {
              // For multipliers, freeze on frame 1
              const entry = symbol.animationState.setAnimation(0, 'animation', false);
              if (entry) {
                (entry as any).trackTime = 0;
                if (symbol.animationState.timeScale !== undefined) {
                  symbol.animationState.timeScale = 0;
                }
              }
            }
          }
        } catch {}
        
        // Ensure reasonable depth
        try { if (typeof symbol.setDepth === 'function') symbol.setDepth(600); } catch {}
        
        // Compute baseline scale (fit to box + scatter padding) without applying immediately
        let targetScale = this.getSpineSymbolScale(0);
        try {
          const prevScaleX = (symbol as any)?.scaleX ?? 1;
          const prevScaleY = (symbol as any)?.scaleY ?? 1;
          if (typeof symbol.setScale === 'function') symbol.setScale(1);
          try {
            if (symbol.skeleton && typeof symbol.skeleton.setToSetupPose === 'function') {
              symbol.skeleton.setToSetupPose();
            }
            if (symbol.updateWorldTransform) {
              symbol.updateWorldTransform();
            }
          } catch {}
          let boundsW = 0, boundsH = 0;
          try {
            if (typeof symbol.getBounds === 'function') {
              const b = symbol.getBounds();
              if (b && b.size) {
                boundsW = Math.max(1, b.size.x || b.size.width || 0);
                boundsH = Math.max(1, b.size.y || b.size.height || 0);
              }
            }
          } catch {}
          if (!boundsW || !boundsH) {
            boundsW = Math.max(1, (symbol.width as number) || 0);
            boundsH = Math.max(1, (symbol.height as number) || 0);
          }
          const fitScale = Math.min(
            Math.max(1, this.displayWidth) / boundsW,
            Math.max(1, this.displayHeight) / boundsH
          ) * 0.98;
          targetScale = isFinite(fitScale) && fitScale > 0 ? fitScale * 1.2 : targetScale;
          if (typeof symbol.setScale === 'function') symbol.setScale(prevScaleX, prevScaleY);
        } catch {}
        
        // First tween: shrink back to baseline scale at current position (center), then move back
        tweenPromises.push(new Promise<void>((resolve) => {
          this.scene.tweens.add({
            targets: symbol,
            scaleX: targetScale,
            scaleY: targetScale,
            duration: shrinkDuration,
            ease: 'Sine.easeInOut',
            onComplete: () => {
              this.scene.tweens.add({
                targets: symbol,
                x: targetX,
                y: targetY,
                duration: moveDuration,
                ease: 'Sine.easeInOut',
                onComplete: () => resolve()
              });
            }
          });
        }));
        
        resetCount++;
      }
    }
    
    await Promise.all(tweenPromises);
    console.log(`[Symbols] resetScatterSymbolsToGrid: reset ${resetCount} scatter symbols to grid and original scaling with tween`);
  }

  /**
   * Perform a single free spin autoplay
   */
  private async performFreeSpinAutoplay(): Promise<void> {
    // Check if there's a pending retrigger that will add more spins
    const hasPendingRetrigger = this.hasPendingScatterRetrigger();
    
    if (!this.freeSpinAutoplayActive || (this.freeSpinAutoplaySpinsRemaining <= 0 && !hasPendingRetrigger)) {
      if (hasPendingRetrigger) {
        console.log('[Symbols] Free spin autoplay: no spins remaining but retrigger pending - waiting for retrigger');
        // Don't stop autoplay - the retrigger will add more spins
        return;
      }
      console.log('[Symbols] Free spin autoplay stopped or no spins remaining');
      this.stopFreeSpinAutoplay();
      return;
    }

    console.log(`[Symbols] ===== PERFORMING FREE SPIN AUTOPLAY =====`);
    console.log(`[Symbols] Free spin autoplay: ${this.freeSpinAutoplaySpinsRemaining} spins remaining`);
    
    // Check if we're still in bonus mode
    if (!gameStateManager.isBonus) {
      console.log('[Symbols] No longer in bonus mode - stopping free spin autoplay');
      this.stopFreeSpinAutoplay();
      return;
    }

    // Check if win dialog is showing - pause autoplay if so
    if (gameStateManager.isShowingWinDialog) {
      console.log('[Symbols] Win dialog is showing - pausing free spin autoplay');
      // Wait for dialog animations to complete instead of using a fixed delay
      console.log('[Symbols] Waiting for dialogAnimationsComplete event before continuing free spin autoplay');
      this.scene.events.once('dialogAnimationsComplete', () => {
        console.log('[Symbols] Dialog animations complete - continuing free spin autoplay');
        // Use the same timing as normal autoplay (1000ms base with turbo multiplier)
        const baseDelay = 0;
        const turboDelay = gameStateManager.isTurbo ? 
          baseDelay * TurboConfig.TURBO_DELAY_MULTIPLIER : baseDelay;
        console.log(`[Symbols] Scheduling free spin retry in ${turboDelay}ms (base: ${baseDelay}ms, turbo: ${gameStateManager.isTurbo})`);
        this.scene.time.delayedCall(turboDelay, () => {
          this.performFreeSpinAutoplay();
        });
      });
      return;
    }

    try {
      // Use our free spin simulation instead of the old backend
      console.log('[Symbols] Triggering free spin via SlotController...');
      
      // Emit a custom event that SlotController will handle
      gameEventManager.emit(GameEventType.FREE_SPIN_AUTOPLAY);
      
      // Mark that we are awaiting reels start to safely decrement once spin actually begins
      this.freeSpinAutoplayAwaitingReelsStart = true;
      console.log('[Symbols] Awaiting REELS_START to decrement free spin counter safely');
      
      // Set flag to wait for reels to stop before continuing
      this.freeSpinAutoplayWaitingForReelsStop = true;
      console.log('[Symbols] Waiting for reels to stop before continuing free spin autoplay');
      
    } catch (error) {
      console.error('[Symbols] Free spin autoplay error:', error);
      this.stopFreeSpinAutoplay();
    }
    
    console.log(`[Symbols] ===== FREE SPIN AUTOPLAY COMPLETED =====`);
  }

  /**
   * Continue free spin autoplay after reels stop
   */
  private continueFreeSpinAutoplay(): void {
    console.log(`[Symbols] ===== CONTINUING FREE SPIN AUTOPLAY =====`);
    console.log(`[Symbols] Free spin autoplay: ${this.freeSpinAutoplaySpinsRemaining} spins remaining`);
    
    // Check if we still have spins remaining
    if (this.freeSpinAutoplaySpinsRemaining > 0) {
      // Wait for WIN_STOP event to ensure winlines complete before next spin
      // This is the same approach as normal autoplay - no safety timer needed
      console.log('[Symbols] Waiting for WIN_STOP event before continuing free spin autoplay');
      console.log('[Symbols] Setting freeSpinAutoplayWaitingForWinlines to true');
      this.freeSpinAutoplayWaitingForWinlines = true;
      console.log('[Symbols] freeSpinAutoplayWaitingForWinlines is now:', this.freeSpinAutoplayWaitingForWinlines);
    } else {
      // Check if there's a pending retrigger before stopping autoplay
      if (this.hasPendingScatterRetrigger()) {
        console.log('[Symbols] All free spins completed but retrigger pending - NOT stopping autoplay yet');
        // Don't stop autoplay - the retrigger will add more spins
      } else {
        console.log('[Symbols] All free spins completed');
        // Ensure end-of-bonus flow can proceed even if SlotController's REELS_STOP
        // handler doesn't run first (listener ordering) or fails to mark it.
        // This prevents the bonus from getting stuck at 0 remaining spins without Congrats.
        try {
          if (gameStateManager.isBonus) {
            console.log('[Symbols] Marking bonus finished (no free spins remaining)');
            gameStateManager.isBonusFinished = true;
          }
        } catch {}
        this.stopFreeSpinAutoplay();
      }
    }
    
    console.log(`[Symbols] ===== FREE SPIN AUTOPLAY CONTINUED =====`);
  }

  /**
   * Handle WIN_STOP for free spin autoplay (similar to normal autoplay)
   */
  private handleFreeSpinAutoplayWinStop(): void {
    console.log('[Symbols] handleFreeSpinAutoplayWinStop called - freeSpinAutoplayWaitingForWinlines:', this.freeSpinAutoplayWaitingForWinlines);
    if (!this.freeSpinAutoplayWaitingForWinlines) {
      console.log('[Symbols] Not waiting for winlines - skipping free spin autoplay continuation');
      return;
    }

    console.log('[Symbols] WIN_STOP received - continuing free spin autoplay after winlines complete');
    this.freeSpinAutoplayWaitingForWinlines = false;
    
    // Clear any existing timer since WIN_STOP fired properly
    if (this.freeSpinAutoplayTimer) {
      this.freeSpinAutoplayTimer.destroy();
      this.freeSpinAutoplayTimer = null;
    }
    
    // Use the same timing as normal autoplay (500ms base with turbo multiplier)
    const baseDelay = 500;
    const turboDelay = gameStateManager.isTurbo ? 
      baseDelay * TurboConfig.TURBO_DELAY_MULTIPLIER : baseDelay;
    console.log(`[Symbols] Scheduling next free spin in ${turboDelay}ms (base: ${baseDelay}ms, turbo: ${gameStateManager.isTurbo})`);
    
    this.freeSpinAutoplayTimer = this.scene.time.delayedCall(turboDelay, () => {
      this.performFreeSpinAutoplay();
    });
  }

  /**
   * Wait until no dialogs are showing anymore, then resume free spin autoplay.
   * This will tolerate multiple back-to-back dialogs (e.g., queued win dialogs).
   */
  private waitForAllDialogsToCloseThenResume(): void {
    const gameScene: any = this.scene as any;
    const dialogs = gameScene?.dialogs;

    // Defer the initial check to the next tick so Game.ts can process the event
    this.scene.time.delayedCall(0, () => {
      const anyDialogShowing = !!(dialogs && typeof dialogs.isDialogShowing === 'function' && dialogs.isDialogShowing());
      const winDialogShowing = !!gameStateManager.isShowingWinDialog;

      if (anyDialogShowing || winDialogShowing) {
        console.log('[Symbols] Waiting for all dialogs to close before resuming free spin autoplay...');
        this.scene.events.once('dialogAnimationsComplete', () => {
          // After a dialog closes, check again in case there are more queued
          this.waitForAllDialogsToCloseThenResume();
        });
        return;
      }

      // No dialog showing right now. Listen for a newly shown dialog within a grace window.
      let settled = false;
      const onDialogShown = () => {
        if (settled) return;
        settled = true;
        console.log('[Symbols] A dialog was shown during grace window - waiting for it to close');
        this.scene.events.once('dialogAnimationsComplete', () => {
          this.waitForAllDialogsToCloseThenResume();
        });
      };

      this.scene.events.once('dialogShown', onDialogShown);

      // Grace window for a subsequently queued dialog to appear
      this.scene.time.delayedCall(0, () => {
        if (settled) return;
        const showingNow = !!(dialogs && typeof dialogs.isDialogShowing === 'function' && dialogs.isDialogShowing());
        const winNow = !!gameStateManager.isShowingWinDialog;
        if (showingNow || winNow) {
          settled = true;
          console.log('[Symbols] Dialog detected at end of grace window - continuing to wait');
          this.waitForAllDialogsToCloseThenResume();
          return;
        }
        // All dialogs closed and none appeared in the grace window; resume autoplay
        settled = true;
        this.scene.time.delayedCall(120, () => this.performFreeSpinAutoplay());
      });
    });
  }

  /**
   * Schedule congrats dialog after free spin autoplay ends
   * Waits for any win dialogs to auto-close (2.5s) plus additional buffer time
   */
  private scheduleCongratsDialogAfterAutoplay(): void {
    console.log('[Symbols] Scheduling congrats dialog after free spin autoplay ends');

    const gameScene = this.scene as any;
    const dialogs = gameScene.dialogs;

    // Helper to detect if a win dialog is currently active
    const isWinDialogActive = (): boolean => {
      try {
        const hasDialog =
          dialogs &&
          typeof dialogs.isDialogShowing === 'function' &&
          dialogs.isDialogShowing();
        const isWin =
          hasDialog &&
          typeof dialogs.isWinDialog === 'function' &&
          dialogs.isWinDialog();
        const flagWin = !!gameStateManager.isShowingWinDialog;
        return (!!isWin) || flagWin;
      } catch {
        return !!gameStateManager.isShowingWinDialog;
      }
    };

    // If a win dialog is already active at the moment bonus autoplay ends,
    // don't schedule congrats here – the global WIN_DIALOG_CLOSED handler
    // will show congrats once the win dialog auto-closes / is clicked.
    if (isWinDialogActive()) {
      console.log('[Symbols] Win dialog already active at bonus end - deferring congrats to WIN_DIALOG_CLOSED handler');
      return;
    }

    // Otherwise, wait a short grace window to see if a win dialog appears.
    // If a win dialog shows within this window, we again defer to WIN_DIALOG_CLOSED.
    // If no win dialog appears, we show congrats directly after the grace period.
    let settled = false;

    const onDialogShown = (dialogType?: string) => {
      if (settled) return;

      const type = (dialogType || '').toString();
      const looksLikeWinDialog =
        type === 'BigWin_Dialog' ||
        type === 'MegaWin_Dialog' ||
        type === 'EpicWin_Dialog' ||
        type === 'SuperWin_Dialog';

      if (!looksLikeWinDialog) {
        return;
      }

      console.log('[Symbols] Win dialog shown during congrats grace window - deferring to WIN_DIALOG_CLOSED handler');
      settled = true;
      this.scene.events.off('dialogShown', onDialogShown);
      // No further action: WIN_DIALOG_CLOSED listener will call showCongratsDialogAfterDelay().
    };

    this.scene.events.on('dialogShown', onDialogShown);

    // Grace window duration (ms) for a potential win dialog to appear
    const graceMs = 1200;

    this.scene.time.delayedCall(graceMs, () => {
      if (settled) {
        return;
      }

      this.scene.events.off('dialogShown', onDialogShown);

      if (isWinDialogActive()) {
        console.log('[Symbols] Win dialog became active during grace window - congrats will be shown on WIN_DIALOG_CLOSED');
        return;
      }

      // Robust end-of-bonus detection:
      // - Prefer the explicit flag when set
      // - Fallback to checking current spin data remaining spins, to avoid rare cases where the
      //   flag isn't set/gets cleared and the game gets stuck at 0 remaining spins.
      let shouldShowCongrats = false;
      try {
        if (gameStateManager.isBonusFinished) {
          shouldShowCongrats = true;
        } else if (gameStateManager.isBonus && !this.hasPendingScatterRetrigger()) {
          const fsData = this.currentSpinData?.slot?.freespin || this.currentSpinData?.slot?.freeSpin;
          const items = Array.isArray(fsData?.items) ? fsData.items : [];
          const totalRemaining = items.reduce((sum: number, it: any) => sum + (Number(it?.spinsLeft) || 0), 0);
          if (totalRemaining <= 0) {
            console.log('[Symbols] Derived bonus end from spinData (0 spinsLeft) - forcing congrats');
            shouldShowCongrats = true;
          }
        }
      } catch {}

      if (shouldShowCongrats) {
        console.log('[Symbols] Grace window expired with no win dialog - showing congrats now');
        this.showCongratsDialogAfterDelay();
        // Clear the flag so we don't double-trigger via other listeners.
        try { gameStateManager.isBonusFinished = false; } catch {}
      } else {
        console.log('[Symbols] Skipping scheduled congrats - bonus not finished');
      }
    });
  }

  /**
   * Show congrats dialog after the delay period
   */
  private async showCongratsDialogAfterDelay(): Promise<void> {
    console.log('[Symbols] Showing congrats dialog after delay');
    
    // Wait for scatter retrigger animation to complete if it's in progress
    if (this.scatterRetriggerAnimationInProgress) {
      console.log('[Symbols] Scatter retrigger animation in progress - waiting for retrigger dialog to close before showing congrats dialog');
      await new Promise<void>((resolve) => {
        // Wait for the retrigger dialog to close (dialogAnimationsComplete)
        this.scene.events.once('dialogAnimationsComplete', () => {
          console.log('[Symbols] Retrigger dialog closed - proceeding with congrats dialog');
          resolve();
        });
      });
    }
    
    // Wait for multiplier animations to complete if they're in progress
    if (this.multiplierAnimationsInProgress) {
      console.log('[Symbols] Multiplier animations in progress - waiting for MULTIPLIER_ANIMATIONS_COMPLETE before showing congrats dialog');
      await new Promise<void>((resolve) => {
        gameEventManager.once(GameEventType.MULTIPLIER_ANIMATIONS_COMPLETE, () => {
          console.log('[Symbols] MULTIPLIER_ANIMATIONS_COMPLETE received - proceeding with congrats dialog');
          resolve();
        });
      });
    } else if (this.multiplierAnimationsPromise) {
      console.log('[Symbols] Waiting for multiplier animations promise to complete before showing congrats dialog');
      try {
        await this.multiplierAnimationsPromise;
        console.log('[Symbols] Multiplier animations completed, proceeding with congrats dialog');
      } catch (e) {
        console.warn('[Symbols] Error waiting for multiplier animations:', e);
      }
    }
    
    // Close any open win dialogs first (safety check)
    const gameScene = this.scene as any;
    if (gameScene.dialogs && typeof gameScene.dialogs.hideDialog === 'function') {
      if (gameScene.dialogs.isDialogShowing()) {
        console.log('[Symbols] Closing any remaining win dialogs before showing congrats');
        gameScene.dialogs.hideDialog();
      }
    }
    
    // Priority 1: Use the authoritative totalWin from the spinData response (freespin.totalWin)
    // This is the backend's calculated total and should always be used when available
    let totalWin = 0;
    try {
      if (this.currentSpinData && this.currentSpinData.slot) {
        const freespinData = this.currentSpinData.slot.freespin || this.currentSpinData.slot.freeSpin;
        if (freespinData && typeof freespinData.totalWin === 'number' && freespinData.totalWin > 0) {
          totalWin = freespinData.totalWin;
          console.log(`[Symbols] Using freespin.totalWin from spinData response for congrats: ${totalWin}`);
        }
      }
    } catch (e) {
      console.warn('[Symbols] Failed to read freespin.totalWin from spinData, trying fallbacks', e);
    }

    // Priority 2: Fallback to BonusHeader cumulative total if spinData totalWin not available
    if (totalWin === 0) {
      try {
        const bonusHeader = (gameScene as any)?.bonusHeader;
        if (bonusHeader) {
          // Use the internal cumulative tracker if available; this includes the
          // scatter trigger win plus all per-spin bonus wins.
          if (typeof bonusHeader.getCumulativeBonusWin === 'function') {
            const cumulativeTotal = Number(bonusHeader.getCumulativeBonusWin()) || 0;
            if (cumulativeTotal > 0) {
              totalWin = cumulativeTotal;
              console.log(`[Symbols] Using BonusHeader cumulative bonus total for congrats (fallback): ${totalWin}`);
            }
          } else if (typeof bonusHeader.getCurrentWinnings === 'function') {
            // Backward compatibility: fall back to whatever the bonus header is currently showing
            const headerTotal = Number(bonusHeader.getCurrentWinnings()) || 0;
            if (headerTotal > 0) {
              totalWin = headerTotal;
              console.log(`[Symbols] Using BonusHeader current winnings for congrats total (legacy fallback): ${totalWin}`);
            }
          }
        }
      } catch (e) {
        console.warn('[Symbols] Failed to read BonusHeader winnings for congrats, trying final fallback', e);
      }
    }

    // Priority 3: Final fallback - calculate total win from freespinItems if neither above worked
    if (totalWin === 0 && this.currentSpinData && this.currentSpinData.slot) {
      const freespinData = this.currentSpinData.slot.freespin || this.currentSpinData.slot.freeSpin;
      if (freespinData && freespinData.items && Array.isArray(freespinData.items)) {
        totalWin = freespinData.items.reduce((sum: number, item: any) => {
          const perSpinTotal =
            (typeof item.totalWin === 'number' && item.totalWin > 0)
              ? item.totalWin
              : (item.subTotalWin || 0);
          return sum + perSpinTotal;
        }, 0);
        console.log(`[Symbols] Calculated total win from freespinItems (final fallback, per-spin totalWin/subTotalWin): ${totalWin}`);
      }
    }
    
    // Derive how many free spins were used for this bonus (total spins played, including retriggers)
    let freeSpinCount = 0;
    try {
      if (this.currentSpinData && this.currentSpinData.slot) {
        const freespinData = this.currentSpinData.slot.freespin || this.currentSpinData.slot.freeSpin;
        if (freespinData) {
          // Prefer explicit count if present and > 0 (often original total from API)
          if (typeof freespinData.count === 'number' && freespinData.count > 0) {
            freeSpinCount = freespinData.count;
            console.log(`[Symbols] Using freespin.count for congrats free spin total: ${freeSpinCount}`);
          } else if (Array.isArray(freespinData.items)) {
            // Fallback: use number of free spin items as "spins taken"
            freeSpinCount = freespinData.items.length;
            console.log(`[Symbols] Using freespin.items.length for congrats free spin total: ${freeSpinCount}`);
          }
        }
      }
    } catch (e) {
      console.warn('[Symbols] Failed to derive freespin count for congrats display', e);
    }

    // Show congrats dialog with total win amount and free spin count (if available)
    if (gameScene.dialogs && typeof gameScene.dialogs.showCongrats === 'function') {
      const dialogConfig: any = { winAmount: totalWin };
      if (freeSpinCount > 0) {
        dialogConfig.freeSpins = freeSpinCount;
      }
      gameScene.dialogs.showCongrats(this.scene, dialogConfig);
      console.log(`[Symbols] Congrats dialog shown with total win: ${totalWin}, freeSpins: ${freeSpinCount}`);
    } else {
      console.warn('[Symbols] Dialogs component not available for congrats dialog');
    }
  }

  /**
   * Stop free spin autoplay
   */
  private stopFreeSpinAutoplay(): void {
    console.log('[Symbols] ===== STOPPING FREE SPIN AUTOPLAY =====');
    
    // Clear timer
    if (this.freeSpinAutoplayTimer) {
      this.freeSpinAutoplayTimer.destroy();
      this.freeSpinAutoplayTimer = null;
    }
    
    // Reset state
    this.freeSpinAutoplayActive = false;
    this.freeSpinAutoplaySpinsRemaining = 0;
    this.freeSpinAutoplayWaitingForReelsStop = false;
    this.freeSpinAutoplayWaitingForWinlines = false;
    this.freeSpinAutoplayTriggered = false;
    this.freeSpinAutoplayAwaitingReelsStart = false;
    this.dialogListenerSetup = false; // Reset dialog listener setup flag
    
    // Reset global autoplay state
    gameStateManager.isAutoPlaying = false;
    gameStateManager.isAutoPlaySpinRequested = false;
    
    // Show congrats dialog after free spin autoplay ends
    this.scheduleCongratsDialogAfterAutoplay();
    this.scene.gameData.isAutoPlaying = false;
    
    // Restore winline animation timing to normal mode (same as normal autoplay)
    console.log('[Symbols] Restoring winline animation timing to normal mode');
    this.setTurboMode(false);
    
    // Emit AUTO_STOP event to notify other systems
    gameEventManager.emit(GameEventType.AUTO_STOP);
    
    console.log('[Symbols] Free spin autoplay stopped');
    console.log('[Symbols] ===== FREE SPIN AUTOPLAY STOPPED =====');
  }

  /**
   * Check if free spin autoplay is currently active
   */
  public isFreeSpinAutoplayActive(): boolean {
    return this.freeSpinAutoplayActive;
  }

  /**
   * Process spin data directly (for free spin autoplay)
   */
  public async processSpinData(spinData: any): Promise<void> {
    console.log('[Symbols] Processing spin data directly:', spinData);
    
    if (!spinData || !spinData.slot || !spinData.slot.area) {
      console.error('[Symbols] Invalid SpinData received - missing slot.area');
      return;
    }
    
    // Store the current spin data for access by other components
    this.currentSpinData = spinData;
    console.log('[Symbols] Stored current spin data for access by other components');
    
    // Use the slot.area from SpinData
    const symbols = spinData.slot.area;
    console.log('[Symbols] Using symbols from SpinData slot.area:', symbols);
    
    // Process the symbols using the same logic as before
    await processSpinDataSymbols(this, symbols, spinData);
  }
}

// preload()
function initVariables(self: Symbols) {
  let centerX = self.scene.scale.width * 0.5 - 5;
  let centerY = self.scene.scale.height * 0.405;

  self.symbols = [];
  self.newSymbols = [];
  self.displayWidth = 55;
  self.displayHeight = 55;
  self.horizontalSpacing = 8;
  self.verticalSpacing = 3;

  let spacingX = self.horizontalSpacing * (SLOT_ROWS - 1);
  let spacingY = self.verticalSpacing * (SLOT_COLUMNS - 1);
  self.totalGridWidth = (self.displayWidth * SLOT_ROWS) + spacingX;
  self.totalGridHeight = (self.displayHeight * SLOT_COLUMNS) + spacingY;

  self.slotX = centerX;
  self.slotY = centerY;
}

function createContainer(self: Symbols) {
  self.container = self.scene.add.container(0, 0);

  const maskShape = self.scene.add.graphics();
  
  // --- Reel container frame corner mask tuning ---
  // Toggle this to visually debug the mask shape (100% opacity).
  // When false, the mask still applies but the graphics won't render.
  const DEBUG_REEL_CONTAINER_MASK = false;
  // Adjust this to move the entire mask up/down to line up with `reel-container-frame`.
  const REEL_CONTAINER_MASK_Y_OFFSET = 0;
  // Size (in px) of the diagonal corner cut.
  const REEL_CONTAINER_CORNER_CUT = 28;

  // Add padding to prevent sprite cutoff, especially on the right side
  const maskPaddingLeft = 20;
  const maskPaddingRight = 30;
  const maskPaddingTop = 12;
  const maskPaddingBottom = 28;
  
  const maskX =
    self.slotX - self.totalGridWidth * 0.5 - maskPaddingLeft;
  const maskY =
    self.slotY - self.totalGridHeight * 0.5 - maskPaddingTop + REEL_CONTAINER_MASK_Y_OFFSET;
  const maskW =
    self.totalGridWidth + maskPaddingLeft + maskPaddingRight;
  const maskH =
    self.totalGridHeight + maskPaddingTop + maskPaddingBottom;

  // Build an octagon (rectangle with chamfered corners) to match the reel-container-frame cut corners.
  const cut = Math.max(0, Math.min(REEL_CONTAINER_CORNER_CUT, Math.min(maskW, maskH) * 0.5));

  maskShape.clear();
  maskShape.fillStyle(0xff00ff, 1);
  maskShape.beginPath();
  maskShape.moveTo(maskX + cut, maskY);
  maskShape.lineTo(maskX + maskW - cut, maskY);
  maskShape.lineTo(maskX + maskW, maskY + cut);
  maskShape.lineTo(maskX + maskW, maskY + maskH - cut);
  maskShape.lineTo(maskX + maskW - cut, maskY + maskH);
  maskShape.lineTo(maskX + cut, maskY + maskH);
  maskShape.lineTo(maskX, maskY + maskH - cut);
  maskShape.lineTo(maskX, maskY + cut);
  maskShape.closePath();
  maskShape.fillPath();

  const mask = maskShape.createGeometryMask();
  self.container.setMask(mask);
  maskShape.setVisible(DEBUG_REEL_CONTAINER_MASK);
  if (DEBUG_REEL_CONTAINER_MASK) {
    // Ensure it's easy to see while tweaking.
    maskShape.setDepth(10_000);
    maskShape.setAlpha(1);

    // Optional helper overlay: shows the corner cut "rectangles" angled toward the center,
    // without affecting the actual mask geometry.
    const debugOutline = self.scene.add.graphics();
    debugOutline.setDepth(10_001);
    debugOutline.setAlpha(1);
    debugOutline.lineStyle(2, 0x00ff00, 1);
    debugOutline.strokeRect(maskX, maskY, maskW, maskH);

    const rectW = cut * 1.35;
    const rectH = Math.max(4, cut * 0.35);
    const rectColor = 0xff0000;
    const rectAlpha = 1;

    // Angles are in degrees; rectangles are rotated so they "point" toward the center.
    const tl = self.scene.add.rectangle(maskX + cut * 0.5, maskY + cut * 0.5, rectW, rectH, rectColor, rectAlpha);
    tl.setOrigin(0.5, 0.5).setRotation(Phaser.Math.DegToRad(45)).setDepth(10_002);

    const tr = self.scene.add.rectangle(maskX + maskW - cut * 0.5, maskY + cut * 0.5, rectW, rectH, rectColor, rectAlpha);
    tr.setOrigin(0.5, 0.5).setRotation(Phaser.Math.DegToRad(135)).setDepth(10_002);

    const bl = self.scene.add.rectangle(maskX + cut * 0.5, maskY + maskH - cut * 0.5, rectW, rectH, rectColor, rectAlpha);
    bl.setOrigin(0.5, 0.5).setRotation(Phaser.Math.DegToRad(-45)).setDepth(10_002);

    const br = self.scene.add.rectangle(maskX + maskW - cut * 0.5, maskY + maskH - cut * 0.5, rectW, rectH, rectColor, rectAlpha);
    br.setOrigin(0.5, 0.5).setRotation(Phaser.Math.DegToRad(-135)).setDepth(10_002);
  }
  
  console.log(
    `[Symbols] Reel mask created (chamfered corners). ` +
      `Padding L:${maskPaddingLeft} R:${maskPaddingRight} T:${maskPaddingTop} B:${maskPaddingBottom}, ` +
      `cornerCut:${cut}, yOffset:${REEL_CONTAINER_MASK_Y_OFFSET}, debug:${DEBUG_REEL_CONTAINER_MASK}`
  );
}

function onStart(self: Symbols) {
  console.log('[Symbols] onStart called');
  
  // Listen for START event to create initial symbols
  gameEventManager.on(GameEventType.START, () => {
    console.log('[Symbols] START event received, creating initial symbols...');
    
    // Create initial symbols with default data
    createInitialSymbols(self);
    // Initialize scatter counter from the live initial grid
    try { self.recalcScatterOnScreenCountFromGrid('initial_grid'); } catch {}

    // Kick off idle state (Spine idle if available + tween-based float fallback)
    try {
      if ((self as any).resumeIdleAnimationsForAllSymbols) {
        (self as any).resumeIdleAnimationsForAllSymbols();
      } else if ((self as any).startIdleFloatForAllSymbols) {
        (self as any).startIdleFloatForAllSymbols();
      }
    } catch {}
  });
}

function createInitialSymbols(self: Symbols) {
  let scene = self.scene;

  // Check if spine assets are available (for symbols 0-12)
  const testSpineKey = 'symbol_0_spine';
  const cacheJson: any = scene.cache.json;
  const hasSpine = cacheJson && cacheJson.has(testSpineKey);
  
  if (!hasSpine) {
    console.warn('[Symbols] Spine assets not loaded yet. Will attempt to create symbols anyway.');
    console.log('[Symbols] Available json cache keys:', cacheJson ? Object.keys(cacheJson.entries || {}) : 'no cache');
  } else {
    console.log('[Symbols] Spine assets are available');
  }

  // Use fixed symbols for testing (row-major: [row][col])
  const initialRowMajor = [
    [0, 1, 3, 1, 0, 2],
    [1, 5, 2, 5, 2, 4],
    [2, 5, 5, 1, 5, 3],
    [3, 4, 1, 2, 4, 1],
    [4, 2, 0, 3, 1, 5],
  ];
  console.log('[Symbols] Using fixed initial symbols (row-major):', initialRowMajor);
  
  // Store current symbol data for reset purposes (keep row-major for tumble logic)
  self.currentSymbolData = initialRowMajor;
  
  const symbolTotalWidth = self.displayWidth + self.horizontalSpacing;
  const symbolTotalHeight = self.displayHeight + self.verticalSpacing;

  const startX = self.slotX - self.totalGridWidth * 0.5;
  const startY = self.slotY - self.totalGridHeight * 0.5;
  
  const rowCount = initialRowMajor.length;      // 5 rows
  const colCount = initialRowMajor[0].length;   // 6 columns
  
  // Build symbols as column-major [col][row] for rendering
  for (let col = 0; col < colCount; col++) {
    let rows: any[] = [];
    for (let row = 0; row < rowCount; row++) {
      const x = startX + col * symbolTotalWidth + symbolTotalWidth * 0.5;
      const y = startY + row * symbolTotalHeight + symbolTotalHeight * 0.5;

      const value = initialRowMajor[row][col];
      const created = createSugarOrPngSymbol(self, value, x, y, 1);
      rows.push(created);
    }
    self.symbols.push(rows);
  }
  console.log('[Symbols] Initial symbols created successfully');
}

/**
 * Process symbols from SpinData (GameAPI response)
 */
async function processSpinDataSymbols(self: Symbols, symbols: number[][], spinData: any) {
  console.log('[Symbols] Processing SpinData symbols:', symbols);
  
  // Reset per-item win tracker
  try { (self as any).hadWinsInCurrentItem = false; } catch {}

  // Clear all scatter symbols from previous spin
  if (self.scatterAnimationManager) {
    self.scatterAnimationManager.clearScatterSymbols();
  }
  
  // Reset symbols and clear previous state before starting new spin
    console.log('[Symbols] Resetting symbols and clearing previous state for new spin');
    self.ensureCleanSymbolState();
    self.resetSymbolsState();
    // Note: tumble-only anticipation behavior is handled inside applySingleTumble; we do not use
    // any "3 scatters slow-mode" flag anymore.
    // __slowDropRowChain is no longer used (slow-mode is handled inside dropNewSymbols)
    // Reset per-spin "scatter started dropping" counter (used to trigger slow-mode on 3rd scatter drop-start)
    try { (self as any).__scatterStartedThisDrop = 0; } catch {}
    // Reset live scatter-on-screen counter for the new spin drop; it will be rebuilt as drops complete.
    try { self.resetScatterOnScreenCount('spin_start'); } catch {}
    
    // Always clear win lines and overlay when a new spin starts
    console.log('[Symbols] Clearing win lines and overlay for new spin');
    self.clearWinLines();
    self.hideWinningOverlay();
    
    self.resetSymbolDepths();
    self.restoreSymbolVisibility();
  
  // Create a mock Data object to use with existing functions (wins/winlines no longer used)
  const mockData = new Data();
  mockData.symbols = symbols;
  mockData.balance = 0; // Not used in symbol processing
  mockData.bet = parseFloat(spinData.bet);
  mockData.freeSpins = (
    (spinData?.slot?.freeSpin?.items && Array.isArray(spinData.slot.freeSpin.items))
      ? spinData.slot.freeSpin.items.length
      : (spinData?.slot?.freespin?.count || 0)
  );
  
  // Set proper timing for animations
  const baseDelay = DELAY_BETWEEN_SPINS; // 2500ms default
  const adjustedDelay = gameStateManager.isTurbo ? 
    baseDelay * TurboConfig.TURBO_SPEED_MULTIPLIER : baseDelay;
  
  console.log('[Symbols] Setting animation timing:', {
    baseDelay,
    isTurbo: gameStateManager.isTurbo,
    adjustedDelay
  });
  
  // Set the timing in the mock data
  mockData.delayBetweenSpins = adjustedDelay;
  
  // Apply timing to GameData for animations
  setSpeed(self.scene.gameData, adjustedDelay);
  
  // Set spinning state
  gameStateManager.isReelSpinning = true;
  
  // Use the existing createNewSymbols function
  createNewSymbols(self, mockData);
  
  // Use the existing dropReels function
  await dropReels(self, mockData);
  
  // Update symbols after animation
    disposeSymbols(self.symbols);
    self.symbols = self.newSymbols;
    self.newSymbols = [];
    // Safety: ensure counter matches the final landed grid after the full drop
    try { self.recalcScatterOnScreenCountFromGrid('post_drop_grid'); } catch {}
  
  // Re-evaluate wins after initial drop completes using tumble data only.
  // Legacy winline/payline-based checking has been removed for this game.
  try {
    const tumblesFromSpin = spinData?.slot?.tumbles;
    let winsFromSpin = false;
    if (Array.isArray(tumblesFromSpin) && tumblesFromSpin.length > 0) {
      winsFromSpin = tumblesFromSpin.some((t: any) => {
        const outArr = Array.isArray(t?.symbols?.out) ? t.symbols.out as Array<{ count?: number; win?: number }> : [];
        const hasOut = outArr.some(o => (Number(o?.count) || 0) > 0);
        const hasWin = Number(t?.win) > 0;
        return hasOut || hasWin;
      });
    }
    if (winsFromSpin) {
      (self as any).hadWinsInCurrentItem = true;
    }
  } catch {}

  // Apply tumble steps if provided by backend
  try {
    const tumbles = spinData?.slot?.tumbles;
    if (Array.isArray(tumbles) && tumbles.length > 0) {
      console.log(`[Symbols] Applying ${tumbles.length} tumble step(s) from SpinData`);
      await applyTumbles(self, tumbles);
      console.log('[Symbols] Tumbles applied');
    }
  } catch (e) {
    console.warn('[Symbols] Failed applying tumbles:', e);
  }

  // Replace with spine animations if needed (disabled while using symbol-count logic)
  if (!(Symbols as any).WINLINE_CHECKING_DISABLED) {
    replaceWithSpineAnimations(self, mockData);
  }
  
  
  
  // Check for scatter symbols and trigger scatter bonus if found
  console.log('[Symbols] Checking for scatter symbols...');
  
  // Build scatter data from live grid if tumbles were applied, otherwise use mockData
  // This ensures we detect scatter that appears during tumbles
  const tumbles = spinData?.slot?.tumbles;
  const hadTumbles = Array.isArray(tumbles) && tumbles.length > 0;
  
  let symbolsForScatter: number[][];
  if (hadTumbles) {
    // Extract symbol values from live grid after tumbles
    console.log('[Symbols] Extracting symbols from live grid after tumbles for scatter detection');
    symbolsForScatter = [];
    if (self.symbols && self.symbols.length > 0) {
      const numRows = self.symbols[0]?.length || 0;
      for (let row = 0; row < numRows; row++) {
        symbolsForScatter[row] = [];
        for (let col = 0; col < self.symbols.length; col++) {
          const obj: any = self.symbols[col]?.[row];
          if (obj) {
            // Extract symbol value from the object
            const symbolValue = (obj as any)?.symbolValue ?? 
                               (obj?.texture?.key?.startsWith('symbol_') ? 
                                parseInt(obj.texture.key.replace('symbol_', '')) : -1);
            symbolsForScatter[row][col] = symbolValue;
          } else {
            symbolsForScatter[row][col] = -1; // Empty cell
          }
        }
      }
    }
    console.log('[Symbols] Extracted symbols from live grid:', symbolsForScatter);
  } else {
    // Use mockData symbols (transpose from [col][row] to [row][col] format)
    console.log('[Symbols] Using MockData symbols for scatter detection:', mockData.symbols);
    symbolsForScatter = [];
    for (let row = 0; row < mockData.symbols[0].length; row++) {
      symbolsForScatter[row] = [];
      for (let col = 0; col < mockData.symbols.length; col++) {
        // Invert vertical order when transposing: SpinData area uses bottom->top
        const colLen = mockData.symbols[col].length;
        symbolsForScatter[row][col] = mockData.symbols[col][colLen - 1 - row];
      }
    }
    console.log('[Symbols] Transposed symbols for scatter detection:', symbolsForScatter);
  }
  
  // Create a temporary Data object for scatter detection
  const scatterData = new Data();
  scatterData.symbols = symbolsForScatter;
  
  const scatterGrids = self.symbolDetector.getScatterGrids(scatterData);
  console.log('[Symbols] ScatterGrids found:', scatterGrids);
  console.log('[Symbols] ScatterGrids length:', scatterGrids.length);
  
  // IMPORTANT:
  // Do NOT set gameStateManager.isShowingWinDialog here.
  // That flag must only reflect an ACTUAL visible win dialog (Dialogs component controls it).
  // Setting it preemptively can deadlock autoplay (SlotController waits for WIN_DIALOG_CLOSED
  // that will never fire if no dialog is shown).
  try {
    const tumblesArr: any[] = Array.isArray((spinData.slot as any)?.tumbles) ? (spinData.slot as any).tumbles : [];
    const totalWinFromTumbles = tumblesArr.reduce((sum: number, t: any) => sum + (Number(t?.win) || 0), 0);
    const betAmount = parseFloat(String(spinData.bet));
    const multiplier = betAmount > 0 ? (totalWinFromTumbles / betAmount) : 0;
    console.log(`[Symbols] Tumble win multiplier (for logging only): ${multiplier.toFixed(2)}x (totalWinFromTumbles=${totalWinFromTumbles}, bet=${betAmount})`);
  } catch (e) {
    console.warn('[Symbols] Failed to compute tumble win multiplier for logging:', e);
  }

  // Ignore paylines entirely — use tumble (cluster) wins to drive WinTracker
  if (self.winLineDrawer) {
    // Defer WinTracker display to align with when win text appears (see delayedCall below)
  } else {
    // Same behavior when win line drawer isn't present
    // Defer WinTracker display to align with when win text appears (see delayedCall below)
  }

  // NOW handle scatter symbols AFTER winlines are drawn
  const isRetrigger = gameStateManager.isBonus && scatterGrids.length >= 3;

  // Buy Feature / backend-driven free spins:
  // If SpinData indicates we are awarding free spins, we should trigger the scatter
  // intro even if scatter-grid detection disagrees (e.g. due to layout/orientation changes).
  let hasFreeSpinAwardFromSpinData = false;
  try {
    const fsData: any = (spinData as any)?.slot?.freeSpin || (spinData as any)?.slot?.freespin;
    const items = Array.isArray(fsData?.items) ? fsData.items : [];
    const count = Number(fsData?.count || 0);
    const spinsLeft = Number(items?.[0]?.spinsLeft ?? fsData?.spinsLeft ?? 0);
    hasFreeSpinAwardFromSpinData = items.length > 0 || count > 0 || spinsLeft > 0;
  } catch {}

  const shouldTriggerScatter =
    isRetrigger ||
    scatterGrids.length >= 4 ||
    (!gameStateManager.isBonus && hasFreeSpinAwardFromSpinData);

  if (shouldTriggerScatter) {
    console.log(`[Symbols] Scatter detected! Found ${scatterGrids.length} scatter symbols`);
    gameStateManager.isScatter = true;

    // Compute scatter base payout and update winnings display(s)
    try {
      const scatterCount = scatterGrids.length;
      // Payout mapping (multiplier on bet): 4 -> 3x, 5 -> 5x, 6+ -> 100x
      const betAmount = parseFloat(String(spinData.bet));
      const scatterMultiplier =
        scatterCount >= 6 ? 100 :
        scatterCount === 5 ? 5 :
        scatterCount === 4 ? 3 : 0;
      const scatterBaseWin = (isNaN(betAmount) ? 0 : betAmount) * scatterMultiplier;
      
      // Do not include paylines in total; base scatter only
      const totalForHeader = (scatterBaseWin || 0);
      
      // Update normal header winnings display immediately on scatter trigger
      try {
        const header = (self.scene as any)?.header;
        if (header && typeof header.showWinningsDisplay === 'function' && totalForHeader > 0) {
          header.showWinningsDisplay(totalForHeader);
          console.log(`[Symbols] Header winnings updated for scatter: base=$${scatterBaseWin}, total=$${totalForHeader}`);
        }
      } catch (e) {
        console.warn('[Symbols] Failed to update Header winnings for scatter', e);
      }
      
      // Update bonus header cumulative total with scatter base amount
      try {
        const bonusHeader = (self.scene as any)?.bonusHeader;
        if (bonusHeader && totalForHeader > 0) {
          if (isRetrigger) {
            // For retriggers, add to existing cumulative total instead of resetting
            if (typeof bonusHeader.addToCumulativeWin === 'function') {
              bonusHeader.addToCumulativeWin(totalForHeader);
              console.log(`[Symbols] BonusHeader added scatter retrigger win: $${totalForHeader} (added to cumulative)`);
            }
          } else {
            // Initial scatter trigger: seed the cumulative total
            if (typeof bonusHeader.seedCumulativeWin === 'function') {
              bonusHeader.seedCumulativeWin(totalForHeader);
              console.log(`[Symbols] BonusHeader seeded with total win at scatter: $${totalForHeader} (scatter base only)`);
            }
          }
        }
      } catch (e) {
        console.warn('[Symbols] Failed to update BonusHeader with scatter base win', e);
      }
    } catch (e) {
      console.warn('[Symbols] Error computing/updating scatter base payout', e);
    }
 
    // If there are no other wins (no tumble wins), play scatter SFX now
    try {
      let hasWins = false;
      const tumblesArr = Array.isArray(spinData.slot?.tumbles) ? spinData.slot.tumbles : [];
      for (const t of tumblesArr) {
        const outs = Array.isArray(t?.symbols?.out) ? t.symbols.out as Array<{ count?: number; win?: number }> : [];
        const anyCount = outs.some(o => (Number(o?.count) || 0) >= 8);
        const tw = Number((t as any)?.win ?? 0);
        if (anyCount || (!isNaN(tw) && tw > 0)) { hasWins = true; break; }
      }
      if (!hasWins) {
        const audio = (window as any)?.audioManager;
        if (audio && typeof audio.playSoundEffect === 'function') {
          audio.playSoundEffect(SoundEffectType.SCATTER);
          console.log('[Symbols] Played scatter SFX for scatter-only hit');
        }
      }
    } catch {}
    
    // Stop normal autoplay immediately when scatter is detected
    if (gameStateManager.isAutoPlaying) {
      console.log('[Symbols] Scatter detected during autoplay - stopping normal autoplay immediately');
      // Access SlotController to stop autoplay
      const slotController = (self.scene as any).slotController;
      if (slotController && typeof slotController.stopAutoplay === 'function') {
        slotController.stopAutoplay();
        console.log('[Symbols] Normal autoplay stopped due to scatter detection');
      } else {
        console.warn('[Symbols] SlotController not available to stop autoplay');
      }
    }
    
    // Do not enable the black overlay during scatter animations
    self.hideWinningOverlay();
    console.log('[Symbols] Skipping winning overlay for scatter symbols');
    
    if (isRetrigger) {
      console.log('[Symbols] Bonus retrigger detected - deferring scatter animations/dialog until WIN_STOP');
      self.setPendingScatterRetrigger(scatterGrids);
    } else {
      // Animate the individual scatter symbols with their hit animations (base trigger)
      console.log('[Symbols] Preparing scatter animations (base trigger)...');
      // If a win dialog is ACTUALLY showing, wait for it to auto-close before animating scatters.
      // NOTE: gameStateManager.isShowingWinDialog can be true even when no dialog is visible,
      // which would otherwise deadlock scatter triggering (no WIN_DIALOG_CLOSED emitted).
      let isDialogActuallyShowing = false;
      try {
        const dialogsAny: any = (self.scene as any)?.dialogs;
        if (dialogsAny && typeof dialogsAny.isDialogShowing === 'function') {
          isDialogActuallyShowing = !!dialogsAny.isDialogShowing();
        }
      } catch {}

      if (isDialogActuallyShowing) {
        console.log('[Symbols] Win dialog visible - deferring scatter symbol animations until dialog auto-closes');
        const onWinDialogClosed = async () => {
          console.log('[Symbols] WIN_DIALOG_CLOSED received - animating scatter symbols and proceeding to scatter sequence');
          gameEventManager.off(GameEventType.WIN_DIALOG_CLOSED, onWinDialogClosed);
          try {
            await self.animateScatterSymbols(mockData, scatterGrids);
            console.log('[Symbols] Scatter symbol hit animations completed (after dialog close)');
          } catch (error) {
            console.error('[Symbols] Error animating scatter symbols after dialog close:', error);
          }
          self.startScatterAnimationSequence(mockData);
        };
        gameEventManager.on(GameEventType.WIN_DIALOG_CLOSED, onWinDialogClosed);
      } else {
        // Defensive: if no dialog is visible, ensure the flag doesn't block scatter flow.
        try { gameStateManager.isShowingWinDialog = false; } catch {}
        console.log('[Symbols] No win dialog showing - animating scatter symbols now');
        try {
          await self.animateScatterSymbols(mockData, scatterGrids);
          console.log('[Symbols] Scatter symbol hit animations completed');
        } catch (error) {
          console.error('[Symbols] Error animating scatter symbols:', error);
        }
        self.startScatterAnimationSequence(mockData);
      }
    }
  } else {
    console.log(`[Symbols] No scatter detected (found ${scatterGrids.length} scatter symbols, need 4+ unless SpinData awards free spins)`);
  }
  
  // Set spinning state to false
  gameStateManager.isReelSpinning = false;
  
  console.log('[Symbols] SpinData symbols processed successfully');
  
  // Since this game has no winlines, mark spin as done after all animations and tumbles finish
  // Emit REELS_STOP and WIN_STOP here when winline drawer is disabled/not used
  if (!self.winLineDrawer || (Symbols as any).WINLINE_CHECKING_DISABLED) {
    // In bonus mode, trigger all multiplier Win animations after the full tumble/win cycle
    try {
      await triggerAllMultiplierWinsAfterBonusSpin(self);
    } catch {}
    console.log('[Symbols] Emitting REELS_STOP and WIN_STOP after symbol animations, tumbles, and bonus multiplier wins (no winlines flow)');
    try {
      gameEventManager.emit(GameEventType.REELS_STOP);
      gameEventManager.emit(GameEventType.WIN_STOP);
    } catch (e) {
      console.warn('[Symbols] Failed to emit REELS_STOP/WIN_STOP:', e);
    }
  }
}

// Legacy helpers for converting paylines/winlines to internal win formats have been
// removed. This game now uses cluster/tumble logic exclusively; payline-based
// evaluation and winline drawing are no longer part of the runtime flow.



function onSpinDataReceived(self: Symbols) {
  // Listen for the new SPIN_DATA_RESPONSE event from GameAPI
  gameEventManager.on(GameEventType.SPIN_DATA_RESPONSE, async (data: any) => {
    console.log('[Symbols] SPIN_DATA_RESPONSE received:', data);
    console.log('[Symbols] SpinData:', data.spinData);
    
    if (!data.spinData || !data.spinData.slot || !data.spinData.slot.area) {
      console.error('[Symbols] Invalid SpinData received - missing slot.area');
      return;
    }
    
    // Store the current spin data for access by other components
    self.currentSpinData = data.spinData;
    console.log('[Symbols] Stored current spin data for access by other components');
    
    // Use the slot.area from SpinData instead of data.symbols
    const symbols = data.spinData.slot.area;
    console.log('[Symbols] Using symbols from SpinData slot.area:', symbols);
    
    // Process the symbols using the same logic as before
    await processSpinDataSymbols(self, symbols, data.spinData);
  });
}

/**
 * Attempt to scale a Spine object so it visually fits within the PNG dimensions
 * used by symbols (self.displayWidth x self.displayHeight).
 */
function fitSpineToSymbolBox(self: Symbols, spineObj: any): void {
  if (!spineObj) return;
  try {
    // Reset to a known baseline before measuring
    if (typeof spineObj.setScale === 'function') spineObj.setScale(1);
    try {
      // Ensure we are in setup pose before measuring
      if (spineObj.skeleton && typeof spineObj.skeleton.setToSetupPose === 'function') {
        spineObj.skeleton.setToSetupPose();
      }
      if (spineObj.updateWorldTransform) {
        spineObj.updateWorldTransform();
      }
    } catch {}

    let boundsWidth = 0;
    let boundsHeight = 0;

    try {
      if (typeof spineObj.getBounds === 'function') {
        const b = spineObj.getBounds();
        if (b && b.size) {
          boundsWidth = Math.max(1, b.size.x || b.size.width || 0);
          boundsHeight = Math.max(1, b.size.y || b.size.height || 0);
        }
      }
    } catch {}

    if (!boundsWidth || !boundsHeight) {
      // Fallback to width/height properties if available
      boundsWidth = Math.max(1, (spineObj.width as number) || 0);
      boundsHeight = Math.max(1, (spineObj.height as number) || 0);
    }

    // Compute uniform scale to fit within target box
    const targetW = Math.max(1, self.displayWidth);
    const targetH = Math.max(1, self.displayHeight);
    const scale = Math.min(targetW / boundsWidth, targetH / boundsHeight) * 0.98; // small padding
    if (isFinite(scale) && scale > 0) {
      spineObj.setScale(scale);
    } else {
      // Fallback: use existing per-symbol scale logic
      spineObj.setScale( self.getSpineSymbolScale(0) );
    }
    // Apply additional per-symbol adjustments after fitting
    try {
      const val = (spineObj as any)?.symbolValue;
      if (val === 0) {
        const sx = (spineObj as any)?.scaleX ?? 1;
        const sy = (spineObj as any)?.scaleY ?? 1;
        if (typeof spineObj.setScale === 'function') {
          spineObj.setScale(sx * 1.2, sy * 1.2); // +20% for scatter
        }
      } else if (val >= 1 && val <= 9) {
        // Apply configured scale multiplier for symbols 1-9
        const baseScale = (spineObj as any)?.scaleX ?? 1;
        const configuredScale = self.getSpineSymbolScale(val);
        // Use configured scale as absolute value (it's already calculated relative to symbol box)
        if (typeof spineObj.setScale === 'function') {
          spineObj.setScale(configuredScale);
        }
      } else if (val >= 10 && val <= 22) {
        // Apply 30% increase for symbol_10_spine (values 10-16), symbol_11_spine (values 17-20), symbol_12_spine (values 21-22)
        const sx = (spineObj as any)?.scaleX ?? 1;
        const sy = (spineObj as any)?.scaleY ?? 1;
        if (typeof spineObj.setScale === 'function') {
          spineObj.setScale(sx * 1.8, sy * 1.8); // +30% for symbols 10-22
        }
      }
    } catch {}
  } catch {}
}

/**
 * Schedule a scale-up effect (+30%) after a delay (default 500ms)
 */
function scheduleScaleUp(self: Symbols, obj: any, delayMs: number = 500): void {
  try {
    const baseX = obj?.scaleX ?? 1;
    const baseY = obj?.scaleY ?? 1;
    const targetX = baseX * 1.6;
    const targetY = baseY * 1.6;
    self.scene.time.delayedCall(delayMs, () => {
      try {
        self.scene.tweens.add({
          targets: obj,
          scaleX: targetX,
          scaleY: targetY,
          duration: 200,
          ease: Phaser.Math.Easing.Cubic.Out,
        });
      } catch {}
    });
  } catch {}
}

// Visual boost for multiplier symbols (applied on top of fit-to-box scale)
const MULTIPLIER_VISUAL_SCALE = 1.6;
// Stagger between triggering multiplier symbols (ms)
const MULTIPLIER_TRIGGER_STAGGER_MS = 800;

/**
 * Disable a symbol object so it no longer interacts or animates.
 * Keeps it visible; removal/visibility is handled elsewhere.
 */
function disableSymbolObject(self: Symbols, obj: any): void {
  try { self.scene.tweens.killTweensOf(obj); } catch {}
  try {
    const overlayObj: any = (obj as any)?.__overlayImage;
    const bounceTween: any = (overlayObj as any)?.__bounceTween;
    try { bounceTween?.stop?.(); } catch {}
    try { self.scene.tweens.killTweensOf(overlayObj); } catch {}
  } catch {}
  try { if (typeof obj.disableInteractive === 'function') obj.disableInteractive(); } catch {}
  // IMPORTANT:
  // Do NOT set `active=false` here. Some objects (notably Spine) rely on `active`
  // to update/apply transforms. Setting it false can make later clear/drop tweens
  // appear "stuck" (properties tween, but rendering doesn't know to update).
}

/**
 * Map multiplier symbol value (10–22) to its animation base inside SymbolBombs_SW
 * Returns one of: 'Symbols11_SW', 'Symbols10_SW', 'Symbols12_SW', or null if not a multiplier
 */
function getMultiplierAnimationBase(value: number): string | null {
  if (value >= 10 && value <= 16) return 'Symbols11_SW';
  if (value >= 17 && value <= 20) return 'Symbols10_SW';
  if (value >= 21 && value <= 22) return 'Symbols12_SW';
  return null;
}

/**
 * Get the win animation name for multiplier symbols (10-22)
 * Symbols 10-16 use Symbol10_FIS, symbols 17-20 use Symbol11_FIS, symbols 21-22 use Symbol12_FIS
 * Note: Multiplier symbols don't have a _Win suffix, they use the base animation name
 */
function getMultiplierWinAnimationName(value: number): string | null {
  if (value >= 10 && value <= 16) return 'Symbol10_FIS';
  if (value >= 17 && value <= 20) return 'Symbol11_FIS';
  if (value >= 21 && value <= 22) return 'Symbol12_FIS';
  return null;
}

/**
 * Play VFX animation behind symbols 1-9, 0.5s before their win animation ends
 * @param self Symbols instance
 * @param symbolObj The symbol object to play VFX behind
 * @param winAnimationDurationMs The duration of the win animation in milliseconds
 */
function playSymbolVFX(self: Symbols, symbolObj: any, winAnimationDurationMs: number): void {
  try {
    // Only play VFX for symbols 1-9
    const symbolValue = (symbolObj as any)?.symbolValue;
    if (typeof symbolValue !== 'number' || symbolValue < 1 || symbolValue > 9) {
      return;
    }

    // Check if VFX assets are loaded
    const vfxKey = 'vfx_fis';
    const vfxAtlasKey = 'vfx_fis-atlas';
    const cacheJson: any = self.scene.cache.json;
    if (!cacheJson || !cacheJson.has(vfxKey)) {
      console.warn(`[Symbols] VFX spine '${vfxKey}' not loaded yet`);
      return;
    }

    // Get symbol position
    const x = symbolObj.x || 0;
    const y = symbolObj.y || 0;

    // Calculate when to start VFX (0.5s before win animation ends)
    const vfxStartDelay = Math.max(0, winAnimationDurationMs - 100);

    // Schedule VFX creation
    self.scene.time.delayedCall(vfxStartDelay, () => {
      try {
        if (!ensureSpineFactory(self.scene as any, `[Symbols] playSymbolVFX(${vfxKey})`)) {
          return;
        }
        // Create VFX spine animation
        const vfxSpine = (self.scene.add as any).spine?.(x, y, vfxKey, vfxAtlasKey);
        if (!vfxSpine) {
          console.warn(`[Symbols] Failed to create VFX spine at (${x}, ${y})`);
          return;
        }

        vfxSpine.setOrigin(0.5, 0.5);
        
        // Scale VFX to 50% of original size
        vfxSpine.setScale(0.5);
        
        // Position VFX behind the symbol (lower depth)
        const symbolDepth = symbolObj.depth || 0;
        vfxSpine.setDepth(symbolDepth - 1);

        // Add to container to maintain proper layering
        if (self.container) {
          self.container.add(vfxSpine);
        }

        // Play VFX animation (assuming it has an "animation" track or similar)
        // Try common animation names, or use the first available animation
        try {
          const animState = vfxSpine.animationState;
          if (animState && animState.setAnimation) {
            // Try to find an animation - use 'animation' as default, or first available
            const skeleton: any = (vfxSpine as any)?.skeleton;
            let animName = 'animation';
            if (skeleton && skeleton.data && skeleton.data.animations && skeleton.data.animations.length > 0) {
              animName = skeleton.data.animations[0].name;
            }
            animState.setAnimation(0, animName, false);
            console.log(`[Symbols] Playing VFX animation "${animName}" behind symbol ${symbolValue} at (${x}, ${y})`);
          }
        } catch (e) {
          console.warn(`[Symbols] Failed to play VFX animation:`, e);
        }

        // Clean up VFX after animation completes (with safety timeout)
        const cleanupDelay = 3000; // Safety timeout
        self.scene.time.delayedCall(cleanupDelay, () => {
          try {
            if (vfxSpine) {
              if (self.container) {
                self.container.remove(vfxSpine, false);
              }
              vfxSpine.destroy();
            }
          } catch (e) {
            console.warn(`[Symbols] Error cleaning up VFX:`, e);
          }
        });
      } catch (e) {
        console.warn(`[Symbols] Error creating VFX spine:`, e);
      }
    });
  } catch (e) {
    console.warn(`[Symbols] Error in playSymbolVFX:`, e);
  }
}

/**
 * Map multiplier symbol value (10–22) to its numeric multiplier for ordering
 * 10->2, 11->3, 12->4, 13->5, 14->6, 15->8, 16->10,
 * 17->12, 18->15, 19->20, 20->25, 21->50, 22->100
 */
function getMultiplierNumeric(value: number): number {
  switch (value) {
    case 10: return 2;
    case 11: return 3;
    case 12: return 4;
    case 13: return 5;
    case 14: return 6;
    case 15: return 8;
    case 16: return 10;
    case 17: return 12;
    case 18: return 15;
    case 19: return 20;
    case 20: return 25;
    case 21: return 50;
    case 22: return 100;
    default: return 0;
  }
}

/**
 * Map multiplier symbol value (10–22) to its PNG overlay key
 * Example keys: 'multiplier_overlay_10', 'multiplier_overlay_22'
 */
function getMultiplierOverlayKey(value: number): string | null {
  switch (value) {
    case 10: return 'multiplier_overlay_10';
    case 11: return 'multiplier_overlay_11';
    case 12: return 'multiplier_overlay_12';
    case 13: return 'multiplier_overlay_13';
    case 14: return 'multiplier_overlay_14';
    case 15: return 'multiplier_overlay_15';
    case 16: return 'multiplier_overlay_16';
    case 17: return 'multiplier_overlay_17';
    case 18: return 'multiplier_overlay_18';
    case 19: return 'multiplier_overlay_19';
    case 20: return 'multiplier_overlay_20';
    case 21: return 'multiplier_overlay_21';
    case 22: return 'multiplier_overlay_22';
    default: return null;
  }
}

/**
 * Create a centered win text using Poppins-Bold and white color with dark stroke.
 * Returns the Phaser.Text object (already origin-centered).
 */
function createWinText(self: Symbols, amount: number, x: number, y: number): Phaser.GameObjects.Text {
  const px = Math.max(40, Math.round(self.displayHeight * 0.5));
  let textValue = '';
  try {
    if (Number.isInteger(amount)) textValue = `$${amount}`;
    else textValue = `$${Number(amount).toFixed(2)}`;
  } catch {
    textValue = `$${amount}`;
  }
  const txt = self.scene.add.text(x, y, textValue, {
    fontFamily: 'Poppins-Bold',
    fontSize: `${px}px`,
    color: '#FFFFFF',
    align: 'center'
  } as any);
  txt.setOrigin(0.5, 0.5);
  try {
    (txt as any).setStroke?.('#02c2d4', Math.max(2, Math.round(px * 0.12)));
    (txt as any).setShadow?.(0, 2, '#000000', Math.max(2, Math.round(px * 0.15)), true, true);
  } catch {}
  return txt;
}

/**
 * Gather tween targets for a symbol: include overlay image if present.
 * Win text is animated separately and excluded here to avoid double-tweening.
 */
function getSymbolTweenTargets(baseObj: any): any {
  try {
    const overlayObj: any = (baseObj as any)?.__overlayImage;
    if (overlayObj) return [baseObj, overlayObj];
  } catch {}
  return baseObj;
}

/**
 * Destroy overlay image associated with a symbol. Leave win text to finish its own fade.
 */
function destroySymbolOverlays(baseObj: any): void {
  try {
    const overlayObj: any = (baseObj as any)?.__overlayImage;
    if (overlayObj && overlayObj.destroy && !overlayObj.destroyed) overlayObj.destroy();
  } catch {}
  try {
    const winTextObj: any = (baseObj as any)?.__winText;
    // Detach from symbol so later cleanup doesn't double-handle it; let its tween onComplete destroy it
    if (winTextObj) { (baseObj as any).__winText = null; }
  } catch {}
}

/**
 * Disable felice gun and felice eyes attachments for Symbol0_FIS during idle animation
 */
function disableFeliceAttachmentsForIdle(spineObj: any): void {
  try {
    const skeleton: any = spineObj?.skeleton;
    if (!skeleton || !skeleton.slots) return;

    // Slot names from the JSON file - "felice gun" and "felice eyes" (with spaces)
    const slotNamesToDisable = ['felice gun', 'felice eyes'];
    
    for (const slotName of slotNamesToDisable) {
      try {
        // Try to find slot by name - check if findSlot method exists
        let slot: any = null;
        if (typeof skeleton.findSlot === 'function') {
          slot = skeleton.findSlot(slotName);
        } else if (skeleton.slots && Array.isArray(skeleton.slots)) {
          // Iterate through slots array to find matching slot
          slot = skeleton.slots.find((s: any) => {
            const name = s?.data?.name || s?.name;
            return name === slotName;
          });
        }
        
        // Disable the attachment by setting it to null
        if (slot && typeof slot.setAttachment === 'function') {
          slot.setAttachment(null);
        }
      } catch (e) {
        // Continue trying other slot names even if one fails
        console.warn(`[Symbols] Failed to disable attachment "${slotName}":`, e);
      }
    }
  } catch (e) {
    // Non-fatal: silently fail if skeleton access fails
    console.warn('[Symbols] Failed to disable felice attachments:', e);
  }
}

/**
 * Enable/restore felice gun and felice eyes attachments for Symbol0_FIS during win animation
 */
function enableFeliceAttachmentsForWin(spineObj: any): void {
  try {
    const skeleton: any = spineObj?.skeleton;
    if (!skeleton || !skeleton.slots) return;

    // Slot names from the JSON file - "felice gun" and "felice eyes" (with spaces)
    // The default attachment name is the same as the slot name
    const slotNamesToEnable = ['felice gun', 'felice eyes'];
    
    for (const slotName of slotNamesToEnable) {
      try {
        // Try to find slot by name
        let slot: any = null;
        if (typeof skeleton.findSlot === 'function') {
          slot = skeleton.findSlot(slotName);
        } else if (skeleton.slots && Array.isArray(skeleton.slots)) {
          slot = skeleton.slots.find((s: any) => {
            const name = s?.data?.name || s?.name;
            return name === slotName;
          });
        }
        
        // Restore the attachment by setting it to the slot name (default attachment name)
        if (slot && typeof slot.setAttachment === 'function') {
          // The attachment name is the same as the slot name in the default skin
          slot.setAttachment(slotName);
          // Also try using skeleton's setAttachment if available (some Spine implementations prefer this)
          if (typeof skeleton.setAttachment === 'function') {
            try {
              skeleton.setAttachment(slotName, slotName);
            } catch {}
          }
        }
      } catch (e) {
        // Continue trying other slot names even if one fails
        console.warn(`[Symbols] Failed to enable attachment "${slotName}":`, e);
      }
    }
  } catch (e) {
    // Non-fatal: silently fail if skeleton access fails
    console.warn('[Symbols] Failed to enable felice attachments:', e);
  }
}

/**
 * Attach a number PNG overlay in front of multiplier symbols (10–22)
 * The overlay is added to the same container and stored on the base object for lifecycle/tween syncing.
 */
function attachMultiplierOverlay(self: Symbols, baseObj: any, value: number, x: number, y: number): void {
  const key = getMultiplierOverlayKey(value);
  if (!key) return;
  try {
    if (!self.scene.textures.exists(key)) return;
    const overlay = self.scene.add.image(x, y, key);
    if (!overlay) return;
    overlay.setOrigin(0.5, 0.5);
    // Scale overlay relative to symbol box size for consistent visuals (+50% larger)
    const desiredWidth = Math.max(3, self.displayWidth * 1.3);
    const texW = Math.max(1, overlay.width);
    const scale = desiredWidth / texW;
    overlay.setScale(scale);
    // Add a subtle looping bounce (scale pulse) that won't conflict with Y-move tweens
    try {
      const bounceTween = self.scene.tweens.add({
        targets: overlay,
        scaleX: scale * 0.88,
        scaleY: scale * 0.88,
        duration: 300,
        yoyo: true,
        repeat: -1,
        ease: Phaser.Math.Easing.Sine.InOut,
      });
      try { (overlay as any).__bounceTween = bounceTween; } catch {}
    } catch {}
    // Ensure overlay renders above its base symbol
    try {
      const baseDepth = (baseObj && typeof baseObj.depth === 'number') ? baseObj.depth : 0;
      overlay.setDepth(baseDepth + 1);
    } catch {}
    // Add to same container so global visibility/alpha applies uniformly
    self.container.add(overlay);
    // Store reference on base object for tweening and cleanup
    try { (baseObj as any).__overlayImage = overlay; } catch {}
  } catch {}
}

/**
 * Create a Spine symbol frozen on frame 1, or PNG fallback
 * Symbols 0-9: Individual spines (Symbol0_FIS - Symbol9_FIS)
 * Symbols 10-16: Shared spine (Symbol10_FIS)
 * Symbols 17-20: Shared spine (Symbol11_FIS)
 * Symbols 21-22: Shared spine (Symbol12_FIS)
 */
function createSugarOrPngSymbol(self: Symbols, value: number, x: number, y: number, alpha: number = 1): any {
  // Try spine for Symbol0–Symbol9 (individual spines)
  if (value >= 0 && value <= 9) {
    try {
      const spineKey = `symbol_${value}_spine`;
      const spineAtlasKey = `${spineKey}-atlas`;
      
      // Check if spine data is loaded
      const cacheJson: any = self.scene.cache.json;
      if (!cacheJson || !cacheJson.has(spineKey)) {
        console.warn(`[Symbols] Spine json '${spineKey}' not loaded yet for symbol ${value}`);
        // Fall through to PNG fallback
      } else {
        const go: any = (self.scene.add as any).spine
          ? (self.scene.add as any).spine(x, y, spineKey, spineAtlasKey)
          : null;
        if (go) {
          try { (go as any).symbolValue = value; } catch {}
          if (typeof go.setOrigin === 'function') go.setOrigin(0.5, 0.5);
          fitSpineToSymbolBox(self, go);
          if (typeof go.setAlpha === 'function') go.setAlpha(alpha);
          // Ensure symbol is visible
          if (typeof go.setVisible === 'function') go.setVisible(true);
          // Set idle animation for symbols 0-9
          try {
            if (go.animationState && go.animationState.setAnimation) {
              const idleAnim = `Symbol${value}_FIS_Idle`;
              try {
                const entry = go.animationState.setAnimation(0, idleAnim, true);
                if (entry && go.animationState.timeScale !== undefined) {
                  go.animationState.timeScale = 1;
                }
                // Disable felice gun and felice eyes for Symbol0_FIS during idle
                if (value === 0) {
                  disableFeliceAttachmentsForIdle(go);
                }
              } catch {
                // Fallback to freezing on frame 1 if idle animation doesn't exist
                const entry = go.animationState.setAnimation(0, 'animation', false);
                if (entry) {
                  (entry as any).trackTime = 0;
                  if (go.animationState.timeScale !== undefined) {
                    go.animationState.timeScale = 0;
                  }
                }
              }
            }
          } catch (e) {
            console.warn(`[Symbols] Failed to set animation for symbol ${value}:`, e);
          }
          self.container.add(go);
          // Attach overlay PNG in front for multipliers
          try { attachMultiplierOverlay(self, go, value, x, y); } catch {}
          return go;
        }
      }
    } catch (e) {
      console.warn(`[Symbols] Error creating spine for symbol ${value}:`, e);
    }
  }

  // Try multiplier spines with shared mapping:
  // Symbol10_FIS for symbols 10-16
  // Symbol11_FIS for symbols 17-20
  // Symbol12_FIS for symbols 21-22
  if (value >= 10 && value <= 22) {
    try {
      let spineKey: string;
      if (value >= 10 && value <= 16) {
        spineKey = 'symbol_10_spine';
      } else if (value >= 17 && value <= 20) {
        spineKey = 'symbol_11_spine';
      } else if (value >= 21 && value <= 22) {
        spineKey = 'symbol_12_spine';
      } else {
        // Should not reach here, but fall through
        return null;
      }
      
      const spineAtlasKey = `${spineKey}-atlas`;
      
      // Check if spine data is loaded
      const cacheJson: any = self.scene.cache.json;
      if (!cacheJson || !cacheJson.has(spineKey)) {
        console.warn(`[Symbols] Spine json '${spineKey}' not loaded yet for symbol ${value}`);
        // Fall through to PNG fallback
      } else {
        const go: any = (self.scene.add as any).spine
          ? (self.scene.add as any).spine(x, y, spineKey, spineAtlasKey)
          : null;
        if (go) {
          try { (go as any).symbolValue = value; } catch {}
          if (typeof go.setOrigin === 'function') go.setOrigin(0.5, 0.5);
          fitSpineToSymbolBox(self, go);
          if (typeof go.setAlpha === 'function') go.setAlpha(alpha);
          // Ensure symbol is visible
          if (typeof go.setVisible === 'function') go.setVisible(true);
          // Freeze "animation" on frame 1 (no idle animation)
          try {
            if (go.animationState && go.animationState.setAnimation) {
              const entry = go.animationState.setAnimation(0, 'animation', false);
              if (entry) {
                // Freeze on frame 1 - set trackTime to 0
                (entry as any).trackTime = 0;
                // Set timeScale to 0 to freeze the animation (skeleton will still render)
                if (go.animationState.timeScale !== undefined) {
                  go.animationState.timeScale = 0;
                }
              }
            }
          } catch (e) {
            console.warn(`[Symbols] Failed to set animation for symbol ${value}:`, e);
          }
          self.container.add(go);
          // Attach overlay PNG in front for multipliers
          try { attachMultiplierOverlay(self, go, value, x, y); } catch {}
          return go;
        }
      }
    } catch (e) {
      console.warn(`[Symbols] Error creating spine for symbol ${value}:`, e);
    }
  }

  // Try multiplier shared Spine (SymbolBombs_SW) for 13–22 (no drop animation)
  // Symbols 10-12 now have individual spines, so skip them here
  const multiBase = getMultiplierAnimationBase(value);
  if (multiBase && value >= 13) {
    try {
      const multiKey = `symbol_bombs_sw`;
      const multiAtlasKey = `${multiKey}-atlas`;
      const go: any = (self.scene.add as any).spine
        ? (self.scene.add as any).spine(x, y, multiKey, multiAtlasKey)
        : null;
      if (go) {
        try { (go as any).symbolValue = value; } catch {}
        if (typeof go.setOrigin === 'function') go.setOrigin(0.5, 0.5);
        fitSpineToSymbolBox(self, go);
        // Apply small visual boost so multipliers appear larger
        try {
          const sx = (go as any)?.scaleX ?? 1;
          const sy = (go as any)?.scaleY ?? 1;
          if (typeof go.setScale === 'function') go.setScale(sx * MULTIPLIER_VISUAL_SCALE, sy * MULTIPLIER_VISUAL_SCALE);
        } catch {}
        if (typeof go.setAlpha === 'function') go.setAlpha(alpha);
        // Ensure symbol is visible
        if (typeof go.setVisible === 'function') go.setVisible(true);
        // Freeze "animation" on frame 1 (no idle animation)
        try {
          if (go.animationState && go.animationState.setAnimation) {
            const entry = go.animationState.setAnimation(0, 'animation', false);
            if (entry) {
              // Freeze on frame 1 - set trackTime to 0
              (entry as any).trackTime = 0;
              // Set timeScale to 0 to freeze the animation (skeleton will still render)
              if (go.animationState.timeScale !== undefined) {
                go.animationState.timeScale = 0;
              }
            }
          }
        } catch (e) {
          console.warn(`[Symbols] Failed to set animation for multiplier symbol ${value}:`, e);
        }
        self.container.add(go);
        // Attach overlay PNG in front for multipliers
        try { attachMultiplierOverlay(self, go, value, x, y); } catch {}
        return go;
      }
    } catch {}
  }

  // Fallback: create a placeholder if spine failed and no PNG available
  console.warn(`[Symbols] Could not create spine or PNG for symbol ${value}, creating placeholder`);
  // Create a simple colored rectangle as placeholder
  const graphics = self.scene.add.graphics();
  graphics.fillStyle(0xffffff, 0.3);
  graphics.fillRect(x - self.displayWidth * 0.5, y - self.displayHeight * 0.5, self.displayWidth, self.displayHeight);
  try { (graphics as any).symbolValue = value; } catch {}
  if (typeof graphics.setAlpha === 'function') graphics.setAlpha(alpha);
  self.container.add(graphics);
  return graphics;
}

/**
 * Play the multiplier "Win" animation once (non-looping) without returning to Idle.
 * Times out safely in case the animation is missing to avoid blocking flow.
 */
async function playMultiplierWinThenIdle(self: Symbols, obj: any, base: string): Promise<void> {
  return new Promise<void>((resolve) => {
    let finished = false;
    const safeResolve = () => { if (!finished) { finished = true; resolve(); } };
    const isTurbo = !!self.scene.gameData?.isTurbo;
    try {
      const animState = obj?.animationState;
      if (!animState || !animState.setAnimation) {
        console.warn('[Symbols] playMultiplierWinThenIdle: No animationState or setAnimation method');
        return safeResolve();
      }
      
      // Get the symbol value first
      const value: number | null = typeof (obj as any)?.symbolValue === 'number' ? (obj as any).symbolValue : null;
      
      // Get the win animation name for this multiplier symbol
      // Symbols 10-16 use Symbol10_FIS, symbols 17-20 use Symbol11_FIS, symbols 21-22 use Symbol12_FIS
      // Note: Multiplier symbols don't have a _Win suffix, they use the base animation name
      const winAnim = value !== null ? (getMultiplierWinAnimationName(value) || 'animation') : 'animation';
      
      // Check if animation exists in skeleton
      const skeleton: any = (obj as any)?.skeleton;
      if (skeleton && skeleton.data) {
        const animData = skeleton.data.findAnimation?.(winAnim);
        if (!animData) {
          console.warn(`[Symbols] playMultiplierWinThenIdle: Animation "${winAnim}" not found in skeleton for symbol ${value}`);
          console.log(`[Symbols] Available animations:`, skeleton.data.animations?.map((a: any) => a.name) || 'none');
        }
      }
      
      // Resume animation if it was frozen
      if (animState.timeScale !== undefined && animState.timeScale === 0) {
        animState.timeScale = 1;
        console.log(`[Symbols] Resumed animation for multiplier symbol ${value} (timeScale: 0 -> 1)`);
      }
      
      // First: Scale up the symbol, then play win animation after scale-up completes
      const baseX = obj?.scaleX ?? 1;
      const baseY = obj?.scaleY ?? 1;
      const targetX = baseX * 1.6;
      const targetY = baseY * 1.6;
      const scaleUpDuration = 200; // Duration of scale-up animation
      
      // Scale up first
      self.scene.tweens.add({
        targets: obj,
        scaleX: targetX,
        scaleY: targetY,
        duration: scaleUpDuration,
        ease: Phaser.Math.Easing.Cubic.Out,
        onComplete: () => {
          // After scale-up completes, start the win animation
          try {
            // Declare entry variable that will be set by setAnimation
            let entry: any = null;
            let overlayMovementTriggered = false;
            
            // Function to handle overlay movement after animation completes
            const handleOverlayMovement = () => {
              // Guard to prevent double execution
              if (overlayMovementTriggered) {
                console.log(`[Symbols] Overlay movement already triggered for multiplier symbol ${value}, skipping`);
                return;
              }
              overlayMovementTriggered = true;

              // Once the win animation is effectively done (or we're about to fly the overlay),
              // move the multiplier behind the rest of the grid so it doesn't visually sit on top.
              // This used to happen on a fixed 500ms timer, which could cut the win animation early.
              try {
                // Delay a bit so the multiplier remains in front slightly longer.
                self.scene.time.delayedCall(200, () => {
                  try {
                    const overlayObj: any = (obj as any)?.__overlayImage;
                    // Temporarily remove overlay if present so we can place it right after the base
                    if (overlayObj && self.container?.remove) {
                      self.container.remove(overlayObj, false);
                    }
                    if (self.container?.sendToBack) {
                      self.container.sendToBack(obj);
                    }
                    // Place overlay right above its base symbol, but still behind all other symbols
                    if (overlayObj && self.container?.addAt && self.container?.getIndex) {
                      const baseIndex = self.container.getIndex(obj);
                      self.container.addAt(overlayObj, baseIndex + 1);
                    }
                  } catch {}
                });
              } catch {}
              try {
                // Pause the animation on the current frame to freeze it
                const e = entry || (animState?.getCurrent && animState.getCurrent(0));
                if (e) {
                  try { (e as any).timeScale = 0; } catch {}
                } else {
                  try { (animState as any).timeScale = 0; } catch {}
                }
                // After pausing, disable the symbol so it won't interact/animate further
                try { disableSymbolObject(self, obj); } catch {}
              } catch {}
              
              // Move multiplier PNG overlay toward the center of the winnings display
              try {
                const overlayObj: any = (obj as any)?.__overlayImage;
                // Create overlay if missing (derive from symbolValue)
                if (!overlayObj) {
                  try {
                    const value = (obj as any)?.symbolValue;
                    if (typeof value === 'number') {
                      attachMultiplierOverlay(self, obj, value, obj.x, obj.y);
                    }
                  } catch {}
                }
                const ov: any = (obj as any)?.__overlayImage;
                // Stop bounce and any ongoing tweens on original overlay
                try { (ov as any)?.__bounceTween?.stop?.(); } catch {}
                try { if (ov) self.scene.tweens.killTweensOf(ov); } catch {}
                // Compute world coordinates for starting point
                let worldX = obj.x, worldY = obj.y;
                try {
                  const source = (ov && ov.getWorldTransformMatrix) ? ov : (obj && obj.getWorldTransformMatrix ? obj : null);
                  const m: any = source ? source.getWorldTransformMatrix() : null;
                  if (m && typeof m.tx === 'number' && typeof m.ty === 'number') {
                    worldX = m.tx; worldY = m.ty;
                  } else {
                    worldX = (ov ? ov.x : obj.x) + (self.container?.x || 0);
                    worldY = (ov ? ov.y : obj.y) + (self.container?.y || 0);
                  }
                } catch {}
                // Determine texture key and scale for the flying overlay
                let textureKey: string | null = null;
                let scaleX = 1, scaleY = 1;
                try { textureKey = ov?.texture?.key || null; } catch {}
                if (!textureKey) {
                  try {
                    const value = (obj as any)?.symbolValue;
                    textureKey = getMultiplierOverlayKey(value);
                  } catch {}
                }
                try {
                  scaleX = (ov && typeof ov.scaleX === 'number') ? ov.scaleX : scaleX;
                  scaleY = (ov && typeof ov.scaleY === 'number') ? ov.scaleY : scaleY;
                } catch {}
                // The overlay has been enlarged by 30% during win animation, so current scale is enlarged
                // Calculate original scale by dividing by 1.3, and use current scale as enlarged scale
                const enlargedScaleX = scaleX;
                const enlargedScaleY = scaleY;
                const originalScaleX = scaleX / 1.8;
                const originalScaleY = scaleY / 1.8;
                // Hide/detach original overlay to avoid double-visibility and mask effects
                try {
                  if (ov) {
                    ov.setVisible(false);
                    // Keep reference for cleanup but ensure it doesn't render
                  }
                } catch {}
                // Create an unmasked overlay at world coordinates in the root display list
                if (textureKey) {
                  try {
                    const fly = self.scene.add.image(worldX, worldY, textureKey);
                    fly.setOrigin(0.5, 0.5);
                    // Start at enlarged scale (30% larger)
                    try { fly.setScale(enlargedScaleX, enlargedScaleY); } catch {}
                    try { fly.setDepth(920); } catch {}
                    // Compute target center (win bar text middle) - use actual amountText position from BonusHeader
                    let cx = self.scene.scale.width * 0.5;
                    let cy = self.scene.scale.height * 0.215 + 18; // Fallback position
                    try {
                      const gameScene = self.scene as any;
                      const bonusHeader = gameScene?.bonusHeader;
                      if (bonusHeader) {
                        const amountText = (bonusHeader as any)?.amountText;
                        if (amountText && typeof amountText.x === 'number' && typeof amountText.y === 'number') {
                          // Get world position of amountText
                          const matrix = amountText.getWorldTransformMatrix();
                          if (matrix && typeof matrix.tx === 'number' && typeof matrix.ty === 'number') {
                            cx = matrix.tx;
                            cy = matrix.ty;
                          } else {
                            // Fallback to local position if world transform not available
                            cx = amountText.x;
                            cy = amountText.y;
                          }
                        }
                      }
                    } catch (e) {
                      console.warn('[Symbols] Failed to get amountText position from BonusHeader, using fallback:', e);
                    }
                    // Travel tween - tween both position and scale back to original size
                    self.scene.tweens.add({
                      targets: fly,
                      x: cx,
                      y: cy,
                      scaleX: originalScaleX,
                      scaleY: originalScaleY,
                      duration: Math.max(200, self.scene.gameData.dropDuration),
                      ease: Phaser.Math.Easing.Cubic.InOut,
                      onComplete: () => {
                        // Notify bonus header that one multiplier reached center (accumulate display)
                        try {
                          // Determine multiplier weight from symbol value
                          let weight = 0;
                          try {
                            const value = (obj as any)?.symbolValue;
                            if (typeof value === 'number') weight = getMultiplierNumeric(value);
                          } catch {}
                          // Compute spin total for this spin BEFORE multipliers are applied:
                          // prefer subTotalWin from the current freespin item, then fall back
                          // to a manual sum of paylines + tumbles.
                          let spinTotal = 0;
                          try {
                            const spinData: any = (self as any)?.currentSpinData;
                            const fs = spinData?.slot?.freespin || spinData?.slot?.freeSpin;
                            if (fs?.items && Array.isArray(fs.items)) {
                              const currentFreeSpinItem = fs.items.find((item: any) => item.spinsLeft > 0);
                              if (currentFreeSpinItem && typeof currentFreeSpinItem.subTotalWin === 'number') {
                                const base = Number(currentFreeSpinItem.subTotalWin);
                                if (!isNaN(base) && base > 0) {
                                  spinTotal = base;
                                }
                              }
                            }
                            // Fallback: if subTotalWin not available, manually sum paylines + tumbles
                            if (spinTotal === 0) {
                              if (spinData?.slot?.paylines && Array.isArray(spinData.slot.paylines)) {
                                for (const pl of spinData.slot.paylines) {
                                  const w = Number(pl?.win || 0);
                                  if (!isNaN(w)) spinTotal += w;
                                }
                              }
                              if (Array.isArray(spinData?.slot?.tumbles)) {
                                for (const t of spinData.slot.tumbles) {
                                  const w = Number(t?.win || 0);
                                  if (!isNaN(w)) spinTotal += w;
                                }
                              }
                            }
                          } catch {}
                          gameEventManager.emit(GameEventType.MULTIPLIER_ARRIVED, { spinTotal, weight } as any);
                        } catch {}
                        // Soft pop + fade out then destroy
                        try {
                          const sx = (fly as any)?.scaleX ?? 1;
                          const sy = (fly as any)?.scaleY ?? 1;
                          self.scene.tweens.chain({
                            targets: fly,
                            tweens: [
                              { scaleX: sx * 1.1, scaleY: sy * 1.1, duration: 120, ease: Phaser.Math.Easing.Cubic.Out },
                              { alpha: 0, duration: 260, ease: Phaser.Math.Easing.Cubic.In, onComplete: () => {
                                try { fly.destroy(); } catch {}
                                // Resolve after the fly completes its arrival + fade sequence
                                safeResolve();
                              }}
                            ]
                          });
                        } catch {
                          try { fly.destroy(); } catch {}
                          // Ensure resolution even if fade chain fails
                          safeResolve();
                        }
                      }
                    });
                  } catch {}
                }
              } catch {}
              // Do not resolve here; wait for the fly tween to complete so arrival is processed before continuing
            };
            
            // Listen for completion of the Win animation
            let listenerRef: any = null;
            if (animState.addListener) {
              listenerRef = {
                complete: (entry: any) => {
                  try {
                    if (!entry || entry.animation?.name !== winAnim) return;
                  } catch {}
                  
                  // Remove listener to prevent memory leaks
                  try {
                    if (animState && typeof animState.removeListener === 'function' && listenerRef) {
                      animState.removeListener(listenerRef);
                    }
                  } catch {}
                  
                  // Animation completed - now proceed with overlay movement
                  handleOverlayMovement();
                }
              } as any;
              try { animState.addListener(listenerRef); } catch {}
            }
            
            // Start the Win animation
            try { if (animState.clearTracks) animState.clearTracks(); } catch {}
            entry = animState.setAnimation(0, winAnim, false);
            // Smoothly enlarge the overlay by 30% when win animation starts
            try {
              const overlayObj: any = (obj as any)?.__overlayImage;
              if (overlayObj) {
                const currentScaleX = (overlayObj.scaleX ?? 1);
                const currentScaleY = (overlayObj.scaleY ?? 1);
                const targetScaleX = currentScaleX * 1.8;
                const targetScaleY = currentScaleY * 1.8;
                // Stop any existing bounce tween before enlarging
                try { (overlayObj as any)?.__bounceTween?.stop?.(); } catch {}
                // Smoothly tween to enlarged size
                self.scene.tweens.add({
                  targets: overlayObj,
                  scaleX: targetScaleX,
                  scaleY: targetScaleY,
                  duration: 250,
                  ease: Phaser.Math.Easing.Cubic.Out,
                });
              }
            } catch {}
            // Slow down win animation for better visibility
            if (entry) {
              try {
                const base = (typeof (entry as any).timeScale === 'number' && (entry as any).timeScale > 0)
                  ? (entry as any).timeScale
                  : 1;
                (entry as any).timeScale = base * 0.7; // 30% slower for better visibility
              } catch {}
            } else if (animState.timeScale !== undefined) {
              try {
                animState.timeScale = 0.7; // 30% slower
              } catch {}
            }
            console.log(`[Symbols] Playing multiplier win animation "${winAnim}" for symbol ${value} (after scale-up), entry:`, entry);
            
            // Fire dedicated multiplier trigger SFX 0.8 seconds after the win animation starts
            try {
              const audio = (window as any)?.audioManager;
              if (audio && typeof audio.playSoundEffect === 'function' && gameStateManager.isBonus) {
                self.scene.time.delayedCall(800, () => {
                  try {
                    audio.playSoundEffect(SoundEffectType.MULTIPLIER_TRIGGER);
                  } catch {}
                });
              }
            } catch {}
            
            if (!entry) {
              console.warn(`[Symbols] Failed to set animation "${winAnim}" for multiplier symbol ${value} - animation may not exist`);
              // Safety timeout if animation doesn't exist
              self.scene.time.delayedCall(1000, () => {
                safeResolve();
              });
              return;
            }
            
            // Safety timeout in case animation never completes
            const animData = (obj as any)?.skeleton?.data?.findAnimation?.(winAnim);
            const durationSec = typeof animData?.duration === 'number' ? animData.duration : 0;
            
            // Pause animation ~0.4 seconds before it ends (accounting for timeScale)
            if (durationSec > 0 && entry) {
              // Account for the timeScale (0.7) that was applied to the animation
              const effectiveTimeScale = (entry as any)?.timeScale ?? (animState.timeScale ?? 1);
              const effectiveDurationMs = (durationSec * 1000) / effectiveTimeScale;
              const pauseTimeMs = Math.max(0, effectiveDurationMs - 400); // ~0.4s before end
              
              if (pauseTimeMs > 0) {
                // Pause the animation shortly before it would naturally end
                self.scene.time.delayedCall(pauseTimeMs, () => {
                  try {
                    // Pause the animation by setting timeScale to 0
                    if (entry) {
                      try { (entry as any).timeScale = 0; } catch {}
                    } else {
                      try { (animState as any).timeScale = 0; } catch {}
                    }
                    console.log(`[Symbols] Paused multiplier animation for symbol ${value} shortly before end`);
                  } catch (e) {
                    console.warn(`[Symbols] Failed to pause multiplier animation for symbol ${value}:`, e);
                  }
                });
                
                // Manually trigger completion handler at the original end time since animation is paused
                self.scene.time.delayedCall(effectiveDurationMs, () => {
                  if (!finished && !overlayMovementTriggered) {
                    // Remove listener if still attached
                    try {
                      if (animState && typeof animState.removeListener === 'function' && listenerRef) {
                        animState.removeListener(listenerRef);
                      }
                    } catch {}
                    // Trigger overlay movement since animation won't complete naturally
                    handleOverlayMovement();
                  }
                });
              }
            }
            
            const maxDuration = durationSec > 0 ? durationSec * 1000 * 1.5 + 1000 : 5000; // Add 50% buffer + 1s safety
            self.scene.time.delayedCall(maxDuration, () => {
              if (!finished && !overlayMovementTriggered) {
                console.warn(`[Symbols] Multiplier animation timeout for symbol ${value} after ${maxDuration}ms - proceeding anyway`);
                // Remove listener if still attached
                try {
                  if (animState && typeof animState.removeListener === 'function' && listenerRef) {
                    animState.removeListener(listenerRef);
                  }
                } catch {}
                handleOverlayMovement();
              }
            });
          } catch {
            // If anything fails, just resolve after a short safety delay
            self.scene.time.delayedCall(300, () => safeResolve());
          }
      }
    });
    } catch {
      safeResolve();
    }
  });
}

/**
 * During bonus mode, after wins and tumbles have fully completed for the
 * current free spin item, trigger Win animations on all multiplier symbols
 * currently present on the grid.
 */
function hasAnyWinsBySymbolCount(self: Symbols): boolean {
  try {
    const dt = new Data();
    if (!self.currentSymbolData) {
      const numCols = self.symbols?.length || 0;
      const numRows = numCols > 0 ? (self.symbols[0]?.length || 0) : 0;
      const rowMajor: number[][] = [];
      for (let row = 0; row < numRows; row++) {
        rowMajor[row] = [];
        for (let col = 0; col < numCols; col++) {
          try {
            const obj: any = self.symbols[col][row];
            const val = self.currentSymbolData?.[row]?.[col];
            rowMajor[row][col] = typeof val === 'number' ? val : (obj?.symbolValue ?? 0);
          } catch {
            rowMajor[row][col] = 0;
          }
        }
      }
      dt.symbols = rowMajor;
    } else {
      dt.symbols = self.currentSymbolData;
    }
    const wins = self.symbolDetector.getWins(dt);
    return !!(wins && wins.allMatching && wins.allMatching.size > 0);
  } catch {
    return false;
  }
}

async function triggerAllMultiplierWinsAfterBonusSpin(self: Symbols): Promise<void> {
  try {
    if (!gameStateManager.isBonus) {
      // Clear any pending promise if not in bonus
      (self as any).multiplierAnimationsPromise = null;
      return;
    }
    // Only animate multipliers if this item (spin + its tumbles) had any wins
    if (!(self as any).hadWinsInCurrentItem) {
      // Clear promise if no wins
      (self as any).multiplierAnimationsPromise = null;
      return;
    }
    if (!self.symbols || !self.symbols.length || !self.symbols[0]?.length) {
      (self as any).multiplierAnimationsPromise = null;
      return;
    }
    type MultiItem = { obj: any; base: string; weight: number };
    const items: MultiItem[] = [];
    for (let col = 0; col < self.symbols.length; col++) {
      for (let row = 0; row < self.symbols[col].length; row++) {
        const obj: any = self.symbols[col][row];
        if (!obj) continue;
        let value: number | null = null;
        try { value = (obj as any).symbolValue ?? null; } catch {}
        if (typeof value !== 'number') continue;
        // Only process multiplier symbols (10-22)
        if (value < 10 || value > 22) continue;
        // Get the win animation name for this multiplier symbol
        // Symbols 10-16 use Symbol10_FIS, symbols 17-20 use Symbol11_FIS, symbols 21-22 use Symbol12_FIS
        const base = getMultiplierWinAnimationName(value) || 'animation';
        const canAnimate = !!(obj?.animationState && obj.animationState.setAnimation);
        if (!canAnimate) continue;
        const weight = getMultiplierNumeric(value);
        items.push({ obj, base, weight });
      }
    }
    if (items.length === 0) {
      (self as any).multiplierAnimationsPromise = null;
      return;
    }

    // Create and store the promise for multiplier animations completion
    const animationPromise = (async () => {
      // Compute total multiplier sum and spin total BEFORE multipliers are applied
      try {
        const multiplierSum = items.reduce((sum, it) => sum + (Number(it.weight) || 0), 0);
        let spinTotal = 0;
        try {
          const spinData: any = (self as any)?.currentSpinData;
          const fs = spinData?.slot?.freespin || spinData?.slot?.freeSpin;
          if (fs?.items && Array.isArray(fs.items)) {
            const currentFreeSpinItem = fs.items.find((item: any) => item.spinsLeft > 0);
            if (currentFreeSpinItem && typeof currentFreeSpinItem.subTotalWin === 'number') {
              const base = Number(currentFreeSpinItem.subTotalWin);
              if (!isNaN(base) && base > 0) {
                spinTotal = base;
              }
            }
          }
          // Fallback: if subTotalWin not available, manually sum paylines + tumbles
          if (spinTotal === 0) {
            if (spinData?.slot?.paylines && Array.isArray(spinData.slot.paylines)) {
              for (const pl of spinData.slot.paylines) {
                const w = Number(pl?.win || 0);
                if (!isNaN(w)) spinTotal += w;
              }
            }
            if (Array.isArray(spinData?.slot?.tumbles)) {
              for (const t of spinData.slot.tumbles) {
                const w = Number(t?.win || 0);
                if (!isNaN(w)) spinTotal += w;
              }
            }
          }
        } catch {}
        // Emit event so BonusHeader can show "YOU WON: $spinTotal x multiplierSum"
        try {
          gameEventManager.emit(GameEventType.MULTIPLIERS_TRIGGERED, { spinTotal, multiplierSum } as any);
        } catch {}
      } catch {}
      // Sort by highest multiplier first; randomize order among equals
      items.sort((a, b) => {
        if (b.weight !== a.weight) return b.weight - a.weight;
        return Math.random() - 0.5;
      });
      // Start each with a stagger, allowing overlap; wait for all to complete
      const startDelayMs = MULTIPLIER_TRIGGER_STAGGER_MS;
      const runPromises: Promise<void>[] = items.map((it, idx) => {
        return new Promise<void>((resolve) => {
          try {
            const delayMs = Math.max(0, startDelayMs * idx);
            self.scene.time.delayedCall(delayMs, async () => {
              try {
                await playMultiplierWinThenIdle(self, it.obj, it.base);
              } catch {}
              resolve();
            });
          } catch {
            resolve();
          }
        });
      });
      await Promise.allSettled(runPromises);
      // Wait after all multiplier PNGs have reached the center of the winnings display
      await new Promise<void>((resolve) => {
        self.scene.time.delayedCall(800, () => {
          resolve();
        });
      });
      // Emit event that all multiplier animations have completed
      try {
        gameEventManager.emit(GameEventType.MULTIPLIER_ANIMATIONS_COMPLETE);
        console.log('[Symbols] Emitted MULTIPLIER_ANIMATIONS_COMPLETE event');
      } catch {}
    })();
    
    // Store the promise so congrats dialog can wait for it
    (self as any).multiplierAnimationsPromise = animationPromise;
    
    // Wait for completion
    await animationPromise;
    
    // Clear the promise after completion
    (self as any).multiplierAnimationsPromise = null;
  } catch {
    // Clear promise on error
    (self as any).multiplierAnimationsPromise = null;
  }
}

function createNewSymbols(self: Symbols, data: Data) {
  let scene = self.scene;
  disposeSymbols(self.newSymbols);
  self.newSymbols = [];

  const symbolTotalWidth = self.displayWidth + self.horizontalSpacing;
  const symbolTotalHeight = self.displayHeight + self.verticalSpacing;

  const adjY = self.scene.scale.height * -1.0;

  const startX = self.slotX - self.totalGridWidth * 0.5;
  const startY = self.slotY - self.totalGridHeight * 0.5 + adjY;

  let symbols = data.symbols; // expected column-major [col][row]
  console.log('[Symbols] New symbols from spin response (column-major):', symbols);
  
  // Update current symbol data for reset purposes (store as row-major for tumble logic)
  try {
    const colCount = symbols.length;
    const rowCount = colCount > 0 ? symbols[0].length : 0;
    const rowMajor: number[][] = [];
    for (let row = 0; row < rowCount; row++) {
      rowMajor[row] = [];
      for (let col = 0; col < colCount; col++) {
        // Invert vertical order: SpinData area is bottom->top; row 0 is top visually
        rowMajor[row][col] = symbols[col][rowCount - 1 - row];
      }
    }
    self.currentSymbolData = rowMajor;
  } catch {
    self.currentSymbolData = symbols;
  }
  
  self.newSymbols = [];

  for (let col = 0; col < symbols.length; col++) {
    let rows: any[] = [];
    for (let row = 0; row < symbols[col].length; row++) {
      const x = startX + col * symbolTotalWidth + symbolTotalWidth * 0.5;
      const y = startY + row * symbolTotalHeight + symbolTotalHeight * 0.5;

      // Invert vertical order for display
      const value = symbols[col][symbols[col].length - 1 - row];
      const created = createSugarOrPngSymbol(self, value, x, y, 1);
      rows.push(created);
    }
    self.newSymbols.push(rows);
  }
}

async function dropReels(self: Symbols, data: Data): Promise<void> {
  // Remove init check since we're not using it anymore
  console.log('[Symbols] dropReels called with data:', data);
  console.log('[Symbols] SLOT_ROWS (config columns):', SLOT_ROWS);

  // Stagger reel starts at a fixed interval and let them overlap

  // Scatter anticipation state (used by dropNewSymbols + tumbles)
  try {
    (self as any).__scatterAnticipationEnabled = false;
    (self as any).__scatterAnticipationLandedScatterCount = 0;
    (self as any).__scatterAnticipationActiveCol = null;
    (self as any).__scatterAnticipationPendingByCol = Array.from({ length: (self.newSymbols?.length || self.symbols?.length || 0) }, () => 0);
  } catch {}

  // Anticipation does not extend drops in this game; it is purely a visual overlay.
  const extendLastReelDrop = false;
  try { (self.scene as any).__isScatterAnticipationActive = false; } catch {}

  const reelPromises: Promise<void>[] = [];
  // Adjustable gap between clearing previous symbols and spawning new ones per row

  // Determine the actual number of visible rows from the current grid.
  // This ensures we clear/drop every row even if config/constants change.
  const numRows = (self.symbols && self.symbols[0] && self.symbols[0].length)
    ? self.symbols[0].length
    : SLOT_COLUMNS;

  // For the spin drop flow, count "pending drops per column" upfront as numRows,
  // so the anticipation hides only after the column has fully finished dropping all its symbols.
  try {
    const numCols = self.newSymbols?.length || 0;
    (self as any).__scatterAnticipationPendingByCol = Array.from({ length: numCols }, () => numRows);
  } catch {}
  const isTurbo = !!self.scene.gameData?.isTurbo;

  // Reverse the sequence: start from bottom row to top row.
  // NOTE: We intentionally do NOT force row-by-row scheduling in slow-mode.
  // Slow-mode is handled inside dropNewSymbols (column sequencing), while rows can continue to overlap.
  for (let step = 0; step < numRows; step++) {
    const actualRow = (numRows - 1) - step;
    const isLastReel = actualRow === 0;
    const bonusPreDropDelay =
      gameStateManager.isBonus
        ? (self.scene.gameData.winUpDuration * 2)
        : 0.5;
    const startDelay =
      bonusPreDropDelay +
      (isTurbo ? 0 : self.scene.gameData.dropReelsDelay * step);
    const p = (async () => {
      await delay(startDelay);
      console.log(`[Symbols] Processing row ${actualRow}/${numRows - 1} (new symbols only)`);
      await dropNewSymbols(self, actualRow, isLastReel && extendLastReelDrop);
    })();
    reelPromises.push(p);
  }
  console.log('[Symbols] Waiting for all reels to complete animation...');
  await Promise.all(reelPromises);
  console.log('[Symbols] All reels have completed animation');

  // Safety: ensure scatter anticipation is hidden after the full drop completes.
  try {
    const ctrl: any = (self.scene as any)?.scatterAnticipation;
    if (ctrl && typeof ctrl.hide === 'function') ctrl.hide();
    (self.scene as any).__isScatterAnticipationActive = false;
  } catch {}

  // Turbo mode: play turbo drop sound effect once when all new symbols have finished dropping
  if (isTurbo && (window as any).audioManager) {
    try {
      (window as any).audioManager.playSoundEffect(SoundEffectType.TURBO_DROP);
      console.log('[Symbols] Playing turbo drop sound effect after all reels have completed (turbo mode)');
    } catch (e) {
      console.warn('[Symbols] Failed to play turbo drop sound effect after reel completion:', e);
    }
  }
}

function dropPrevSymbols(self: Symbols, index: number, extendDuration: boolean = false) {
  if (self.symbols === undefined || self.symbols === null) {
    return;
  }
  
  // Check if symbols array has valid structure
  if (!self.symbols[0] || !self.symbols[0][0]) {
    console.warn('[Symbols] dropPrevSymbols: symbols array structure is invalid, skipping');
    return;
  }

  const height = self.symbols[0][0].displayHeight + self.verticalSpacing;
  const extraMs = extendDuration ? 3000 : 0;
  // Drop previous symbols far enough to be fully off-screen regardless of starting row
  const gridBottomY = self.slotY + self.totalGridHeight * 0.5;
  const distanceToScreenBottom = Math.max(0, self.scene.scale.height - gridBottomY);
  const DROP_DISTANCE = distanceToScreenBottom + self.totalGridHeight + (height * 2) + self.scene.gameData.winUpHeight;
  const totalAnimations = self.symbols.length;
  const STAGGER_MS = 50; // match dropNewSymbols stagger (left-to-right, one by one feel)
  const clearHop = self.scene.gameData.winUpHeight * 0.2;

  for (let i = 0; i < self.symbols.length; i++) {
    // Check if the current row exists and has the required index
    if (!self.symbols[i] || !self.symbols[i][index]) {
      console.warn(`[Symbols] dropPrevSymbols: skipping invalid row ${i} or index ${index}`);
      continue;
    }
    
    // Trigger drop animation on the symbol if available (sugar Spine)
    try { playDropAnimationIfAvailable(self.symbols[i][index]); } catch {}

    const baseObj: any = self.symbols[i][index];
    const overlayObj: any = (baseObj as any)?.__overlayImage;
    const tweenTargets: any = overlayObj ? [baseObj, overlayObj] : baseObj;
    const isTurbo = !!self.scene.gameData?.isTurbo;
    const tweens: any[] = [
      {
        // In turbo mode, drop all symbols at the same time (no per-column stagger)
        delay: isTurbo ? 0 : STAGGER_MS * i,
        y: `-= ${clearHop}`,
        duration: self.scene.gameData.winUpDuration,
        ease: Phaser.Math.Easing.Circular.Out,
      },
      {
        y: `+= ${DROP_DISTANCE}`,
        duration: (self.scene.gameData.dropDuration * 0.9) + extraMs,
        ease: Phaser.Math.Easing.Linear,
      },
    ];

    // In turbo mode, skip post-drop bounce tweens to keep drops snappy
    if (!isTurbo) {
      tweens.push(
        {
          y: `+= ${5}`,
          duration: self.scene.gameData.dropDuration * 0.05,
          ease: Phaser.Math.Easing.Linear,
        },
        {
          y: `-= ${5}`,
          duration: self.scene.gameData.dropDuration * 0.05,
          ease: Phaser.Math.Easing.Linear,
        },
      );
    }

    self.scene.tweens.chain({
      targets: tweenTargets,
      tweens,
    });
  }
}

function dropFillers(self: Symbols, index: number, extendDuration: boolean = false) {
  // Check if symbols array has valid structure
  if (!self.symbols || !self.symbols[0] || !self.symbols[0][0]) {
    console.warn('[Symbols] dropFillers: symbols array structure is invalid, skipping');
    return;
  }
  
  const height = self.symbols[0][0].displayHeight + self.verticalSpacing;
  const baseTotal = Symbols.FILLER_COUNT + SLOT_COLUMNS;
  const baseDropDistance = baseTotal * height + GameData.WIN_UP_HEIGHT;
  const extraMs = extendDuration ? 3000 : 0;
  const baseDropMs = self.scene.gameData.dropDuration * 0.9;
  const extraPixels = extraMs > 0 && baseDropMs > 0 ? (baseDropDistance * (extraMs / baseDropMs)) : 0;
  const extraRows = extraPixels > 0 ? Math.ceil(extraPixels / height) : 0;
  const TOTAL_ITEMS = Symbols.FILLER_COUNT + SLOT_COLUMNS + extraRows;
  const DROP_DISTANCE = TOTAL_ITEMS * height + GameData.WIN_UP_HEIGHT;
  const fillerSymbols: GameObjects.Sprite[] = [];
  for (let i = 0; i < TOTAL_ITEMS - SLOT_COLUMNS; i++) {

    const symbolTotalWidth = self.displayWidth + self.horizontalSpacing;
    const startX = self.slotX - self.totalGridWidth * 0.5;

    const START_INDEX_Y = -(TOTAL_ITEMS - SLOT_COLUMNS);
    const x = startX + index * symbolTotalWidth + symbolTotalWidth * 0.5;
    const y = getYPos(self, i + START_INDEX_Y)


    const value = Math.floor(Math.random() * Data.ALL_SYMBOLS.length);
    const created = createSugarOrPngSymbol(self, value, x, y, 1);
    fillerSymbols.push(created);
  }

  for (let i = 0; i < fillerSymbols.length; i++) {
    const baseObj: any = fillerSymbols[i] as any;
    const overlayObj: any = (baseObj as any)?.__overlayImage;
    const tweenTargets: any = overlayObj ? [baseObj, overlayObj] : baseObj;
    const isTurbo = !!self.scene.gameData?.isTurbo;
    const tweens: any[] = [
      {
        y: `-= ${self.scene.gameData.winUpHeight}`,
        duration: self.scene.gameData.winUpDuration,
        ease: Phaser.Math.Easing.Circular.Out,
      },
      {
        y: `+= ${DROP_DISTANCE}`,
        duration: (self.scene.gameData.dropDuration * 0.9) + extraMs,
        ease: Phaser.Math.Easing.Linear,
      },
    ];

    // In turbo mode, skip the large post-drop bounce on filler symbols
    if (!isTurbo) {
      tweens.push(
        {
          y: `+= ${40}`,
          duration: self.scene.gameData.dropDuration * 0.05,
          ease: Phaser.Math.Easing.Linear,
        },
        {
          y: `-= ${40}`,
          duration: self.scene.gameData.dropDuration * 0.05,
          ease: Phaser.Math.Easing.Linear,
          onComplete: () => {
            try { if (overlayObj && overlayObj.destroy) overlayObj.destroy(); } catch {}
            baseObj.destroy();
          }
        },
      );
    } else {
      // Still clean up the filler symbol when the main drop completes
      const last = tweens[tweens.length - 1];
      const prevOnComplete = last.onComplete;
      last.onComplete = () => {
        try { if (prevOnComplete) prevOnComplete(); } catch {}
        try { if (overlayObj && overlayObj.destroy) overlayObj.destroy(); } catch {}
        baseObj.destroy();
      };
    }

    self.scene.tweens.chain({
      targets: tweenTargets,
      tweens,
    })

  }
}

function dropNewSymbols(self: Symbols, index: number, extendDuration: boolean = false): Promise<void> {
  return new Promise<void>((resolve) => {
    // Check if symbols array has valid structure
    if (!self.symbols || !self.symbols[0] || !self.symbols[0][0]) {
      console.warn('[Symbols] dropNewSymbols: symbols array structure is invalid, resolving immediately');
      resolve();
      return;
    }

    function isScatterObj(obj: any): boolean {
      try {
        const v = (obj as any)?.symbolValue;
        if (v === 0) return true;
        if ((obj as any)?.texture?.key === 'symbol_0') return true;
      } catch {}
      return false;
    }

    function ensureAnticipationState(numCols: number): void {
      try {
        const pending = (self as any).__scatterAnticipationPendingByCol;
        if (!Array.isArray(pending) || pending.length !== numCols) {
          (self as any).__scatterAnticipationPendingByCol = Array.from({ length: numCols }, () => 0);
        }
        if (typeof (self as any).__scatterAnticipationEnabled !== 'boolean') {
          (self as any).__scatterAnticipationEnabled = false;
        }
        if (typeof (self as any).__scatterAnticipationLandedScatterCount !== 'number') {
          (self as any).__scatterAnticipationLandedScatterCount = 0;
        }
      } catch {}
    }

    // Spin-only: scatter anticipation is disabled. (We show it only for tumbles.)
    function moveAndShowForColumn(_col: number, _x: number): void {}

    function onSymbolDropComplete(col: number, symbolObj: any): void {
      try {
        // Track scatter landed count for consistency, but do NOT enable/show scatter anticipation on spin.
        if (isScatterObj(symbolObj)) {
          const before = Number((self as any).__scatterAnticipationLandedScatterCount || 0);
          const after = before + 1;
          (self as any).__scatterAnticipationLandedScatterCount = after;
        }

        // Decrement pending drops for this column and hide if this column is done.
        const pending: number[] = (self as any).__scatterAnticipationPendingByCol || [];
        if (Array.isArray(pending)) {
          pending[col] = Math.max(0, Number(pending[col] || 0) - 1);
          const activeCol = (self as any).__scatterAnticipationActiveCol;
          if (pending[col] === 0 && activeCol === col) {
            const ctrl: any = (self.scene as any)?.scatterAnticipation;
            try { if (ctrl && typeof ctrl.hide === 'function') ctrl.hide(); } catch {}
            try { (self.scene as any).__isScatterAnticipationActive = false; } catch {}
            (self as any).__scatterAnticipationActiveCol = null;
          }
        }
      } catch {}

      // Scatter-on-screen counter (increment on drop completion)
      try { self.handleSymbolDropCompleteForScatterCounter(symbolObj, 'spin_drop'); } catch {}
    }
    
    const height = self.symbols[0][0].displayHeight + self.verticalSpacing;
    const extraMs = extendDuration ? 3000 : 0;

    const totalAnimations = self.newSymbols.length;
    const STAGGER_MS = 100; // slight delay between starting columns (normal mode)
    const symbolHop = self.scene.gameData.winUpHeight * 0.5;

    ensureAnticipationState(totalAnimations);

    const dropOneColumn = (col: number): Promise<void> => {
      return new Promise<void>((colResolve) => {
        try {
          let symbol = self.newSymbols[col][index];
          const targetY = getYPos(self, index);

          // Trigger drop animation on the new symbol if available (sugar Spine)
          try { playDropAnimationIfAvailable(symbol); } catch {}

          const baseObj: any = symbol as any;
          const overlayObj: any = (baseObj as any)?.__overlayImage;
          const tweenTargets: any = overlayObj ? [baseObj, overlayObj] : baseObj;

          const turboNow = !!self.scene.gameData?.isTurbo;

          const tweens: any[] = [
            {
              // We handle staggering outside (by delaying column starts), so keep tween delay at 0.
              delay: 0,
              y: `-= ${symbolHop}`,
              duration: self.scene.gameData.winUpDuration,
              ease: Phaser.Math.Easing.Circular.Out,
              onStart: () => {}
            },
            {
              onStart: () => {},
              y: targetY,
              duration: (self.scene.gameData.dropDuration * 0.9) + extraMs,
              // In turbo mode, use a smooth decelerating ease so the drop doesn't feel rigid.
              ease: turboNow ? Phaser.Math.Easing.Cubic.Out : Phaser.Math.Easing.Linear,
            },
          ];

          if (!turboNow) {
            // Normal mode: include the small post-drop bounce and SFX
            tweens.push(
              {
                y: `+= ${10}`,
                duration: self.scene.gameData.dropDuration * 0.05,
                ease: Phaser.Math.Easing.Linear,
              },
              {
                y: `-= ${10}`,
                duration: self.scene.gameData.dropDuration * 0.05,
                ease: Phaser.Math.Easing.Linear,
                onComplete: () => {
                  try {
                    // Play reel drop sound effect only when turbo mode is off
                    if (!self.scene.gameData.isTurbo && (window as any).audioManager) {
                      (window as any).audioManager.playSoundEffect(SoundEffectType.REEL_DROP);
                      console.log(`[Symbols] Playing reel drop sound effect for reel ${index} after drop completion`);
                    }
                  } catch {}
                  try { onSymbolDropComplete(col, baseObj); } catch {}
                  colResolve();
                }
              },
            );
          } else {
            // Turbo mode: resolve on the main drop completion
            const last = tweens[tweens.length - 1];
            const prevOnComplete = last.onComplete;
            last.onComplete = () => {
              try { if (prevOnComplete) prevOnComplete(); } catch {}
              try { onSymbolDropComplete(col, baseObj); } catch {}
              colResolve();
            };
          }

          self.scene.tweens.chain({
            targets: tweenTargets,
            tweens,
          });
        } catch {
          colResolve();
        }
      });
    };

    (async () => {
      // Spin drop: always use normal timing (no slow-mode).
      const promises: Promise<void>[] = [];
      for (let col = 0; col < self.newSymbols.length; col++) {
        if (col > 0) {
          await delay(Math.max(0, STAGGER_MS));
        }
        promises.push(dropOneColumn(col));
      }
      await Promise.allSettled(promises);
      resolve();
    })();
  });
}


function disposeSymbols(symbols: any[][]) {
  console.log('[Symbols] Disposing old symbols...');
  let disposedCount = 0;
  
  for (let col = 0; col < symbols.length; col++) {
    for (let row = 0; row < symbols[col].length; row++) {
      const symbol = symbols[col][row];
      if (symbol && symbol.destroy && !symbol.destroyed) {
        try {
          const symbolType = symbol.animationState ? 'Spine' : 'PNG';
          const symbolKey = symbol.texture?.key || 'unknown';
          // Remove any paused multiplier-specific handling; destroy normally
          // Destroy any attached overlay image first
          try {
            const overlayObj: any = (symbol as any)?.__overlayImage;
            if (overlayObj) {
              //try { overlayObj.scene?.tweens?.killTweensOf?.(overlayObj); } catch {}
              if (!overlayObj.destroyed && overlayObj.destroy) {
                overlayObj.destroy();
              }
            }
          } catch {}
          symbol.destroy();
          disposedCount++;
        } catch (error) {
          console.error(`[Symbols] Error disposing symbol at (${col}, ${row}):`, error);
        }
      }
    }
  }
  
  console.log(`[Symbols] Disposed ${disposedCount} symbols`);
}


function playDropAnimationIfAvailable(obj: any): void {
  try {
    const val = (obj as any)?.symbolValue;
    const canSpine = !!(obj?.animationState && obj.animationState.setAnimation);
    if (typeof val === 'number' && val >= 0 && val <= 9 && canSpine) {
      const drop = `Symbol${val}_SW_Drop`;
      try {
        const hasDrop = !!(obj as any)?.skeleton?.data?.findAnimation?.(drop);
        if (hasDrop) {
          obj.animationState.setAnimation(0, drop, false);
        }
      } catch {}
    }
  } catch {}
}

function reevaluateWinsFromGrid(self: Symbols): void {
  try {
    // Build Data with current row-major symbols
    const dt = new Data();
    // Ensure currentSymbolData is populated; if not, derive from self.symbols
    if (!self.currentSymbolData) {
      const numCols = self.symbols?.length || 0;
      const numRows = numCols > 0 ? (self.symbols[0]?.length || 0) : 0;
      const rowMajor: number[][] = [];
      for (let row = 0; row < numRows; row++) {
        rowMajor[row] = [];
        for (let col = 0; col < numCols; col++) {
          // Attempt to read a value property stored during drops; fallback to 0
          try {
            const obj: any = self.symbols[col][row];
            const val = self.currentSymbolData?.[row]?.[col];
            rowMajor[row][col] = typeof val === 'number' ? val : (obj?.symbolValue ?? 0);
          } catch {
            rowMajor[row][col] = 0;
          }
        }
      }
      dt.symbols = rowMajor;
    } else {
      dt.symbols = self.currentSymbolData;
    }

    // Compute wins using SymbolDetector
    const wins = self.symbolDetector.getWins(dt);
    dt.wins = wins;
    const totalWinningCells = Array.from(wins.allMatching.values()).reduce((s, arr) => s + arr.length, 0);
    console.log('[Symbols] Re-evaluated wins after drop:', { patterns: wins.allMatching.size, totalWinningCells });

    // Apply highlighting only if not disabled
    if (!(Symbols as any).WINLINE_CHECKING_DISABLED) {
      replaceWithSpineAnimations(self, dt);
    }
  } catch (e) {
    console.warn('[Symbols] Failed to re-evaluate wins from current grid:', e);
  }
}

function getYPos(self: Symbols, index: number) {
  const symbolTotalHeight = self.displayHeight + self.verticalSpacing;
  const startY = self.slotY - self.totalGridHeight * 0.5;

  return startY + index * symbolTotalHeight + symbolTotalHeight * 0.5;
}


/**
 * Apply a sequence of tumble steps: remove "out" symbols, compress columns down, and drop "in" symbols from top.
 * Expects tumbles to be in the SpinData format: [{ symbols: { in: number[][], out: {symbol:number,count:number,win:number}[] }, win: number }, ...]
 */
async function applyTumbles(self: Symbols, tumbles: any[]): Promise<void> {
  let cumulativeWin = 0;
  let tumbleIndex = 0;
  for (const tumble of tumbles) {
    tumbleIndex++;
    // Compute this tumble's total win (prefer tumble.win; fallback to sum of outs.win)
    let tumbleTotal = 0;
    try {
      const w = Number((tumble as any)?.win ?? 0);
      if (!isNaN(w) && w > 0) {
        tumbleTotal = w;
      } else {
        const outsArr = Array.isArray((tumble as any)?.symbols?.out) ? (tumble as any).symbols.out as Array<{ win?: number }> : [];
        tumbleTotal = outsArr.reduce((s, o) => s + (Number(o?.win) || 0), 0);
      }
    } catch {}

    const currentTumbleIndex = tumbleIndex;
    // Update cumulative win immediately for TUMBLE_SEQUENCE_DONE calculation
    cumulativeWin += tumbleTotal;
    await applySingleTumble(self, tumble, currentTumbleIndex, () => {
      // Delay the winnings display until win animations have had time to play
      // Use winUpDuration to match the timing of win animations
      const winAnimationDelay = Math.max(600, (self.scene?.gameData?.winUpDuration || 700));
      
      // Play tumble-indexed symbol-win SFX immediately (1=>twin1, 2=>twin2, 3=>twin3, 4+=>twin4)
      try {
        const am = (window as any)?.audioManager;
        if (am && typeof am.playSymbolWinByTumble === 'function') {
          console.log(`[Symbols] Calling playSymbolWinByTumble with tumble index: ${currentTumbleIndex}`);
          am.playSymbolWinByTumble(currentTumbleIndex);
        }
      } catch {}
      
      // Delay the winnings display emission to allow win animations to play first
      // Capture the cumulative win value at this point (already includes this tumble's win)
      const cumulativeWinToEmit = cumulativeWin;
      self.scene.time.delayedCall(winAnimationDelay, () => {
        try {
          if (cumulativeWinToEmit > 0) {
            console.log(`[Symbols] Emitting TUMBLE_WIN_PROGRESS after ${winAnimationDelay}ms delay (win animations should be visible)`);
            gameEventManager.emit(GameEventType.TUMBLE_WIN_PROGRESS, { cumulativeWin: cumulativeWinToEmit } as any);
          }
        } catch {}
      });
    });
  }
  try {
    gameEventManager.emit(GameEventType.TUMBLE_SEQUENCE_DONE, { totalWin: cumulativeWin } as any);
  } catch {}
}

async function applySingleTumble(self: Symbols, tumble: any, tumbleIndex: number, onFirstWinComplete?: (tumbleTotal: number) => void): Promise<void> {
  const outs = (tumble?.symbols?.out || []) as Array<{ symbol: number; count: number }>;
  const ins = (tumble?.symbols?.in || []) as number[][]; // per real column (x index)

  // If this tumble removes any symbols, it represents a win event during this item
  try {
    const anyRemoval = Array.isArray(outs) && outs.some(o => (Number(o?.count) || 0) > 0);
    if (anyRemoval) { (self as any).hadWinsInCurrentItem = true; }
  } catch {}

  if (!self.symbols || !self.symbols.length || !self.symbols[0] || !self.symbols[0].length) {
    console.warn('[Symbols] applySingleTumble: Symbols grid not initialized');
    return;
  }

  // Grid orientation: self.symbols[col][row]
  const numCols = self.symbols.length;
  const numRows = self.symbols[0].length;

  // Match manual drop timings and staggering for visual consistency
  const MANUAL_STAGGER_MS: number = (self.scene?.gameData?.tumbleStaggerMs ?? 100);

  // Debug: log incoming tumble payload
  try {
    const totalOutRequested = outs.reduce((s, o) => s + (Number(o?.count) || 0), 0);
    const totalInProvided = (Array.isArray(ins) ? ins.flat().length : 0);
    console.log('[Symbols] Tumble payload:', {
      outs,
      insColumns: Array.isArray(ins) ? ins.map((col, idx) => ({ col: idx, count: Array.isArray(col) ? col.length : 0 })) : [],
      totals: { totalOutRequested, totalInProvided }
    });
  } catch {}

  // Build a removal mask per cell
  // removeMask[col][row]
  const removeMask: boolean[][] = Array.from({ length: numCols }, () => Array<boolean>(numRows).fill(false));

  // Identify symbols that meet the high-count threshold (>=8)
  const highCountSymbols = new Set<number>();
  for (const out of outs) {
    const c = Number(out?.count || 0);
    const s = Number(out?.symbol);
    if (!isNaN(c) && !isNaN(s) && c >= 8) {
      highCountSymbols.add(s);
    }
  }

  // Build position indices by symbol (topmost-first per column)
  const positionsBySymbol: { [key: number]: Array<{ col: number; row: number }> } = {};
  let sequenceIndex = 0; // ensures 1-by-1 ordering across columns left-to-right
  for (let col = 0; col < numCols; col++) {
    for (let row = 0; row < numRows; row++) {
      const val = self.currentSymbolData?.[row]?.[col];
      if (typeof val !== 'number') continue;
      if (!positionsBySymbol[val]) positionsBySymbol[val] = [];
      positionsBySymbol[val].push({ col, row });
    }
  }
  // Sort each symbol's positions top-to-bottom (row asc), then left-to-right (col asc)
  Object.keys(positionsBySymbol).forEach(k => {
    positionsBySymbol[Number(k)].sort((a, b) => a.row - b.row || a.col - b.col);
  });

  // Determine per-column incoming counts
  const insCountByCol: number[] = Array.from({ length: numCols }, (_, c) => (Array.isArray(ins?.[c]) ? ins[c].length : 0));
  let targetRemovalsPerCol: number[] = insCountByCol.slice();

  // Helper to pick and mark a position for a symbol in a preferred column
  function pickAndMark(symbol: number, preferredCol: number | null): boolean {
    const list = positionsBySymbol[symbol] || [];
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (removeMask[p.col][p.row]) continue; // already marked
      if (preferredCol !== null && p.col !== preferredCol) continue;
      removeMask[p.col][p.row] = true;
      // Remove from list for efficiency
      list.splice(i, 1);
      return true;
    }
    return false;
  }

  // First pass: satisfy per-column targets using outs composition
  for (const out of outs) {
    let remaining = Number(out?.count || 0);
    const targetSymbol = Number(out?.symbol);
    if (isNaN(remaining) || isNaN(targetSymbol) || remaining <= 0) continue;
    // Try to allocate removals in columns that expect incoming symbols first
    while (remaining > 0) {
      let allocated = false;
      for (let col = 0; col < numCols && remaining > 0; col++) {
        if (targetRemovalsPerCol[col] <= 0) continue;
        if (pickAndMark(targetSymbol, col)) {
          targetRemovalsPerCol[col]--;
          remaining--;
          allocated = true;
        }
      }
      if (!allocated) break; // proceed to second pass
    }
    // Second pass: allocate any remainder anywhere
    while (remaining > 0) {
      if (pickAndMark(targetSymbol, null)) {
        remaining--;
      } else {
        console.warn('[Symbols] Not enough matching symbols in grid to satisfy tumble outs for symbol', targetSymbol);
        break;
      }
    }
  }

  // Debug: per-column removal vs incoming
  try {
    const removedPerCol: number[] = Array.from({ length: numCols }, () => 0);
    for (let col = 0; col < numCols; col++) {
      for (let row = 0; row < numRows; row++) {
        if (removeMask[col][row]) removedPerCol[col]++;
      }
    }
    console.log('[Symbols] Tumble per-column removal vs incoming:', removedPerCol.map((r, c) => ({ col: c, removed: r, incoming: insCountByCol[c] })));
  } catch {}

  // Debug: report which cells are marked for removal per symbol
  try {
    const removedBySymbol: { [key: number]: Array<{ col: number; row: number }> } = {};
    let totalRemoved = 0;
    for (let col = 0; col < numCols; col++) {
      for (let row = 0; row < numRows; row++) {
        if (removeMask[col][row]) {
          const val = self.currentSymbolData?.[row]?.[col];
          const key = typeof val === 'number' ? val : -1;
          if (!removedBySymbol[key]) removedBySymbol[key] = [];
          removedBySymbol[key].push({ col, row });
          totalRemoved++;
        }
      }
    }
    console.log('[Symbols] Tumble removal mask summary:', { totalRemoved, removedBySymbol });
  } catch {}

  // Attach ONE win text per winning symbol value, prioritizing columns 2–5 (1–4 zero-based)
  try {
    // Build removal positions by symbol value
    const positionsForSymbol: { [key: number]: Array<{ col: number; row: number }> } = {};
    for (let col = 0; col < numCols; col++) {
      for (let row = 0; row < numRows; row++) {
        if (!removeMask[col][row]) continue;
        const val = self.currentSymbolData?.[row]?.[col];
        if (typeof val !== 'number') continue;
        if (!positionsForSymbol[val]) positionsForSymbol[val] = [];
        positionsForSymbol[val].push({ col, row });
      }
    }
    // Map of per-symbol win amount from outs
    const winBySymbol: { [key: number]: number } = {};
    for (const out of outs as any[]) {
      const s = Number((out as any)?.symbol);
      const w = Number((out as any)?.win);
      if (!isNaN(s) && !isNaN(w) && w > 0) winBySymbol[s] = w;
    }
    const tumbleWin = Number((tumble as any)?.win || 0);
    // Choose one position per winning symbol and display text
    let winTrackerShown = false;
    for (const keyStr of Object.keys(positionsForSymbol)) {
      const sym = Number(keyStr);
      const list = positionsForSymbol[sym] || [];
      if (!list.length) continue;
      // Prioritize columns 1..4 (2–5 human)
      const priority = list.filter(p => p.col >= 1 && p.col <= 4);
      const pool = priority.length ? priority : list;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      const obj = self.symbols[pick.col][pick.row];
      if (!obj) continue;
      const amount = (winBySymbol[sym] !== undefined) ? winBySymbol[sym] : (tumbleWin > 0 ? tumbleWin : 0);
      if (amount <= 0) continue;
      // Remove any previous win text on this symbol
      try {
        const prev: any = (obj as any).__winText;
        if (prev && prev.destroy && !prev.destroyed) prev.destroy();
      } catch {}
      // Delay win text to appear ~0.8s after the win animation is triggered
      const baseX = obj.x;
      const baseY = obj.y;
      self.scene.time.delayedCall(800, () => {
        // If scene or container is gone, skip
        try {
          if (!self || !self.scene || !self.container) return;
        } catch { return; }
        // Show WinTracker once at the same moment win text appears
        try {
          if (!winTrackerShown) {
            winTrackerShown = true;
            const wt = (self.scene as any)?.winTracker;
            if (wt) {
              // Announce win start here so coins and listeners sync with text timing
              try { gameEventManager.emit(GameEventType.WIN_START); } catch {}
              // Show only the current tumble's wins
              try {
                const outsArr = Array.isArray((tumble as any)?.symbols?.out) ? (tumble as any).symbols.out : [];
                wt.showForTumble(outsArr, self.currentSpinData || null);
              } catch {
                wt.updateFromSpinData(self.currentSpinData || null);
                wt.showLatest();
              }
              // Do not auto-hide WinTracker here; it will persist until a new spin starts,
              // at which point the Game scene explicitly clears it.
            }
          }
        } catch {}
        // Create and place text
        const txt = createWinText(self, amount, baseX, baseY);
        try { txt.setDepth(700); } catch {}
        self.container.add(txt);
        try { (obj as any).__winText = txt; } catch {}
        // Animate: single pop on appear, then rise and fade
        try {
          const baseSX = (txt as any)?.scaleX ?? 1;
          const baseSY = (txt as any)?.scaleY ?? 1;
          self.scene.tweens.add({
            targets: txt,
            scaleX: baseSX * 1.12,
            scaleY: baseSY * 1.12,
            duration: 160,
            yoyo: true,
            repeat: 0,
            ease: Phaser.Math.Easing.Cubic.Out,
          });
        } catch {}
        try {
          const rise = Math.max(8, Math.round(self.displayHeight * 0.25));
            const holdDuration = Math.max(1000, (self.scene?.gameData?.winUpDuration || 700) + 0);
            const fadeDuration = Math.max(600, (self.scene?.gameData?.winUpDuration || 700) + 0);
          self.scene.tweens.chain({
            targets: txt,
            tweens: [
              {
                y: txt.y - rise,
                duration: holdDuration,
                ease: Phaser.Math.Easing.Cubic.Out,
              },
              {
                alpha: 0,
                duration: fadeDuration,
                ease: Phaser.Math.Easing.Cubic.Out,
                onComplete: () => {
                  try {
                    if (txt && (txt as any).destroy && !(txt as any).destroyed) (txt as any).destroy();
                    if (obj && (obj as any).__winText === txt) (obj as any).__winText = null;
                  } catch {}
                }
              }
            ]
          });
        } catch {}
      });
    }
  } catch {}

  // Animate removal: for high-count sugar symbols (1..9), play SW_Win before destroy; otherwise fade out
  const removalPromises: Promise<void>[] = [];
  const STAGGER_MS = 50; // match drop sequence stagger (shortened)
  // Track first win animation notification (we now trigger on animation start for better SFX sync)
  let firstWinNotified = false;
  function notifyFirstWinIfNeeded() {
    if (!firstWinNotified) {
      firstWinNotified = true;
      console.log(`[Symbols] notifyFirstWinIfNeeded called for tumble index: ${tumbleIndex} (first win animation started)`);
      try {
        // Compute tumble total similarly here for safety
        let tumbleTotal = 0;
        try {
          const tw = Number((tumble as any)?.win ?? 0);
          if (!isNaN(tw) && tw > 0) {
            tumbleTotal = tw;
          } else {
            const outsArr = Array.isArray((tumble as any)?.symbols?.out) ? (tumble as any).symbols.out as Array<{ win?: number }> : [];
            tumbleTotal = outsArr.reduce((s, o) => s + (Number(o?.win) || 0), 0);
          }
        } catch {}
        if (typeof onFirstWinComplete === 'function') {
          onFirstWinComplete(tumbleTotal);
        }
      } catch {}
    } else {
      console.log(`[Symbols] notifyFirstWinIfNeeded called again for tumble index: ${tumbleIndex} (already notified, skipping)`);
    }
  }
  for (let col = 0; col < numCols; col++) {
    for (let row = 0; row < numRows; row++) {
      if (removeMask[col][row]) {
        const obj = self.symbols[col][row];
        if (obj) {
          removalPromises.push(new Promise<void>((resolve) => {
            try {
              const value = self.currentSymbolData?.[row]?.[col];
              const multiBase = typeof value === 'number' ? getMultiplierAnimationBase(value) : null;
              const canPlaySugarWin = typeof value === 'number' && value >= 1 && value <= 9 && highCountSymbols.has(value) && obj.animationState && obj.animationState.setAnimation;
              // For multipliers, allow win animation only when this item actually had wins
              const canPlayMultiplierWin = !!multiBase && !!(self as any).hadWinsInCurrentItem && obj.animationState && obj.animationState.setAnimation;
              // Get the win animation name: symbols 0-9 use Symbol{value}_FIS_Win, multipliers 10-22 use Symbol{10|11|12}_FIS_Win
              if (canPlaySugarWin || canPlayMultiplierWin) {
                try { if (obj.animationState.clearTracks) obj.animationState.clearTracks(); } catch {}
                // For multipliers, use the specific win animation name (Symbol10_FIS_Win, Symbol11_FIS_Win, or Symbol12_FIS_Win)
                // For sugar symbols (0-9), use Symbol{value}_FIS_Win
                const winAnim = (typeof value === 'number' && value >= 10 && value <= 22)
                  ? (getMultiplierWinAnimationName(value) || 'animation')
                  : (typeof value === 'number' && value >= 0 && value <= 9)
                    ? `Symbol${value}_FIS_Win`
                    : 'animation';
                let completed = false;
                try {
                  // Resume animation if it was frozen (for symbols 0-12)
                  if (canPlaySugarWin && obj.animationState.timeScale !== undefined) {
                    obj.animationState.timeScale = 1;
                  }
                  
                  // First: Scale up the symbol, then play win animation after scale-up completes
                  const baseX = obj?.scaleX ?? 1;
                  const baseY = obj?.scaleY ?? 1;
                  const targetX = baseX * 1.6;
                  const targetY = baseY * 1.6;
                  const scaleUpDuration = 200; // Duration of scale-up animation
                  // Default safety window uses previous timing but can be extended once we know the real animation length
                  let safetyDelayMs = scaleUpDuration + self.scene.gameData.winUpDuration + 700;
                  
                  // Scale up first
                  self.scene.tweens.add({
                    targets: obj,
                    scaleX: targetX,
                    scaleY: targetY,
                    duration: scaleUpDuration,
                    ease: Phaser.Math.Easing.Cubic.Out,
                    onComplete: () => {
                      // After scale-up completes, start the win animation
                      try {
                        if (obj.animationState.addListener) {
                          const listener = {
                            complete: (entry: any) => {
                              try {
                                if (!entry || entry.animation?.name !== winAnim) return;
                              } catch {}
                              if (completed) return; completed = true;
                              try { destroySymbolOverlays(obj); } catch {}
                              try { obj.destroy(); } catch {}
                              try { self.handleSymbolRemovedForScatterCounter(obj, 'tumble_remove'); } catch {}
                              self.symbols[col][row] = null as any;
                              if (self.currentSymbolData && self.currentSymbolData[row]) {
                                (self.currentSymbolData[row] as any)[col] = null;
                              }
                              resolve();
                            }
                          } as any;
                          obj.animationState.addListener(listener);
                        }
                        const winEntry = obj.animationState.setAnimation(0, winAnim, false);
                        // Slow down win animation for better visibility
                        let winAnimationDurationMs = 0;
                        if (winEntry) {
                          try {
                            const base = (typeof (winEntry as any).timeScale === 'number' && (winEntry as any).timeScale > 0)
                              ? (winEntry as any).timeScale
                              : 1;
                            (winEntry as any).timeScale = base * 0.7; // 30% slower for better visibility
                          } catch {}
                          try {
                            const rawDurationMs = Math.max(0, Number((winEntry as any)?.animation?.duration || 0) * 1000);
                            const appliedTimeScale = (winEntry as any)?.timeScale && (winEntry as any).timeScale > 0 ? (winEntry as any).timeScale : 1;
                            const scaledDurationMs = appliedTimeScale !== 0 ? rawDurationMs / appliedTimeScale : rawDurationMs;
                            winAnimationDurationMs = scaledDurationMs;
                            // Ensure the safety window is at least as long as the estimated animation runtime (+buffer)
                            safetyDelayMs = Math.max(
                              safetyDelayMs,
                              scaleUpDuration + scaledDurationMs + 400
                            );
                          } catch {}
                        } else if (obj.animationState.timeScale !== undefined) {
                          try {
                            obj.animationState.timeScale = 0.7; // 30% slower
                          } catch {}
                        }
                        // Log the tumble index when win animation starts
                        console.log(`[Symbols] Playing win animation "${winAnim}" for tumble index: ${tumbleIndex} (after scale-up)`);
                        
                        // Play VFX animation behind symbols 1-9, 0.5s before win animation ends
                        if (canPlaySugarWin && winAnimationDurationMs > 0) {
                          playSymbolVFX(self, obj, winAnimationDurationMs);
                        }
                        
                        // First win animation just started – notify once so header + SFX sync with visuals
                        notifyFirstWinIfNeeded();
                        // Safety timeout in case complete isn't fired (uses the final computed duration)
                        self.scene.time.delayedCall(safetyDelayMs, () => {
                          if (completed) return; completed = true;
                          try { destroySymbolOverlays(obj); } catch {}
                          try { obj.destroy(); } catch {}
                          try { self.handleSymbolRemovedForScatterCounter(obj, 'tumble_remove'); } catch {}
                          self.symbols[col][row] = null as any;
                          if (self.currentSymbolData && self.currentSymbolData[row]) {
                            (self.currentSymbolData[row] as any)[col] = null;
                          }
                          resolve();
                        });
                      } catch (e) {
                        console.warn('[Symbols] Error starting win animation after scale-up:', e);
                        // Fallback: resolve immediately if animation fails
                        if (!completed) {
                          completed = true;
                          try { destroySymbolOverlays(obj); } catch {}
                          try { obj.destroy(); } catch {}
                          try { self.handleSymbolRemovedForScatterCounter(obj, 'tumble_remove'); } catch {}
                          self.symbols[col][row] = null as any;
                          if (self.currentSymbolData && self.currentSymbolData[row]) {
                            (self.currentSymbolData[row] as any)[col] = null;
                          }
                          resolve();
                        }
                      }
                    }
                  });
                } catch {
                  // Fallback to fade if animation fails
                  try { self.scene.tweens.killTweensOf(obj); } catch {}
                  const tweenTargets: any = getSymbolTweenTargets(obj);
                  self.scene.tweens.add({
                    targets: tweenTargets,
                    alpha: 0,
                    // No scale change to avoid perceived scale-up/down
                    duration: self.scene.gameData.winUpDuration,
                    ease: Phaser.Math.Easing.Cubic.In,
                    onComplete: () => {
                      try { destroySymbolOverlays(obj); } catch {}
                      try { obj.destroy(); } catch {}
                      try { self.handleSymbolRemovedForScatterCounter(obj, 'tumble_remove'); } catch {}
                      self.symbols[col][row] = null as any;
                      if (self.currentSymbolData && self.currentSymbolData[row]) {
                        (self.currentSymbolData[row] as any)[col] = null;
                      }
                      resolve();
                    }
                  });
                }
              } else {
                // Non-sugar or low-count: soft fade without scale change
                try { self.scene.tweens.killTweensOf(obj); } catch {}
                const tweenTargets: any = getSymbolTweenTargets(obj);
                self.scene.tweens.add({
                  targets: tweenTargets,
                  alpha: 0,
                  // No scale change
                  duration: self.scene.gameData.winUpDuration,
                  ease: Phaser.Math.Easing.Cubic.In,
                  onComplete: () => {
                    try { destroySymbolOverlays(obj); } catch {}
                    try { obj.destroy(); } catch {}
                    try { self.handleSymbolRemovedForScatterCounter(obj, 'tumble_remove'); } catch {}
                    // Leave null placeholder for compression step
                    self.symbols[col][row] = null as any;
                    if (self.currentSymbolData && self.currentSymbolData[row]) {
                      (self.currentSymbolData[row] as any)[col] = null;
                    }
                    resolve();
                  }
                });
              }
            } catch {
              try { obj.destroy(); } catch {}
              try { self.handleSymbolRemovedForScatterCounter(obj, 'tumble_remove'); } catch {}
              self.symbols[col][row] = null as any;
              if (self.currentSymbolData && self.currentSymbolData[row]) {
                (self.currentSymbolData[row] as any)[col] = null;
              }
              resolve();
            }
          }));
        } else {
          try { self.handleSymbolRemovedForScatterCounter(obj, 'tumble_remove'); } catch {}
          self.symbols[col][row] = null as any;
          if (self.currentSymbolData && self.currentSymbolData[row]) {
            (self.currentSymbolData[row] as any)[col] = null;
          }
        }
      }
    }
  }

  await Promise.all(removalPromises);
  // If we had a tumble win but did not notify (e.g., no win animations played), notify now
  try {
    if (!firstWinNotified) {
      const w = Number((tumble as any)?.win ?? 0);
      const outsArr = Array.isArray((tumble as any)?.symbols?.out) ? (tumble as any).symbols.out as Array<{ win?: number }> : [];
      const sumOuts = outsArr.reduce((s, o) => s + (Number(o?.win) || 0), 0);
      const tumbleTotal = (!isNaN(w) && w > 0) ? w : sumOuts;
      if (tumbleTotal > 0) {
        notifyFirstWinIfNeeded();
      }
    }
  } catch {}

  // --- Tumble pre-compression anticipation (2 scatters on screen) ---
  // Requirement:
  // - After win animations finish, if there are currently 2 scatters on screen and a tumble happens,
  //   pause before compressing, show anticipation on the FIRST column that needs compressing,
  //   then compress + drop that column slower (others unchanged).
  let preTumbleAnticipationCol: number | null = null;
  let preTumbleAnticipationActive: boolean = false;
  try {
    const scatterCountNow =
      typeof (self as any).getScatterOnScreenCount === 'function'
        ? Number((self as any).getScatterOnScreenCount())
        : Number((self as any).scatterOnScreenCount || 0);

    // Only if there is a tumble "change" (removals happened). If nothing was removed,
    // there is no compression column to anticipate.
    // Trigger anticipation when we have at least 2 scatters visible (2 or 3).
    if (scatterCountNow >= 2 && scatterCountNow <= 3) {
      let firstColNeedingCompression = -1;
      for (let c = 0; c < numCols; c++) {
        let keptCount = 0;
        for (let r = 0; r < numRows; r++) {
          if (self.symbols[c][r]) keptCount++;
        }
        if (keptCount < numRows) { firstColNeedingCompression = c; break; }
      }

      if (firstColNeedingCompression >= 0) {
        preTumbleAnticipationCol = firstColNeedingCompression;
        preTumbleAnticipationActive = true;

        // Enable anticipation for this tumble step even though we only have 2 scatters.
        try { (self as any).__scatterAnticipationEnabled = true; } catch {}
        try { (self as any).__scatterAnticipationActiveCol = firstColNeedingCompression; } catch {}
        try { (self as any).__scatterAnticipationPendingByCol = Array.from({ length: numCols }, () => 0); } catch {}
        try { (self.scene as any).__isScatterAnticipationActive = true; } catch {}

        // Show anticipation spine aligned to this column.
        try {
          const ctrl: any = (self.scene as any)?.scatterAnticipation;
          if (ctrl) {
            const symbolTotalWidth = self.displayWidth + self.horizontalSpacing;
            const startX = self.slotX - self.totalGridWidth * 0.5;
            const xPos = startX + firstColNeedingCompression * symbolTotalWidth + symbolTotalWidth * 0.5;
            try { if (typeof ctrl.setDesiredHeight === 'function') ctrl.setDesiredHeight(self.totalGridHeight); } catch {}
            // Nudge slightly left to better visually center on the column.
            try { if (typeof ctrl.setPosition === 'function') ctrl.setPosition(xPos - (symbolTotalWidth * 0.03), self.slotY + (self.totalGridHeight * 0.05)); } catch {}
            try { if (typeof ctrl.show === 'function') ctrl.show(); } catch {}
          }
        } catch {}

        // Pause briefly BEFORE compression starts.
        try {
          const base = Number(self.scene?.gameData?.winUpDuration ?? 0);
          const pauseMs = Math.max(450, Math.round(base * 2));
          await delay(pauseMs);
        } catch {
          await delay(500);
        }
      }
    }
  } catch {}

  // Compress each column downwards and compute target indices for remaining symbols
  const symbolTotalHeight = self.displayHeight + self.verticalSpacing;
  const startY = self.slotY - self.totalGridHeight * 0.5;

  // Prepare a new grid to place references post-compression
  const newGrid: any[][] = Array.from({ length: numCols }, () => Array<any>(numRows).fill(null));
  const compressPromises: Promise<void>[] = [];
  // In anticipation-triggered tumbles, we need to run compression sequentially per column,
  // so we collect per-column compression moves instead of starting all tweens immediately.
  const compressionMovesByCol: Array<Array<{ targets: any; y: number; baseDuration: number; ease: any }>> =
    Array.from({ length: numCols }, () => []);

  for (let col = 0; col < numCols; col++) {
    const kept: Array<{ obj: any, oldRow: number }> = [];
    for (let row = 0; row < numRows; row++) {
      const obj = self.symbols[col][row];
      if (obj) kept.push({ obj, oldRow: row });
    }
    const bottomStart = numRows - kept.length; // first row index for packed symbols at bottom
    kept.forEach((entry, idx) => {
      const obj = entry.obj;
      const oldRow = entry.oldRow;
      const newRow = bottomStart + idx;
      const targetY = startY + newRow * symbolTotalHeight + symbolTotalHeight * 0.5;
      newGrid[col][newRow] = obj;
      // Track updated logical grid coordinates on the symbol
      try { (obj as any).__gridCol = col; (obj as any).__gridRow = newRow; } catch {}
      const needsMove = newRow !== oldRow;
      if (!needsMove) {
        // No movement needed; ensure y is correct and resolve immediately
        try {
          if (typeof obj.setY === 'function') obj.setY(targetY);
          const winTextObj: any = (obj as any)?.__winText;
          if (winTextObj && typeof winTextObj.setY === 'function') winTextObj.setY(targetY);
        } catch {}
        return; // no promise push to avoid waiting on a non-existent tween
      }
      compressPromises.push(new Promise<void>((resolve) => {
        try {
          const tweenTargetsMove: any = getSymbolTweenTargets(obj);
          const isTurbo = !!self.scene.gameData?.isTurbo;
          const baseDuration = self.scene.gameData.dropDuration;
          // Use a slightly shorter duration in turbo, but long enough for easing
          // to be visible so the motion doesn't feel rigid.
          const baseCompressionDuration = isTurbo
            ? Math.max(160, baseDuration * 0.6)
            : baseDuration;
          const easeFn =
            self.scene.gameData?.isTurbo
              ? Phaser.Math.Easing.Cubic.Out
              : Phaser.Math.Easing.Bounce.Out;
          const baseDelayMultiplier = (self.scene?.gameData?.compressionDelayMultiplier ?? 1);
          const colDelay = STAGGER_MS * col * baseDelayMultiplier;
          // In turbo, keep some stagger but reduce it so columns still feel snappy.
          const delay = isTurbo ? colDelay * 0.4 : colDelay;
          if (preTumbleAnticipationActive && preTumbleAnticipationCol !== null) {
            // Defer actual tween start; we'll run column-by-column later.
            compressionMovesByCol[col].push({
              targets: tweenTargetsMove,
              y: targetY,
              baseDuration: baseCompressionDuration,
              ease: easeFn
            });
            resolve();
          } else {
            self.scene.tweens.add({
              targets: tweenTargetsMove,
              y: targetY,
              delay,
              duration: baseCompressionDuration,
              // In turbo mode, keep motion snappy but smoothly decelerating
              ease: easeFn,
              onComplete: () => resolve(),
            });
          }
        } catch { resolve(); }
      }));
    });
  }

  // Overlap-aware drop scheduling: if enabled, start drops during compression; otherwise, drop after compression completes
  const overlapDrops = !!(self.scene?.gameData?.tumbleOverlapDropsDuringCompression);
  const effectiveOverlapDrops = overlapDrops || (preTumbleAnticipationActive && preTumbleAnticipationCol !== null);
  const dropPromises: Promise<void>[] = [];
  const symbolTotalWidth = self.displayWidth + self.horizontalSpacing;
  const startX = self.slotX - self.totalGridWidth * 0.5;
  let totalSpawned = 0;

  // --- Scatter anticipation (tumble drops) ---
  function isScatterObj(obj: any): boolean {
    try {
      const v = (obj as any)?.symbolValue;
      if (v === 0) return true;
      if ((obj as any)?.texture?.key === 'symbol_0') return true;
    } catch {}
    return false;
  }

  function moveAndShowForColumn(col: number, x: number): void {
    try {
      const enabled = !!(self as any).__scatterAnticipationEnabled;
      if (!enabled) return;
      const ctrl: any = (self.scene as any)?.scatterAnticipation;
      if (!ctrl) return;
      (self as any).__scatterAnticipationActiveCol = col;
      try { (self.scene as any).__isScatterAnticipationActive = true; } catch {}
      try { if (typeof ctrl.setDesiredHeight === 'function') ctrl.setDesiredHeight(self.totalGridHeight); } catch {}
      // Nudge slightly left to better visually center on the column.
      try { if (typeof ctrl.setPosition === 'function') ctrl.setPosition(x - ((self.displayWidth + self.horizontalSpacing) * 0.03), self.slotY + (self.totalGridHeight * 0.02)); } catch {}
      try { if (typeof ctrl.show === 'function') ctrl.show(); } catch {}
    } catch {}
  }

  function onTumbleSymbolDropComplete(col: number, createdObj: any): void {
    try {
      if (isScatterObj(createdObj)) {
        const before = Number((self as any).__scatterAnticipationLandedScatterCount || 0);
        const after = before + 1;
        (self as any).__scatterAnticipationLandedScatterCount = after;
      }

      const pending: number[] = (self as any).__scatterAnticipationPendingByCol || [];
      if (Array.isArray(pending)) {
        pending[col] = Math.max(0, Number(pending[col] || 0) - 1);
        const activeCol = (self as any).__scatterAnticipationActiveCol;
        if (pending[col] === 0 && activeCol === col) {
          const ctrl: any = (self.scene as any)?.scatterAnticipation;
          try { if (ctrl && typeof ctrl.hide === 'function') ctrl.hide(); } catch {}
          try { (self.scene as any).__isScatterAnticipationActive = false; } catch {}
          (self as any).__scatterAnticipationActiveCol = null;
        }
      }
    } catch {}

    // Scatter-on-screen counter (increment on drop completion)
    try { self.handleSymbolDropCompleteForScatterCounter(createdObj, 'tumble_drop'); } catch {}
  }

  // Initialize tumble anticipation state based on currently-visible scatters (after compression).
  try {
    let baseScatterCount = 0;
    for (let c = 0; c < numCols; c++) {
      for (let r = 0; r < numRows; r++) {
        const o = newGrid?.[c]?.[r];
        if (o && isScatterObj(o)) baseScatterCount++;
      }
    }
    (self as any).__scatterAnticipationLandedScatterCount = baseScatterCount;
    // If we already started a pre-compression anticipation (2 scatters case), do not clobber its state.
    if (!preTumbleAnticipationActive) {
      // No default anticipation for 3+ scatters anymore; only the 2-scatter pre-compression trigger uses it.
      (self as any).__scatterAnticipationEnabled = false;
      (self as any).__scatterAnticipationActiveCol = null;
      (self as any).__scatterAnticipationPendingByCol = Array.from({ length: numCols }, () => 0);
      try { (self.scene as any).__isScatterAnticipationActive = false; } catch {}
    } else {
      // Keep enabled + activeCol as-is; ensure we remain visible.
      try { (self as any).__scatterAnticipationEnabled = true; } catch {}
      try { (self.scene as any).__isScatterAnticipationActive = true; } catch {}
    }
  } catch {}

  if (effectiveOverlapDrops) {
    // Special case: during the anticipation-triggered tumble (scatterCount 2–3),
    // process columns SEQUENTIALLY: compress this column + drop its incoming symbols,
    // wait for both to finish, then move to the next column.
    if (preTumbleAnticipationActive && preTumbleAnticipationCol !== null) {
      // Replace grid immediately so top nulls represent empty slots while compression runs
      self.symbols = newGrid;
      // Update all objects with their current grid coordinates for consistency
      try {
        for (let c = 0; c < numCols; c++) {
          for (let r = 0; r < numRows; r++) {
            const o = self.symbols[c][r];
            if (o) { try { (o as any).__gridCol = c; (o as any).__gridRow = r; } catch {} }
          }
        }
      } catch {}
      // Rebuild currentSymbolData to reflect compressed positions now
      try {
        if (self.currentSymbolData) {
          const rebuilt: (number | null)[][] = Array.from({ length: numRows }, () => Array<number | null>(numCols).fill(null));
          for (let col = 0; col < numCols; col++) {
            const keptValues: number[] = [];
            for (let row = 0; row < numRows; row++) {
              const v = self.currentSymbolData[row]?.[col];
              if (typeof v === 'number') keptValues.push(v);
            }
            const bottomStart = numRows - keptValues.length;
            for (let i = 0; i < keptValues.length; i++) {
              const newRow = bottomStart + i;
              rebuilt[newRow][col] = keptValues[i];
            }
          }
          const finalized: number[][] = rebuilt.map(row => row.map(v => (typeof v === 'number' ? v : 0)));
          self.currentSymbolData = finalized;
        }
      } catch {}

      const ctrl: any = (self.scene as any)?.scatterAnticipation;
      const DROP_STAGGER_MS = (self.scene?.gameData?.tumbleDropStaggerMs ?? (MANUAL_STAGGER_MS * 0.25));
      const baseStartDelay = Number(self.scene?.gameData?.tumbleDropStartDelayMs ?? 0);
      const skipPreHop = !!(self.scene?.gameData?.tumbleSkipPreHop);
      const symbolHop = self.scene.gameData.winUpHeight * 0.5;
      const isTurbo = !!self.scene.gameData?.isTurbo;

      // During anticipation mode, apply the same slower feel on each processed column.
      const durMult = 1.6;
      // Increase per-symbol drop interval during anticipation
      const intervalMult = 0.5;

      for (let col = 0; col < numCols; col++) {
        const incoming = Array.isArray(ins?.[col]) ? ins[col] : [];

        let emptyCount = 0;
        for (let row = 0; row < numRows; row++) {
          if (!self.symbols[col][row]) emptyCount++;
          else break;
        }
        const spawnCount = Math.min(emptyCount, incoming.length);

        const hasCompressionMoves = Array.isArray(compressionMovesByCol[col]) && compressionMovesByCol[col].length > 0;
        if (!hasCompressionMoves && spawnCount === 0) continue;

        // Move anticipation to this column
        try {
          if (ctrl) {
            const xPos = startX + col * symbolTotalWidth + symbolTotalWidth * 0.5;
            try { if (typeof ctrl.setDesiredHeight === 'function') ctrl.setDesiredHeight(self.totalGridHeight); } catch {}
            // Nudge slightly left to better visually center on the column.
            try { if (typeof ctrl.setPosition === 'function') ctrl.setPosition(xPos - (symbolTotalWidth * 0.03), self.slotY + (self.totalGridHeight * 0.02)); } catch {}
            try { if (typeof ctrl.show === 'function') ctrl.show(); } catch {}
          }
        } catch {}
        try { (self as any).__scatterAnticipationEnabled = true; } catch {}
        try { (self as any).__scatterAnticipationActiveCol = col; } catch {}
        try { (self.scene as any).__isScatterAnticipationActive = true; } catch {}
        try {
          const pending: number[] = (self as any).__scatterAnticipationPendingByCol;
          if (Array.isArray(pending)) pending[col] = spawnCount;
        } catch {}

        // Start compression tweens for this column
        const compressColPromises: Promise<void>[] = [];
        try {
          const moves = compressionMovesByCol[col] || [];
          for (const m of moves) {
            compressColPromises.push(new Promise<void>((resolve) => {
              try {
                self.scene.tweens.add({
                  targets: m.targets,
                  y: m.y,
                  delay: 0,
                  duration: Math.max(160, Number(m.baseDuration || 0) * durMult),
                  ease: m.ease,
                  onComplete: () => resolve(),
                });
              } catch { resolve(); }
            }));
          }
        } catch {}

        // Spawn + drop incoming symbols for this column (with per-symbol interval)
        const dropColPromises: Promise<void>[] = [];
        for (let j = 0; j < spawnCount; j++) {
          const targetRow = Math.max(0, emptyCount - 1 - j);
          const targetY = startY + targetRow * symbolTotalHeight + symbolTotalHeight * 0.5;
          const xPos = startX + col * symbolTotalWidth + symbolTotalWidth * 0.5;

          const srcIndex = Math.max(0, incoming.length - 1 - j);
          const value = incoming[srcIndex];
          const startYPos = targetY - self.scene.scale.height;
          const created: any = createSugarOrPngSymbol(self, value, xPos, startYPos, 1);
          self.symbols[col][targetRow] = created;
          try { (created as any).__gridCol = col; (created as any).__gridRow = targetRow; } catch {}
          if (self.currentSymbolData && self.currentSymbolData[targetRow]) {
            (self.currentSymbolData[targetRow] as any)[col] = value;
          }
          try { playDropAnimationIfAvailable(created); } catch {}

          dropColPromises.push(new Promise<void>((resolve) => {
            try {
              const computedStartDelay = baseStartDelay + (DROP_STAGGER_MS * j * intervalMult);
              const tweensArr: any[] = [];
              if (!skipPreHop) {
                tweensArr.push({
                  delay: computedStartDelay,
                  y: `-= ${symbolHop}`,
                  duration: Math.max(0, self.scene.gameData.winUpDuration * durMult),
                  ease: Phaser.Math.Easing.Circular.Out,
                });
                tweensArr.push({
                  y: targetY,
                  duration: Math.max(160, (self.scene.gameData.dropDuration * 0.9) * durMult),
                  ease: Phaser.Math.Easing.Linear,
                });
              } else {
                tweensArr.push({
                  delay: computedStartDelay,
                  y: targetY,
                  duration: Math.max(160, (self.scene.gameData.dropDuration * 0.9) * durMult),
                  ease: Phaser.Math.Easing.Linear,
                });
              }

              if (!isTurbo) {
                tweensArr.push(
                  { y: `+= ${10}`, duration: self.scene.gameData.dropDuration * 0.05, ease: Phaser.Math.Easing.Linear },
                  {
                    y: `-= ${10}`,
                    duration: self.scene.gameData.dropDuration * 0.05,
                    ease: Phaser.Math.Easing.Linear,
                    onComplete: () => {
                      try { onTumbleSymbolDropComplete(col, created); } catch {}
                      resolve();
                    }
                  }
                );
              } else {
                const last = tweensArr[tweensArr.length - 1];
                const prevOnComplete = last.onComplete;
                last.onComplete = () => {
                  try { if (prevOnComplete) prevOnComplete(); } catch {}
                  try { onTumbleSymbolDropComplete(col, created); } catch {}
                  resolve();
                };
              }

              try { self.scene.tweens.chain({ targets: getSymbolTweenTargets(created), tweens: tweensArr }); }
              catch { self.scene.tweens.chain({ targets: created, tweens: tweensArr }); }
            } catch { resolve(); }
          }));

          totalSpawned++;
        }

        // Wait for this column's compression + drops before moving to next column.
        await Promise.all([...compressColPromises, ...dropColPromises]);

        // If this column had no incoming, we must hide manually (pending won't reach 0).
        if (spawnCount === 0) {
          try { if (ctrl && typeof ctrl.hide === 'function') ctrl.hide(); } catch {}
          try { (self.scene as any).__isScatterAnticipationActive = false; } catch {}
          try { (self as any).__scatterAnticipationActiveCol = null; } catch {}
        }
      }

      // Ensure anticipation is hidden after the sequential process ends.
      try { if (ctrl && typeof ctrl.hide === 'function') ctrl.hide(); } catch {}
      try { (self.scene as any).__isScatterAnticipationActive = false; } catch {}
      try { (self as any).__scatterAnticipationActiveCol = null; } catch {}

      // Skip the default overlapDrops scheduling below (we already did compress+drop sequentially).
    } else {
    // Replace grid immediately so top nulls represent empty slots while compression runs
    self.symbols = newGrid;
    // Update all objects with their current grid coordinates for consistency
    try {
      for (let c = 0; c < numCols; c++) {
        for (let r = 0; r < numRows; r++) {
          const o = self.symbols[c][r];
          if (o) { try { (o as any).__gridCol = c; (o as any).__gridRow = r; } catch {} }
        }
      }
    } catch {}
    // Rebuild currentSymbolData to reflect compressed positions now
    try {
      if (self.currentSymbolData) {
        const rebuilt: (number | null)[][] = Array.from({ length: numRows }, () => Array<number | null>(numCols).fill(null));
        for (let col = 0; col < numCols; col++) {
          const keptValues: number[] = [];
          for (let row = 0; row < numRows; row++) {
            const v = self.currentSymbolData[row]?.[col];
            if (typeof v === 'number') keptValues.push(v);
          }
          const bottomStart = numRows - keptValues.length;
          for (let i = 0; i < keptValues.length; i++) {
            const newRow = bottomStart + i;
            rebuilt[newRow][col] = keptValues[i];
          }
        }
        const finalized: number[][] = rebuilt.map(row => row.map(v => (typeof v === 'number' ? v : 0)));
        self.currentSymbolData = finalized;
      }
    } catch {}

    // Start drops now, while compression tweens are in-flight
    for (let col = 0; col < numCols; col++) {
      const incoming = Array.isArray(ins?.[col]) ? ins[col] : [];
      if (incoming.length === 0) continue;

      let emptyCount = 0;
      for (let row = 0; row < numRows; row++) {
        if (!self.symbols[col][row]) emptyCount++;
        else break;
      }
      const spawnCount = Math.min(emptyCount, incoming.length);
      console.log(`[Symbols] (overlap) Column ${col}: empty=${emptyCount}, incoming=${incoming.length}, spawning=${spawnCount}`);
      for (let j = 0; j < spawnCount; j++) {
        const targetRow = Math.max(0, emptyCount - 1 - j);
        const targetY = startY + targetRow * symbolTotalHeight + symbolTotalHeight * 0.5;
        const xPos = startX + col * symbolTotalWidth + symbolTotalWidth * 0.5;

        const srcIndex = Math.max(0, incoming.length - 1 - j);
        const value = incoming[srcIndex];
        // Ensure spawned symbols always start ABOVE their own target position so they fall downward.
        const startYPos = targetY - self.scene.scale.height;
        const created: any = createSugarOrPngSymbol(self, value, xPos, startYPos, 1);

        self.symbols[col][targetRow] = created;
        try { (created as any).__gridCol = col; (created as any).__gridRow = targetRow; } catch {}
        if (self.currentSymbolData && self.currentSymbolData[targetRow]) {
          (self.currentSymbolData[targetRow] as any)[col] = value;
        }
        try { playDropAnimationIfAvailable(created); } catch {}

        // Track pending drops per column so we can hide after the column is fully done.
        try {
          const pending: number[] = (self as any).__scatterAnticipationPendingByCol;
          if (Array.isArray(pending)) pending[col] = Number(pending[col] || 0) + 1;
        } catch {}

        const DROP_STAGGER_MS = (self.scene?.gameData?.tumbleDropStaggerMs ?? (MANUAL_STAGGER_MS * 0.25));
        const symbolHop = self.scene.gameData.winUpHeight * 0.5;
        const isTurbo = !!self.scene.gameData?.isTurbo;
        const isPreAnticipationCol = preTumbleAnticipationActive && preTumbleAnticipationCol === col;
        const durMult = isPreAnticipationCol ? 1.6 : 1;
        // Increase interval between drops for the anticipation-triggered column.
        const anticipationGapMult = isPreAnticipationCol ? 2.25 : 1;
        const scheduleDrop = () => new Promise<void>((resolve) => {
          try {
            // In slow mode, we do not use sequenceIndex-based time offsets; we chain drops instead.
            // For the anticipation-triggered column, increase the start interval.
            const computedStartDelay =
              (self.scene?.gameData?.tumbleDropStartDelayMs ?? 0) + (DROP_STAGGER_MS * sequenceIndex * anticipationGapMult);
            const skipPreHop = !!(self.scene?.gameData?.tumbleSkipPreHop);
            const tweensArr: any[] = [];
            if (!skipPreHop) {
              tweensArr.push({
                delay: computedStartDelay,
                y: `-= ${symbolHop}`,
                duration: Math.max(0, self.scene.gameData.winUpDuration * durMult),
                ease: Phaser.Math.Easing.Circular.Out,
                onStart: () => {
                  try { moveAndShowForColumn(col, (created as any)?.x ?? 0); } catch {}
                }
              });
              tweensArr.push({
                y: targetY,
                duration: Math.max(160, (self.scene.gameData.dropDuration * 0.9) * durMult),
                ease: Phaser.Math.Easing.Linear,
              });
            } else {
              tweensArr.push({
                delay: computedStartDelay,
                y: targetY,
                duration: Math.max(160, (self.scene.gameData.dropDuration * 0.9) * durMult),
                ease: Phaser.Math.Easing.Linear,
                onStart: () => {
                  try { moveAndShowForColumn(col, (created as any)?.x ?? 0); } catch {}
                }
              });
            }
            if (!isTurbo) {
              // Normal mode: include the small post-drop bounce and SFX
              tweensArr.push(
                {
                  y: `+= ${10}`,
                  duration: self.scene.gameData.dropDuration * 0.05,
                  ease: Phaser.Math.Easing.Linear,
                },
                {
                  y: `-= ${10}`,
                  duration: self.scene.gameData.dropDuration * 0.05,
                  ease: Phaser.Math.Easing.Linear,
                  onComplete: () => {
                    try {
                      if (!self.scene.gameData.isTurbo && (window as any).audioManager) {
                        (window as any).audioManager.playSoundEffect(SoundEffectType.REEL_DROP);
                      }
                    } catch {}
                    try { onTumbleSymbolDropComplete(col, created); } catch {}
                    resolve();
                  }
                }
              );
            } else {
              // Turbo mode: no post-drop bounce; resolve on the main drop completion
              const last = tweensArr[tweensArr.length - 1];
              const prevOnComplete = last.onComplete;
              last.onComplete = () => {
                try { 
                  if (prevOnComplete) prevOnComplete(); 
                  // Play tumble sound for every symbol dropped after compression in turbo mode
                  if ((window as any).audioManager) {
                    (window as any).audioManager.playSoundEffect(SoundEffectType.REEL_DROP);
                  }
                } catch (e) {
                  console.warn('[Symbols] Error playing reel drop sound in turbo mode:', e);
                }
                try { onTumbleSymbolDropComplete(col, created); } catch {}
                resolve();
              };
            }
            try { self.scene.tweens.chain({ targets: getSymbolTweenTargets(created), tweens: tweensArr }); }
            catch { self.scene.tweens.chain({ targets: created, tweens: tweensArr }); }
          } catch { resolve(); }
        });

        dropPromises.push(scheduleDrop());
        sequenceIndex++;
        totalSpawned++;
      }
    }

    // Wait for both compression and drop to finish
    await Promise.all([...compressPromises, ...dropPromises]);
    }
  } else {
    // Default behavior: wait compression, then set grid and drop
    await Promise.all(compressPromises);
    self.symbols = newGrid;
    // Update all objects with their current grid coordinates for consistency
    try {
      for (let c = 0; c < numCols; c++) {
        for (let r = 0; r < numRows; r++) {
          const o = self.symbols[c][r];
          if (o) { try { (o as any).__gridCol = c; (o as any).__gridRow = r; } catch {} }
        }
      }
    } catch {}
    try {
      if (self.currentSymbolData) {
        const rebuilt: (number | null)[][] = Array.from({ length: numRows }, () => Array<number | null>(numCols).fill(null));
        for (let col = 0; col < numCols; col++) {
          const keptValues: number[] = [];
          for (let row = 0; row < numRows; row++) {
            const v = self.currentSymbolData[row]?.[col];
            if (typeof v === 'number') keptValues.push(v);
          }
          const bottomStart = numRows - keptValues.length;
          for (let i = 0; i < keptValues.length; i++) {
            const newRow = bottomStart + i;
            rebuilt[newRow][col] = keptValues[i];
          }
        }
        const finalized: number[][] = rebuilt.map(row => row.map(v => (typeof v === 'number' ? v : 0)));
        self.currentSymbolData = finalized;
      }
    } catch {}

    for (let col = 0; col < numCols; col++) {
      const incoming = Array.isArray(ins?.[col]) ? ins[col] : [];
      if (incoming.length === 0) continue;
      let emptyCount = 0;
      for (let row = 0; row < numRows; row++) {
        if (!self.symbols[col][row]) emptyCount++;
        else break;
      }
      const spawnCount = Math.min(emptyCount, incoming.length);
      console.log(`[Symbols] Column ${col}: empty=${emptyCount}, incoming=${incoming.length}, spawning=${spawnCount}`);
      for (let j = 0; j < spawnCount; j++) {
        const targetRow = Math.max(0, emptyCount - 1 - j);
        const targetY = startY + targetRow * symbolTotalHeight + symbolTotalHeight * 0.5;
        const xPos = startX + col * symbolTotalWidth + symbolTotalWidth * 0.5;
        const srcIndex = Math.max(0, incoming.length - 1 - j);
        const value = incoming[srcIndex];
        // Ensure spawned symbols always start ABOVE their own target position so they fall downward.
        const startYPos = targetY - self.scene.scale.height;
        const created: any = createSugarOrPngSymbol(self, value, xPos, startYPos, 1);
        self.symbols[col][targetRow] = created;
        try { (created as any).__gridCol = col; (created as any).__gridRow = targetRow; } catch {}
        if (self.currentSymbolData && self.currentSymbolData[targetRow]) {
          (self.currentSymbolData[targetRow] as any)[col] = value;
        }
        try { playDropAnimationIfAvailable(created); } catch {}
        const DROP_STAGGER_MS = (self.scene?.gameData?.tumbleDropStaggerMs ?? (MANUAL_STAGGER_MS * 0.25));
        const symbolHop = self.scene.gameData.winUpHeight * 0.5;
        const isTurbo = !!self.scene.gameData?.isTurbo;
        const isPreAnticipationCol = preTumbleAnticipationActive && preTumbleAnticipationCol === col;
        // Increase interval between drops for the anticipation-triggered column.
        const anticipationGapMult = isPreAnticipationCol ? 2.25 : 1;
        const scheduleDrop = () => new Promise<void>((resolve) => {
          try {
            const computedStartDelay =
              (self.scene?.gameData?.tumbleDropStartDelayMs ?? 0) + (DROP_STAGGER_MS * sequenceIndex * anticipationGapMult);
            const skipPreHop = !!(self.scene?.gameData?.tumbleSkipPreHop);
            const tweensArr: any[] = [];
            if (!skipPreHop) {
              tweensArr.push({
                delay: computedStartDelay,
                y: `-= ${symbolHop}`,
                duration: self.scene.gameData.winUpDuration,
                ease: Phaser.Math.Easing.Circular.Out,
                onStart: () => {
                  try { moveAndShowForColumn(col, (created as any)?.x ?? 0); } catch {}
                }
              });
              tweensArr.push({ y: targetY, duration: (self.scene.gameData.dropDuration * 0.9), ease: Phaser.Math.Easing.Linear });
            } else {
              tweensArr.push({
                delay: computedStartDelay,
                y: targetY,
                duration: (self.scene.gameData.dropDuration * 0.9),
                ease: Phaser.Math.Easing.Linear,
                onStart: () => {
                  try { moveAndShowForColumn(col, (created as any)?.x ?? 0); } catch {}
                }
              });
            }
            if (!isTurbo) {
              // Normal mode: include the small post-drop bounce and SFX
              tweensArr.push(
                { y: `+= ${10}`, duration: self.scene.gameData.dropDuration * 0.05, ease: Phaser.Math.Easing.Linear },
                {
                  y: `-= ${10}`,
                  duration: self.scene.gameData.dropDuration * 0.05,
                  ease: Phaser.Math.Easing.Linear,
                  onComplete: () => {
                    try {
                      if (!self.scene.gameData.isTurbo && (window as any).audioManager) {
                        (window as any).audioManager.playSoundEffect(SoundEffectType.REEL_DROP);
                      }
                    } catch {}
                    try { onTumbleSymbolDropComplete(col, created); } catch {}
                    resolve();
                  }
                }
              );
            } else {
              // Turbo mode: no post-drop bounce; resolve on the main drop completion
              const last = tweensArr[tweensArr.length - 1];
              const prevOnComplete = last.onComplete;
              last.onComplete = () => {
                try { 
                  if (prevOnComplete) prevOnComplete(); 
                  // Play tumble sound for every symbol dropped after compression in turbo mode
                  if ((window as any).audioManager) {
                    (window as any).audioManager.playSoundEffect(SoundEffectType.REEL_DROP);
                  }
                } catch (e) {
                  console.warn('[Symbols] Error playing reel drop sound in turbo mode:', e);
                }
                try { onTumbleSymbolDropComplete(col, created); } catch {}
                resolve();
              };
            }
            self.scene.tweens.chain({ targets: created, tweens: tweensArr });
          } catch { resolve(); }
        });

        dropPromises.push(scheduleDrop());
        sequenceIndex++;
        totalSpawned++;
      }
    }
    await Promise.all(dropPromises);
  }

  // Debug: validate totals between outs and ins after spawn
  try {
    const totalOutRequested = outs.reduce((s, o) => s + (Number(o?.count) || 0), 0);
    if (totalOutRequested !== totalSpawned) {
      console.warn('[Symbols] Tumble total mismatch: out.count sum != spawned', {
        totalOutRequested,
        totalSpawned
      });
    } else {
      console.log('[Symbols] Tumble totals OK: removed == spawned', { totalSpawned });
    }
  } catch {}

  // Re-evaluate wins after each tumble drop completes
  try { reevaluateWinsFromGrid(self); } catch {}
  
  // Check for scatter hits from the updated grid after this tumble (both normal and bonus mode)
  try {
    // Scan the live symbols grid to find actual scatter objects and positions
    const grids: Array<{ x: number; y: number }> = [];
    if (self.symbols && self.symbols.length > 0) {
      for (let col = 0; col < self.symbols.length; col++) {
        const column = self.symbols[col];
        if (!Array.isArray(column)) continue;
        for (let row = 0; row < column.length; row++) {
          const obj: any = column[row];
          if (!obj) continue;
          const isScatter = (obj as any)?.symbolValue === 0 || (obj?.texture?.key === 'symbol_0');
          if (isScatter) grids.push({ x: col, y: row });
        }
      }
    }
    const count = grids.length;
    
    if (gameStateManager.isBonus) {
      // Bonus mode: check for retrigger (3+ scatters)
      if (count >= 3) {
        console.log(`[Symbols] Scatter detected during tumble in bonus: ${count} scatter(s)`);
        // Defer retrigger to run after all wins/tumbles/multipliers complete (WIN_STOP)
        if (!(self as any).pendingScatterRetrigger) {
          self.setPendingScatterRetrigger(grids);
          console.log('[Symbols] Scheduled retrigger sequence to run after WIN_STOP');
        } else {
          console.log('[Symbols] Retrigger already scheduled; skipping duplicate schedule');
        }
      }
    } else {
      // Normal mode: check for scatter trigger (4+ scatters)
      if (count >= 4 && !gameStateManager.isScatter) {
        console.log(`[Symbols] Scatter detected during tumble in normal mode: ${count} scatter(s)`);
        // Mark scatter as detected - the final scatter check after all tumbles will handle the animation
        gameStateManager.isScatter = true;
        console.log('[Symbols] Scatter marked for processing after all tumbles complete');
      }
    }
  } catch (e) {
    console.warn('[Symbols] Failed to evaluate scatter during tumble:', e);
  }
}


function replaceWithSpineAnimations(self: Symbols, data: Data) {
  const wins = data.wins;

  // Safety check: only proceed if wins exist and have the expected structure
  if (!wins || !wins.allMatching || wins.allMatching.size === 0) {
    console.log('[Symbols] No wins to process, skipping Spine animation replacement');
    return;
  }

  // Safety check: ensure symbols array exists and has the expected dimensions
  if (!self.symbols || !self.symbols.length || !self.symbols[0] || !self.symbols[0].length) {
    console.log('[Symbols] Symbols array not properly initialized, skipping Spine animation replacement');
    return;
  }

  console.log(`[Symbols] Processing ${wins.allMatching.size} winning patterns for Spine animations`);
  console.log(`[Symbols] Current symbols array dimensions: ${self.symbols.length} columns x ${self.symbols[0].length} rows`);
  
  // Determine if any winning symbol is a wildcard and prepare SFX selection
  let hasWildcardInWin = false;
  try {
    const wildcardSet = new Set<number>(MULTIPLIER_SYMBOLS);
    for (const win of wins.allMatching.values()) {
      for (const grid of win) {
        const valueAtGrid = data.symbols?.[grid.y]?.[grid.x];
        if (typeof valueAtGrid === 'number' && wildcardSet.has(valueAtGrid)) {
          hasWildcardInWin = true;
          break;
        }
      }
      if (hasWildcardInWin) break;
    }
  } catch {}
  
  // Ensure we only play the win SFX once per win animation start
  let hasPlayedWinSfx = false;
  
  for (const win of wins.allMatching.values()) {
    for (const grid of win) {
      // Safety check: ensure grid coordinates are within bounds
      if (grid.y < 0 || grid.y >= self.symbols.length || grid.x < 0 || grid.x >= self.symbols[0].length) {
        console.warn(`[Symbols] Grid coordinates (${grid.x}, ${grid.y}) out of bounds for symbols array [${self.symbols.length}][${self.symbols[0].length}], skipping`);
        continue;
      }

      const currentSymbol = self.symbols[grid.y][grid.x];
      
      if (currentSymbol) {
        // Get the symbol value and construct the Spine key
        const symbolValue = data.symbols[grid.y][grid.x];

        // For symbol 0 and symbols 13–21, keep PNGs: do not replace with Spine
        // Symbols 10-12 now have individual spines, so they can be replaced
        if (typeof symbolValue === 'number' && (symbolValue === 0 || (symbolValue >= 13 && symbolValue <= 21))) {
          continue;
        }

        
        // Map symbol value to correct spine key
        let spineKey: string;
        if (symbolValue >= 0 && symbolValue <= 9) {
          spineKey = `symbol_${symbolValue}_spine`;
        } else if (symbolValue >= 10 && symbolValue <= 16) {
          spineKey = 'symbol_10_spine';
        } else if (symbolValue >= 17 && symbolValue <= 20) {
          spineKey = 'symbol_11_spine';
        } else if (symbolValue >= 21 && symbolValue <= 22) {
          spineKey = 'symbol_12_spine';
        } else {
          continue; // Unknown symbol value
        }
        const spineAtlasKey = spineKey + '-atlas';
        // Removing KA hit animation usage for winning symbols
        
        // Store original position and scale
        const x = currentSymbol.x;
        const y = currentSymbol.y;
        const displayWidth = currentSymbol.displayWidth;
        const displayHeight = currentSymbol.displayHeight;
        
        try {
          console.log(`[Symbols] Replacing sprite with Spine animation: ${spineKey} at (${grid.x}, ${grid.y})`);
          
          // Remove the current sprite
          currentSymbol.destroy();
          
          // Create Spine animation in its place
          if (!ensureSpineFactory(self.scene as any, `[Symbols] replaceWinningSprite(${spineKey})`)) {
            continue;
          }
          const spineSymbol = (self.scene.add as any).spine?.(x, y, spineKey, spineAtlasKey);
          if (!spineSymbol) {
            continue;
          }
          try { (spineSymbol as any).symbolValue = symbolValue; } catch {}
          spineSymbol.setOrigin(0.5, 0.5);
          
          // Use configured scale for this specific symbol
          const configuredScale = self.getSpineSymbolScale(symbolValue);
          spineSymbol.setScale(configuredScale);
          console.log(`[Symbols] Applied scale ${configuredScale} to symbol ${symbolValue}`);
          
          // No KA hit animation; keep subtle emphasis via scale-up only
          scheduleScaleUp(self, spineSymbol, 500);

          // Play win SFX once when winning symbol animations start
          try {
            if (!hasPlayedWinSfx) {
              const audio = (window as any)?.audioManager;
              if (audio && typeof audio.playSoundEffect === 'function') {
                // During bonus mode, wins that include multiplier symbols (wildcards)
                // should use the dedicated bomb SFX. In base game, keep existing
                // wild-multi vs normal hit behavior.
                let sfx: SoundEffectType = SoundEffectType.HIT_WIN;
                if (hasWildcardInWin) {
                  if (gameStateManager.isBonus) {
                    sfx = SoundEffectType.MULTIPLIER_TRIGGER;
                  } else {
                    sfx = SoundEffectType.WILD_MULTI;
                  }
                }
                audio.playSoundEffect(sfx);
                hasPlayedWinSfx = true;
                // If this spin triggered scatter, chain play scatter_sw after hit/wildmulti
                try {
                  if (gameStateManager.isScatter) {
                    // short chain delay to ensure ordering
                    this.scene.time.delayedCall(100, () => {
                      try { audio.playSoundEffect(SoundEffectType.SCATTER); } catch {}
                    });
                  }
                } catch {}
              }
            }
          } catch {}
          
          // Add to container and update reference
          self.container.add(spineSymbol);
          self.symbols[grid.y][grid.x] = spineSymbol;
          
          console.log(`[Symbols] Successfully replaced sprite with Spine animation at (${grid.x}, ${grid.y})`);
          
        } catch (error) {
          console.warn(`[Symbols] Failed to replace sprite with Spine animation at (${grid.x}, ${grid.y}):`, error);

          // Clear animation fallback: recreate a static symbol without pulsing/tint effects
          try {
            const recreated = createSugarOrPngSymbol(self, symbolValue, x, y, 1);
            self.symbols[grid.y][grid.x] = recreated;
            if (self.container) {
              self.container.add(recreated);
            }
          } catch {}
        }
      }
    }
  }
}


/**
 * Calculate total win amount from paylines array
 */
function calculateTotalWinFromPaylines(paylines: any[]): number {
  if (!paylines || paylines.length === 0) {
    return 0;
  }
  
  const totalWin = paylines.reduce((sum, payline) => {
    const winAmount = payline.win || 0;
    console.log(`[Symbols] Payline ${payline.lineKey}: ${winAmount} (symbol ${payline.symbol}, count ${payline.count})`);
    return sum + winAmount;
  }, 0);
  
  console.log(`[Symbols] Calculated total win: ${totalWin} from ${paylines.length} paylines`);
  return totalWin;
}

async function delay(duration: number) {
  // The duration should already be turbo-adjusted from the backend
  // No need to apply turbo mode again here
  console.log(`[Symbols] Delay: ${duration}ms (should already be turbo-adjusted), turbo state: ${gameStateManager.isTurbo}`);
  
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, duration);
  });
}

// Add method to reset symbols visibility
function resetSymbolsVisibility(self: Symbols): void {
  if (self.container) {
    self.container.setAlpha(1);
  }
}

