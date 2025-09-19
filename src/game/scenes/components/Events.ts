export class Events {
    static readonly START: string = 'start';

    static readonly SPIN: string = 'spin';
    static readonly SPIN_END: string = 'spinEnd';

    static readonly SPIN_ANIMATION_START: string = 'spin_animation_start';
    static readonly SPIN_BEFORE_ANIMATION_END: string = 'spinBeforeAnimationEnd';
    static readonly SPIN_ANIMATION_END: string = 'spin_animation_end';
    static readonly MATCHES_DONE: string = 'matches_done';
    static readonly TUMBLE_SEQUENCE_DONE: string = 'tumble_sequence_done';

    static readonly WIN: string = 'win';
    static readonly RESET_WIN: string = 'resetWin';
    static readonly FINAL_WIN_SHOW: string = 'finalWinShow';
    
    static readonly CHANGE_LINE: string = 'changeLine';
    static readonly CHANGE_BET: string = 'change_bet';
    static readonly ENHANCE_BET_TOGGLE: string = 'enhance_bet_toggle';
    static readonly REMOVE_ENHANCE_BET: string = 'remove_enhance_bet';

    // Autoplay events
    static readonly AUTOPLAY_START: string = 'autoplay_start';
    static readonly AUTOPLAY_STOP: string = 'autoplay_stop';
    static readonly AUTOPLAY_COMPLETE: string = 'autoplay_complete';

    static readonly BONUS_WIN_CLOSED: string = 'bonus_win_closed';

    static readonly HELP_SCREEN_TOGGLE: string = 'help_screen_toggle';

    static readonly WIN_OVERLAY_SHOW: string = 'winOverlayShow';
    static readonly WIN_OVERLAY_UPDATE_TOTAL_WIN: string = 'winOverlayUpdateTotalWin';
    static readonly WIN_OVERLAY_HIDE: string = 'winOverlayHide';
    
    // New: emitted when FreeSpin win overlay is displayed
    static readonly FREE_SPIN_OVERLAY_SHOW: string = 'free_spin_overlay_show';

    static readonly FREE_SPIN_TOTAL_WIN: string = 'freeSpinTotalWin';

    static readonly UPDATE_TOTAL_WIN: string = 'updateTotalWin';
    static readonly UPDATE_CURRENCY: string = 'updateCurrency';
    static readonly UPDATE_BALANCE: string = 'updateBalance';
    static readonly GET_BALANCE: string = 'getBalance';

    // UI Y-axis toggle events for specific buttons
    static readonly CREATE_TURBO_BUTTON: string = 'createTurboButton';
    static readonly CREATE_AUTOPLAY: string = 'createAutoplay';
    static readonly CREATE_SPIN_BUTTON: string = 'createSpinButton';
    static readonly CREATE_DOUBLE_FEATURE: string = 'createDoubleFeature';
    static readonly CREATE_INFO: string = 'createInfo';

    static readonly emitter: Phaser.Events.EventEmitter = new Phaser.Events.EventEmitter();

    // Bomb visual events
    static readonly BOMB_FLOAT_TEXT: string = 'bomb_float_text';

    static readonly SESSION_TIMEOUT: string = 'session_timeout';
    static readonly SHOW_INSUFFICIENT_BALANCE: string = 'show_insufficient_balance';
    
    static readonly SHOW_BOMB_WIN: string = 'show_bomb_win';
    static readonly HIDE_BOMB_WIN: string = 'hide_bomb_win';
    
    static readonly TOGGLE_BACKGROUND: string = 'toggle_background';
} 