// Try to load .env into process.env for Node runtime if supported
try {
	if (typeof process !== 'undefined' && typeof process.loadEnvFile === 'function') {
		process.loadEnvFile();
	}
} catch (e) {
	// Ignore if .env is missing or already loaded
}

import { PeerServer } from 'peer';
import { getSessionUser } from '$lib/server/auth.js';
import { env } from '$env/dynamic/private';

const PEERJS_PORT = Number(env.PEERJS_PORT || (typeof process !== 'undefined' && process.env.PEERJS_PORT) || 9000);

// Ensure PeerServer is initialized once within the Node runtime process
if (!globalThis.__lakiPeerServer && typeof process !== 'undefined') {
	try {
		const server = PeerServer({
			port: PEERJS_PORT,
			path: '/peerjs',
			allow_discovery: true
		});

		server.on('error', (err) => {
			if (/** @type {any} */ (err).code === 'EADDRINUSE') {
				console.warn(
					`[Laki] PeerJS port ${PEERJS_PORT} is already in use. Reusing existing signaling server.`
				);
			} else {
				console.error('[Laki] PeerServer error:', err);
			}
		});

		globalThis.__lakiPeerServer = server;
		console.log(`[Laki] PeerJS signaling server started on port ${PEERJS_PORT} inside SvelteKit Node process`);
	} catch (err) {
		console.warn('[Laki] PeerServer startup warning:', err.message);
	}
}

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	// Authenticate user via signed session cookie
	event.locals.user = getSessionUser(event.cookies);

	return resolve(event);
}
