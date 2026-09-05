import {
	registerClient,
	unregisterClient,
	postMessage,
	deleteSession,
	getOrCreateSession,
	getMessagesSince,
	sendEvent
} from '$lib/server/signaling.js';
import { json } from '@sveltejs/kit';

/** @type {import('./$types').RequestHandler} */
export async function GET({ params, url }) {
	const sessionId = params.id;
	const clientId = url.searchParams.get('clientId');
	const role = /** @type {'sender' | 'receiver'} */ (url.searchParams.get('role') || 'receiver');
	const mode = url.searchParams.get('mode'); // 'poll' or 'sse' (default: sse)

	if (!clientId) {
		return json({ error: 'Missing clientId parameter' }, { status: 400 });
	}

	// Polling fallback endpoint
	if (mode === 'poll') {
		const since = parseInt(url.searchParams.get('since') || '0', 10);
		const messages = getMessagesSince(sessionId, clientId, since);
		const session = getOrCreateSession(sessionId);
		return json({
			messages,
			meta: session.fileMeta,
			clientsCount: session.clients.size,
			now: Date.now()
		});
	}

	// SSE streaming endpoint
	let heartbeatInterval;

	const stream = new ReadableStream({
		start(controller) {
			registerClient(sessionId, clientId, role, controller);

			// Send connected acknowledgment
			sendEvent(controller, 'session-init', {
				sessionId,
				role,
				clientId,
				timestamp: Date.now()
			});

			// Heartbeat comment every 15s to keep connection alive through load balancers / proxies
			const encoder = new TextEncoder();
			heartbeatInterval = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(': ping\n\n'));
				} catch {
					clearInterval(heartbeatInterval);
				}
			}, 15000);
		},
		cancel() {
			clearInterval(heartbeatInterval);
			unregisterClient(sessionId, clientId);
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no'
		}
	});
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ params, request }) {
	const sessionId = params.id;
	try {
		const body = await request.json();
		const { clientId, role, type, data } = body;

		if (!clientId || !role || !type) {
			return json({ error: 'Missing required fields: clientId, role, type' }, { status: 400 });
		}

		const result = postMessage(sessionId, clientId, role, type, data);
		return json({ success: true, ...result });
	} catch (err) {
		return json({ error: 'Invalid JSON payload' }, { status: 400 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function DELETE({ params }) {
	const sessionId = params.id;
	deleteSession(sessionId);
	return json({ success: true });
}
