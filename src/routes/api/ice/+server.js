import { json } from '@sveltejs/kit';
import { getMeteredIceServers } from '$lib/server/metered.js';

export async function GET() {
	const result = await getMeteredIceServers();
	return json(result, {
		headers: {
			'Cache-Control': 'no-store, max-age=0'
		}
	});
}
