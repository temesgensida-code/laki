import { PeerServer } from 'peer';

const PEERJS_PORT = Number(process.env.PEERJS_PORT || 9000);

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
	return resolve(event);
}
