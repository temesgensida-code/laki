import { redirect } from '@sveltejs/kit';
import { clearSessionCookie } from '$lib/server/auth.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ cookies }) {
	clearSessionCookie(cookies);
	throw redirect(302, '/');
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ cookies }) {
	clearSessionCookie(cookies);
	throw redirect(302, '/');
}
