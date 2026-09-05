import pkg from 'peerjs';
const Peer = pkg.Peer || pkg.default || pkg;

/**
 * PeerJsSignalingClient
 *
 * Provides real-time duplex peer discovery and message exchange
 * backed by the embedded PeerJS server on /peerjs.
 */
export class PeerJsSignalingClient {
	/**
	 * @param {string} sessionId
	 * @param {'sender' | 'receiver'} role
	 * @param {string} clientId
	 * @param {Array<RTCIceServer>} [iceServers]
	 */
	constructor(sessionId, role, clientId, iceServers = []) {
		this.sessionId = sessionId;
		this.role = role;
		this.clientId = clientId;
		this.iceServers = iceServers;

		/** @type {import('peerjs').Peer | null} */
		this.peer = null;
		/** @type {import('peerjs').DataConnection | null} */
		this.connection = null;

		/** @type {Record<string, Array<(data: any) => void>>} */
		this.listeners = {};

		this.isConnected = false;
		this.isDestroyed = false;
		this.pendingMessages = [];

		this.initPeer();
	}

	on(event, callback) {
		if (!this.listeners[event]) {
			this.listeners[event] = [];
		}
		this.listeners[event].push(callback);
		return () => this.off(event, callback);
	}

	off(event, callback) {
		if (!this.listeners[event]) return;
		this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
	}

	emit(event, data) {
		const handlers = this.listeners[event] || [];
		for (const cb of handlers) {
			try {
				cb(data);
			} catch (err) {
				console.error(`[PeerJS Signaling] Listener error for ${event}:`, err);
			}
		}
	}

	initPeer() {
		if (this.isDestroyed || typeof window === 'undefined') return;

		const peerId = `laki-${this.sessionId}-${this.role}`;
		const isSecure = window.location.protocol === 'https:';
		const host = window.location.hostname;
		const port = window.location.port ? Number(window.location.port) : (isSecure ? 443 : 80);

		try {
			this.peer = new Peer(peerId, {
				host,
				port,
				path: '/peerjs',
				secure: isSecure,
				config: {
					iceServers: this.iceServers.length > 0 ? this.iceServers : [
						{ urls: 'stun:stun.l.google.com:19302' },
						{ urls: 'stun:stun1.l.google.com:19302' }
					]
				}
			});

			this.peer.on('open', (id) => {
				this.isConnected = true;
				this.emit('connection-state', { connected: true, mode: 'peerjs-ws', peerId: id });

				if (this.role === 'receiver') {
					// Receiver connects to sender
					this.connectToSender();
				}
			});

			this.peer.on('connection', (conn) => {
				this.setupConnection(conn);
			});

			this.peer.on('error', (err) => {
				console.warn('[PeerJS Signaling] Peer error:', err.type, err.message);
				if (err.type === 'peer-unavailable' && this.role === 'receiver') {
					// Sender might not have joined yet, retry in 1.5s
					setTimeout(() => {
						if (!this.isDestroyed && !this.connection) {
							this.connectToSender();
						}
					}, 1500);
				}
			});

			this.peer.on('close', () => {
				this.isConnected = false;
				this.emit('connection-state', { connected: false, mode: 'peerjs-ws' });
			});
		} catch (err) {
			console.error('[PeerJS Signaling] Initialization failed:', err);
		}
	}

	connectToSender() {
		if (!this.peer || this.isDestroyed) return;
		const targetSenderId = `laki-${this.sessionId}-sender`;
		try {
			const conn = this.peer.connect(targetSenderId, {
				reliable: true,
				metadata: { clientId: this.clientId, role: this.role }
			});
			this.setupConnection(conn);
		} catch (err) {
			console.warn('[PeerJS Signaling] Connect to sender error:', err);
		}
	}

	/**
	 * @param {import('peerjs').DataConnection} conn
	 */
	setupConnection(conn) {
		this.connection = conn;

		conn.on('open', () => {
			this.emit('peer-status', { status: 'connected', peerId: conn.peer });

			// Flush any messages that were queued before connection opened
			while (this.pendingMessages.length > 0) {
				const item = this.pendingMessages.shift();
				this.send(item.type, item.data);
			}
		});

		conn.on('data', (data) => {
			try {
				if (typeof data === 'string') {
					const msg = JSON.parse(data);
					if (msg.type) {
						this.emit(msg.type, msg.data);
					}
				} else if (data && typeof data === 'object' && data.type) {
					this.emit(data.type, data.data);
				}
			} catch (e) {
				console.error('[PeerJS Signaling] Parse error:', e);
			}
		});

		conn.on('close', () => {
			this.connection = null;
			this.emit('peer-status', { status: 'disconnected', peerId: conn.peer });
		});

		conn.on('error', (err) => {
			console.warn('[PeerJS Signaling] DataConnection error:', err);
		});
	}

	/**
	 * Send a message via PeerJS DataConnection
	 * @param {string} type
	 * @param {any} data
	 */
	async send(type, data) {
		if (this.isDestroyed) return false;

		const payload = { type, data, timestamp: Date.now(), clientId: this.clientId };

		if (this.connection && this.connection.open) {
			try {
				this.connection.send(JSON.stringify(payload));
				return true;
			} catch (err) {
				console.warn('[PeerJS Signaling] Send failed, queueing message:', err);
			}
		}

		this.pendingMessages.push({ type, data });
		return true;
	}

	destroy() {
		this.isDestroyed = true;
		if (this.connection) {
			try {
				this.connection.close();
			} catch {}
			this.connection = null;
		}
		if (this.peer) {
			try {
				this.peer.destroy();
			} catch {}
			this.peer = null;
		}
		this.listeners = {};
		this.pendingMessages = [];
	}
}
