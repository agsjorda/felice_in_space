export class Events {
    static readonly START: string = 'start';

    static readonly SPIN: string = 'spin';
    static readonly SPIN_END: string = 'spinEnd';

    static readonly SPIN_ANIMATION_START: string = 'spin_animation_start';
    static readonly SPIN_BEFORE_ANIMATION_END: string = 'spinBeforeAnimationEnd';
    static readonly SPIN_ANIMATION_END: string = 'spin_animation_end';
    static readonly MATCHES_DONE: string = 'matches_done';

    static readonly WIN: string = 'win';
    static readonly CHANGE_LINE: string = 'changeLine';
    static readonly CHANGE_BET: string = 'change_bet';
    static readonly ENHANCE_BET_TOGGLE: string = 'enhance_bet_toggle';

    // Autoplay events
    static readonly AUTOPLAY_START: string = 'autoplay_start';
    static readonly AUTOPLAY_STOP: string = 'autoplay_stop';
    static readonly AUTOPLAY_COMPLETE: string = 'autoplay_complete';

    static readonly BONUS_WIN_CLOSED: string = 'bonus_win_closed';

    static readonly HELP_SCREEN_TOGGLE: string = 'help_screen_toggle';

    static readonly WIN_OVERLAY_SHOW: string = 'winOverlayShow';
    static readonly WIN_OVERLAY_UPDATE_TOTAL_WIN: string = 'winOverlayUpdateTotalWin';
    static readonly WIN_OVERLAY_HIDE: string = 'winOverlayHide';
    
    static readonly TOGGLE_BACKGROUND: string = 'toggleBackground';

    static readonly UPDATE_TOTAL_WIN: string = 'updateTotalWin';
    static readonly UPDATE_CURRENCY: string = 'updateCurrency';
    static readonly UPDATE_BALANCE: string = 'updateBalance';


    static readonly emitter: Phaser.Events.EventEmitter = new Phaser.Events.EventEmitter();
} 