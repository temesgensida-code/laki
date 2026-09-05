/**
 * Signaling client handling real-time peer discovery and negotiation
 * via Server-Sent Events (SSE) with robust polling fallback and automatic reconnection.
 */

export class SignalingClient {
	/**
	 * @param {string} sessionId
	 * @param {'sender' | 'receiver'} role
	 * @param {string} clientId
	 */
	constructor(sessionId, role, clientId) {
		this.sessionId = sessionId;
		this.role = role;
		this.clientId = clientId;

		/** @type {EventSource | null} */
		this.eventSource = null;

		/** @type {Record<string, Array<(data: any) => void>>} */
		this.listeners = {};

		this.isConnected = false;
		this.isDestroyed = false;
		this.reconnectAttempts = 0;
		this.reconnectTimeout = null;

		// Polling fallback state
		this.usePollingFallback = false;
		this.pollInterval = null;
		this.lastPollTimestamp = 0;

		this.initEventSource();
	}

	/**
	 * Add an event listener for a signaling event.
	 * @param {string} event
	 * @param {(data: any) => void} callback
	 */
	on(event, callback) {
		if (!this.listeners[event]) {
			this.listeners[event] = [];
		}
		this.listeners[event].push(callback);
		return () => this.off(event, callback);
	}

	/**
	 * Remove an event listener.
	 * @param {string} event
	 * @param {(data: any) => void} callback
	 */
	off(event, callback) {
		if (!this.listeners[event]) return;
		this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
	}

	/**
	 * Emit an event internally to registered listeners.
	 * @param {string} event
	 * @param {any} data
	 */
	emit(event, data) {
		const handlers = this.listeners[event] || [];
		for (const cb of handlers) {
			try {
				cb(data);
			} catch (err) {
				console.error(`Error in signaling handler for ${event}:`, err);
			}
		}
	}

	/**
	 * Initialize SSE connection.
	 */
	initEventSource() {
		if (this.isDestroyed) return;

		// If too many SSE reconnect failures, activate polling fallback
		if (this.reconnectAttempts >= 3 && !this.usePollingFallback) {
			console.warn('[Signaling] SSE failed multiple times, switching to polling fallback');
			this.startPollingFallback();
			return;
		}

		try {
			const url = `/api/signal/${encodeURIComponent(this.sessionId)}?clientId=${encodeURIComponent(this.clientId)}&role=${encodeURIComponent(this.role)}`;
			this.eventSource = new EventSource(url);

			this.eventSource.onopen = () => {
				this.isConnected = true;
				this.reconnectAttempts = 0;
				this.emit('connection-state', { connected: true, mode: 'sse' });
			};

			this.eventSource.onerror = (err) => {
				this.isConnected = false;
				this.emit('connection-state', { connected: false, mode: 'sse' });

				if (this.eventSource) {
					this.eventSource.close();
					this.eventSource = null;
				}

				if (!this.isDestroyed) {
					this.reconnectAttempts++;
					const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 5000);
					this.reconnectTimeout = setTimeout(() => this.initEventSource(), delay);
				}
			};

			const knownEvents = [
				'session-init',
				'peer-status',
				'offer',
				'answer',
				'candidate',
				'file-meta',
				'accept-transfer',
				'reject-transfer',
				'pause-transfer',
				'resume-transfer',
				'cancel-transfer',
				'ping',
				'request-resume'
			];

			for (const ev of knownEvents) {
				this.eventSource.addEventListener(ev, (e) => {
					try {
						const data = JSON.parse(e.data);
						this.emit(ev, data);
					} catch (parseErr) {
						console.error(`Failed to parse SSE ${ev} data:`, parseErr);
					}
				});
			}
		} catch (err) {
			console.error('[Signaling] Error initializing EventSource:', err);
			this.startPollingFallback();
		}
	}

	/**
	 * Fallback polling if SSE is blocked or fails.
	 */
	startPollingFallback() {
		this.usePollingFallback = true;
		if (this.eventSource) {
			this.eventSource.close();
			this.eventSource = null;
		}

		this.isConnected = true;
		this.emit('connection-state', { connected: true, mode: 'poll' });

		const poll = async () => {
			if (this.isDestroyed) return;
			try {
				const url = `/api/signal/${encodeURIComponent(this.sessionId)}?mode=poll&clientId=${encodeURIComponent(this.clientId)}&role=${encodeURIComponent(this.role)}&since=${this.lastPollTimestamp}`;
				const res = await fetch(url);
				if (res.ok) {
					const data = await res.json();
					if (data.now) {
						this.lastPollTimestamp = data.now;
					}
					if (data.meta && this.role === 'receiver') {
						this.emit('file-meta', data.meta);
					}
					if (Array.isArray(data.messages)) {
						for (const msg of data.messages) {
							this.emit(msg.type, msg.data);
						}
					}
				}
			} catch (err) {
				console.warn('[Signaling] Polling error:', err);
			}
		};

		poll();
		this.pollInterval = setInterval(poll, 1200);
	}

	/**
	 * Send a signaling message to the peer.
	 * @param {string} type
	 * @param {any} data
	 * @returns {Promise<boolean>}
	 */
	async send(type, data) {
		if (this.isDestroyed) return false;

		const payload = {
			clientId: this.clientId,
			role: this.role,
			type,
			data
		};

		let retries = 3;
		while (retries > 0) {
			try {
				const res = await fetch(`/api/signal/${encodeURIComponent(this.sessionId)}`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});

				if (res.ok) {
					return true;
				}
			} catch (err) {
				console.warn(`[Signaling] Send error for ${type}, retrying...`, err);
			}
			retries--;
			await new Promise((r) => setTimeout(r, 400));
		}
		return false;
	}

	/**
	 * Disconnect and destroy the signaling client.
	 */
	destroy() {
		this.isDestroyed = true;
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
		}
		if (this.pollInterval) {
			clearInterval(this.pollInterval);
		}
		if (this.eventSource) {
			this.eventSource.close();
			this.eventSource = null;
		}
		this.listeners = {};
	}
}
