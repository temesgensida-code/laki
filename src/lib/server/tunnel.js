/**
 * In-memory high-throughput binary stream tunnel.
 * Pipes chunks directly between sender and receiver over standard HTTP/HTTPS
 * without writing to disk, bypassing any NAT, firewall, or WebRTC restrictions.
 */

/**
 * @typedef {Object} TunnelSession
 * @property {string} sessionId
 * @property {ReadableStreamDefaultController | null} receiverController
 * @property {Uint8Array[]} pendingChunks
 * @property {number} lastActivity
 */

/** @type {Map<string, TunnelSession>} */
const tunnels = new Map();

// Periodic cleanup of inactive tunnels (inactive for > 30 minutes)
const CLEANUP_INTERVAL_MS = 60_000 * 5;
const TUNNEL_TTL_MS = 60_000 * 30;

if (typeof setInterval !== 'undefined') {
	setInterval(() => {
		const now = Date.now();
		for (const [id, tunnel] of tunnels.entries()) {
			if (now - tunnel.lastActivity > TUNNEL_TTL_MS) {
				if (tunnel.receiverController) {
					try {
						tunnel.receiverController.close();
					} catch {
						// ignored
					}
				}
				tunnels.delete(id);
			}
		}
	}, CLEANUP_INTERVAL_MS);
}

/**
 * Get or create tunnel session.
 * @param {string} sessionId
 * @returns {TunnelSession}
 */
export function getOrCreateTunnel(sessionId) {
	let tunnel = tunnels.get(sessionId);
	if (!tunnel) {
		tunnel = {
			sessionId,
			receiverController: null,
			pendingChunks: [],
			lastActivity: Date.now()
		};
		tunnels.set(sessionId, tunnel);
	} else {
		tunnel.lastActivity = Date.now();
	}
	return tunnel;
}

/**
 * Attach receiver stream controller.
 * @param {string} sessionId
 * @param {ReadableStreamDefaultController} controller
 */
export function attachReceiver(sessionId, controller) {
	const tunnel = getOrCreateTunnel(sessionId);

	// Close old controller if open
	if (tunnel.receiverController && tunnel.receiverController !== controller) {
		try {
			tunnel.receiverController.close();
		} catch {
			// ignored
		}
	}

	tunnel.receiverController = controller;
	tunnel.lastActivity = Date.now();

	// Flush any buffered chunks immediately
	if (tunnel.pendingChunks.length > 0) {
		for (const chunk of tunnel.pendingChunks) {
			try {
				controller.enqueue(chunk);
			} catch (err) {
				console.error('[Tunnel] Error flushing buffered chunk:', err);
				break;
			}
		}
		tunnel.pendingChunks = [];
	}
}

/**
 * Detach receiver controller.
 * @param {string} sessionId
 * @param {ReadableStreamDefaultController} controller
 */
export function detachReceiver(sessionId, controller) {
	const tunnel = tunnels.get(sessionId);
	if (!tunnel) return;

	if (tunnel.receiverController === controller) {
		tunnel.receiverController = null;
		tunnel.lastActivity = Date.now();
	}
}

/**
 * Push a binary chunk from sender into receiver's stream.
 * @param {string} sessionId
 * @param {Uint8Array} chunk
 * @returns {{ success: boolean, delivered: boolean }}
 */
export function pushChunk(sessionId, chunk) {
	const tunnel = getOrCreateTunnel(sessionId);
	tunnel.lastActivity = Date.now();

	if (tunnel.receiverController) {
		try {
			tunnel.receiverController.enqueue(chunk);
			return { success: true, delivered: true };
		} catch (err) {
			console.warn('[Tunnel] Controller enqueue failed, buffering:', err);
			tunnel.receiverController = null;
		}
	}

	// Buffer chunk if receiver stream is connecting or reconnecting
	tunnel.pendingChunks.push(chunk);

	return { success: true, delivered: false };
}

/**
 * Close tunnel when file transfer finishes or cancels.
 * @param {string} sessionId
 */
export function closeTunnel(sessionId) {
	const tunnel = tunnels.get(sessionId);
	if (!tunnel) return;

	if (tunnel.receiverController) {
		try {
			tunnel.receiverController.close();
		} catch {
			// ignored
		}
		tunnel.receiverController = null;
	}
	tunnels.delete(sessionId);
}
