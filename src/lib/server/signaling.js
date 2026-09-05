/**
 * In-memory signaling bus for WebRTC session orchestration.
 * Supports Server-Sent Events (SSE) streaming with message buffering,
 * automatic heartbeat, and polling fallback.
 */

/**
 * @typedef {Object} SignalMessage
 * @property {string} id
 * @property {string} senderClientId
 * @property {'sender' | 'receiver'} role
 * @property {string} type
 * @property {any} data
 * @property {number} timestamp
 */

/**
 * @typedef {Object} SessionClient
 * @property {string} clientId
 * @property {'sender' | 'receiver'} role
 * @property {ReadableStreamDefaultController | null} controller
 * @property {number} lastSeen
 */

/**
 * @typedef {Object} SignalingSession
 * @property {string} id
 * @property {number} createdAt
 * @property {number} lastActivity
 * @property {any} [fileMeta]
 * @property {Map<string, SessionClient>} clients
 * @property {SignalMessage[]} messageQueue
 */

/** @type {Map<string, SignalingSession>} */
const sessions = new Map();

// Periodic sweep of stale sessions (sessions inactive for > 1 hour)
const CLEANUP_INTERVAL_MS = 60_000 * 5;
const SESSION_TTL_MS = 60_000 * 60; // 1 hour

if (typeof setInterval !== 'undefined') {
	setInterval(() => {
		const now = Date.now();
		for (const [id, session] of sessions.entries()) {
			if (now - session.lastActivity > SESSION_TTL_MS) {
				// Close any open controllers
				for (const client of session.clients.values()) {
					if (client.controller) {
						try {
							client.controller.close();
						} catch {
							// ignored
						}
					}
				}
				sessions.delete(id);
			}
		}
	}, CLEANUP_INTERVAL_MS);
}

/**
 * Get or create a session by ID.
 * @param {string} sessionId
 * @returns {SignalingSession}
 */
export function getOrCreateSession(sessionId) {
	let session = sessions.get(sessionId);
	if (!session) {
		session = {
			id: sessionId,
			createdAt: Date.now(),
			lastActivity: Date.now(),
			fileMeta: null,
			clients: new Map(),
			messageQueue: []
		};
		sessions.set(sessionId, session);
	} else {
		session.lastActivity = Date.now();
	}
	return session;
}

/**
 * Register a client for SSE streaming.
 * @param {string} sessionId
 * @param {string} clientId
 * @param {'sender' | 'receiver'} role
 * @param {ReadableStreamDefaultController} controller
 */
export function registerClient(sessionId, clientId, role, controller) {
	const session = getOrCreateSession(sessionId);
	const existing = session.clients.get(clientId);

	if (existing?.controller && existing.controller !== controller) {
		try {
			existing.controller.close();
		} catch {
			// ignored
		}
	}

	session.clients.set(clientId, {
		clientId,
		role,
		controller,
		lastSeen: Date.now()
	});
	session.lastActivity = Date.now();

	// If there's file metadata already uploaded by sender, immediately inform receiver
	if (role === 'receiver' && session.fileMeta) {
		sendEvent(controller, 'file-meta', session.fileMeta);
	}

	// Notify other peers in session that a peer connected
	broadcastToOthers(session, clientId, 'peer-status', {
		peerRole: role,
		status: 'connected',
		clientsCount: session.clients.size
	});

	// Deliver any queued messages meant for this role
	const remainingQueue = [];
	for (const msg of session.messageQueue) {
		if (msg.senderClientId !== clientId) {
			sendEvent(controller, msg.type, msg.data, msg.id);
		} else {
			remainingQueue.push(msg);
		}
	}
	session.messageQueue = remainingQueue;
}

/**
 * Remove a client from a session.
 * @param {string} sessionId
 * @param {string} clientId
 */
export function unregisterClient(sessionId, clientId) {
	const session = sessions.get(sessionId);
	if (!session) return;

	const client = session.clients.get(clientId);
	if (client) {
		session.clients.delete(clientId);
		session.lastActivity = Date.now();

		// Notify remaining clients
		broadcastToOthers(session, clientId, 'peer-status', {
			peerRole: client.role,
			status: 'disconnected',
			clientsCount: session.clients.size
		});
	}

	if (session.clients.size === 0 && !session.fileMeta) {
		// Session can be cleared if no clients and no file
		sessions.delete(sessionId);
	}
}

/**
 * Broadcast a message to peers in the session.
 * @param {string} sessionId
 * @param {string} senderClientId
 * @param {'sender' | 'receiver'} role
 * @param {string} type
 * @param {any} data
 * @returns {{ delivered: number, queued: boolean }}
 */
export function postMessage(sessionId, senderClientId, role, type, data) {
	const session = getOrCreateSession(sessionId);
	session.lastActivity = Date.now();

	if (type === 'file-meta') {
		session.fileMeta = data;
	}

	let delivered = 0;
	const msgId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

	for (const [cid, client] of session.clients.entries()) {
		if (cid !== senderClientId && client.controller) {
			try {
				sendEvent(client.controller, type, data, msgId);
				delivered++;
			} catch (err) {
				console.error(`Failed to send event to client ${cid}:`, err);
			}
		}
	}

	let queued = false;
	// If no peer received it yet, queue the message (except ephemeral pings)
	if (delivered === 0 && type !== 'ping') {
		session.messageQueue.push({
			id: msgId,
			senderClientId,
			role,
			type,
			data,
			timestamp: Date.now()
		});
		// Cap queue size to prevent memory buildup
		if (session.messageQueue.length > 50) {
			session.messageQueue.shift();
		}
		queued = true;
	}

	return { delivered, queued };
}

/**
 * Send an SSE formatted packet to a stream controller.
 * @param {ReadableStreamDefaultController} controller
 * @param {string} event
 * @param {any} data
 * @param {string} [id]
 */
export function sendEvent(controller, event, data, id) {
	const encoder = new TextEncoder();
	let payload = '';
	if (id) {
		payload += `id: ${id}\n`;
	}
	payload += `event: ${event}\n`;
	payload += `data: ${JSON.stringify(data)}\n\n`;
	controller.enqueue(encoder.encode(payload));
}

/**
 * Broadcast to other clients in session.
 * @param {SignalingSession} session
 * @param {string} excludeClientId
 * @param {string} event
 * @param {any} data
 */
function broadcastToOthers(session, excludeClientId, event, data) {
	for (const [cid, client] of session.clients.entries()) {
		if (cid !== excludeClientId && client.controller) {
			try {
				sendEvent(client.controller, event, data);
			} catch {
				// handled by client disconnect
			}
		}
	}
}

/**
 * Get messages since timestamp for polling fallback.
 * @param {string} sessionId
 * @param {string} clientId
 * @param {number} since
 */
export function getMessagesSince(sessionId, clientId, since) {
	const session = sessions.get(sessionId);
	if (!session) return [];
	return session.messageQueue.filter((m) => m.senderClientId !== clientId && m.timestamp > since);
}

/**
 * Clear or reset session.
 * @param {string} sessionId
 */
export function deleteSession(sessionId) {
	const session = sessions.get(sessionId);
	if (session) {
		for (const client of session.clients.values()) {
			if (client.controller) {
				try {
					client.controller.close();
				} catch {
					// ignored
				}
			}
		}
		sessions.delete(sessionId);
	}
}
