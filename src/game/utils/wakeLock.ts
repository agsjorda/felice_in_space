// Lightweight Screen Wake Lock manager with visibility re-acquire
// Uses the Screen Wake Lock API when available; no-op on unsupported browsers

export class WakeLockManager {
	private static sentinel: WakeLockSentinel | null = null;
	private static boundHandleVisibility?: () => void;

	static get isSupported(): boolean {
		return typeof navigator !== 'undefined' && !!navigator.wakeLock;
	}

	static async request(): Promise<boolean> {
		if (!this.isSupported) {
			return false;
		}
		try {
			if (this.sentinel && !this.sentinel.released) {
				return true;
			}
			this.sentinel = await navigator.wakeLock!.request('screen');
			// Re-acquire if it gets released by the UA
			this.sentinel.onrelease = () => {
				// Best-effort re-acquire when still visible
				if (document.visibilityState === 'visible') {
					void WakeLockManager.request();
				}
			};
			// Re-acquire on visibility changes
			if (!this.boundHandleVisibility) {
				this.boundHandleVisibility = () => {
					if (document.visibilityState === 'visible') {
						void WakeLockManager.request();
					}
				};
				document.addEventListener('visibilitychange', this.boundHandleVisibility);
			}
			return true;
		} catch (_e) {
			return false;
		}
	}

	static async release(): Promise<void> {
		try {
			if (this.sentinel && !this.sentinel.released) {
				await this.sentinel.release();
			}
		} catch (_e) {
			// no-op
		} finally {
			this.sentinel = null;
			if (this.boundHandleVisibility) {
				document.removeEventListener('visibilitychange', this.boundHandleVisibility);
				this.boundHandleVisibility = undefined;
			}
		}
	}
}


