import { redirect } from '@sveltejs/kit';
import {
	getOAuthCookies,
	clearOAuthCookies,
	getGoogleRedirectUri,
	exchangeGoogleCode,
	fetchGoogleUserInfo,
	setSessionCookie
} from '$lib/server/auth.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, cookies }) {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const error = url.searchParams.get('error');
	const errorDescription = url.searchParams.get('error_description');

	const { state: storedState, codeVerifier: storedVerifier, redirectTo } = getOAuthCookies(cookies);
	clearOAuthCookies(cookies);

	if (error) {
		console.error('[Laki Auth] Google OAuth callback returned error:', error, errorDescription);
		throw redirect(302, `/?auth_error=${encodeURIComponent(errorDescription || error)}`);
	}

	if (!code || !state) {
		console.error('[Laki Auth] Missing code or state parameter');
		throw redirect(302, '/?auth_error=missing_code_or_state');
	}

	if (!storedState || storedState !== state || !storedVerifier) {
		console.error('[Laki Auth] State verification failed');
		throw redirect(302, '/?auth_error=invalid_state');
	}

	const isSecure = url.protocol === 'https:' || process.env.NODE_ENV === 'production';
	const redirectUri = getGoogleRedirectUri(url);

	try {
		// Exchange code for tokens
		const tokens = await exchangeGoogleCode(code, storedVerifier, redirectUri);

		// Fetch user profile from OpenID UserInfo
		const userInfo = await fetchGoogleUserInfo(tokens.access_token);

		if (!userInfo || !userInfo.sub) {
			throw new Error('Incomplete user profile received from Google');
		}

		const user = {
			id: userInfo.sub,
			email: userInfo.email,
			name: userInfo.name || userInfo.email?.split('@')[0] || 'Google User',
			picture: userInfo.picture || ''
		};

		// Set signed HTTP-only session cookie
		setSessionCookie(cookies, user, isSecure);

		// Safely redirect to desired destination
		const destination = redirectTo.startsWith('/') ? redirectTo : '/';
		throw redirect(302, destination);
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err && err.status === 302) {
			throw err;
		}
		console.error('[Laki Auth] OAuth callback processing error:', err);
		throw redirect(302, `/?auth_error=${encodeURIComponent(/** @type {Error} */ (err).message || 'auth_failed')}`);
	}
}
