import { json } from '@sveltejs/kit';
import { attachReceiver, detachReceiver, pushChunk, closeTunnel } from '$lib/server/tunnel.js';

/**
 * GET /api/tunnel/[id]
 * Receiver connects here to stream binary file chunks in real time.
 */
export async function GET({ params }) {
	const sessionId = params.id;
	/** @type {ReadableStreamDefaultController | null} */
	let streamController = null;

	const stream = new ReadableStream({
		start(controller) {
			streamController = controller;
			attachReceiver(sessionId, controller);
		},
		cancel() {
			if (streamController) {
				detachReceiver(sessionId, streamController);
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'application/octet-stream',
			'Cache-Control': 'no-cache, no-store, no-transform',
			'X-Accel-Buffering': 'no',
			'Connection': 'keep-alive'
		}
	});
}

/**
 * POST /api/tunnel/[id]
 * Sender uploads chunks here to be piped in real-time to the receiver.
 */
export async function POST({ params, request }) {
	const sessionId = params.id;
	try {
		const arrayBuffer = await request.arrayBuffer();
		if (!arrayBuffer || arrayBuffer.byteLength === 0) {
			return json({ error: 'Empty payload' }, { status: 400 });
		}

		const chunk = new Uint8Array(arrayBuffer);
		const result = pushChunk(sessionId, chunk);

		return json(result, {
			headers: {
				'Cache-Control': 'no-store'
			}
		});
	} catch (err) {
		console.error('[Tunnel] POST chunk error:', err);
		return json({ error: 'Failed to process chunk' }, { status: 500 });
	}
}

/**
 * DELETE /api/tunnel/[id]
 * Clean up stream tunnel when transfer finishes.
 */
export async function DELETE({ params }) {
	closeTunnel(params.id);
	return json({ ok: true });
}
