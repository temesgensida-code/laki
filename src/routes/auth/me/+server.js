import { json } from '@sveltejs/kit';

/** @type {import('./$types').RequestHandler} */
export async function GET({ locals }) {
	return json({
		authenticated: Boolean(locals.user),
		user: locals.user || null
	});
}
