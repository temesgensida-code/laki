import { PeerServer } from 'peer';

const PEERJS_PORT = Number(process.env.PEERJS_PORT || 9000);

// Ensure PeerServer is initialized once within the Node runtime process
if (!globalThis.__lakiPeerServer && typeof process !== 'undefined') {
	try {
		globalThis.__lakiPeerServer = PeerServer({
			port: PEERJS_PORT,
			path: '/peerjs',
			allow_discovery: true
		});
		console.log(`[Laki] PeerJS signaling server started on port ${PEERJS_PORT} inside SvelteKit Node process`);
	} catch (err) {
		console.warn('[Laki] PeerServer startup warning:', err.message);
	}
}

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	return resolve(event);
}
