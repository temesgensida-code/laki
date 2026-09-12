import { redirect } from '@sveltejs/kit';
import {
	isGoogleAuthConfigured,
	generatePKCE,
	generateRandomString,
	setOAuthCookies,
	getGoogleRedirectUri,
	createGoogleAuthUrl
} from '$lib/server/auth.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, request, cookies }) {
	const returnUrl = url.searchParams.get('returnUrl') || '/';

	if (!isGoogleAuthConfigured()) {
		console.warn('[Laki Auth] Google OAuth credentials missing (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).');
		throw redirect(302, `/?auth_error=missing_credentials`);
	}

	const state = generateRandomString(32);
	const { codeVerifier, codeChallenge } = generatePKCE();
	const isSecure = url.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';

	setOAuthCookies(cookies, { state, codeVerifier, redirectTo: returnUrl }, isSecure);

	const redirectUri = getGoogleRedirectUri(url);
	const authUrl = createGoogleAuthUrl(redirectUri, state, codeChallenge);

	throw redirect(302, authUrl);
}
