import crypto from 'node:crypto';

const AUTH_SECRET = process.env.AUTH_SECRET || 'laki-insecure-dev-auth-secret-change-in-production-1234567890';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

const SESSION_COOKIE_NAME = 'laki_session';
const OAUTH_STATE_COOKIE_NAME = 'laki_oauth_state';
const OAUTH_VERIFIER_COOKIE_NAME = 'laki_oauth_verifier';
const OAUTH_REDIRECT_COOKIE_NAME = 'laki_oauth_redirect';

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days
const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60; // 10 minutes

/**
 * Check if Google OAuth is configured with credentials
 */
export function isGoogleAuthConfigured() {
	return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

/**
 * Generate a cryptographically secure URL-safe random string
 * @param {number} bytes
 * @returns {string}
 */
export function generateRandomString(bytes = 32) {
	return crypto.randomBytes(bytes).toString('base64url');
}

/**
 * Generate PKCE code verifier and code challenge (S256)
 */
export function generatePKCE() {
	const codeVerifier = generateRandomString(32);
	const codeChallenge = crypto
		.createHash('sha256')
		.update(codeVerifier)
		.digest('base64url');

	return { codeVerifier, codeChallenge };
}

/**
 * Sign a payload object with HMAC-SHA256
 * @param {object} payload
 * @param {string} secret
 * @returns {string}
 */
export function signPayload(payload, secret = AUTH_SECRET) {
	const json = JSON.stringify(payload);
	const encodedData = Buffer.from(json, 'utf-8').toString('base64url');
	const signature = crypto
		.createHmac('sha256', secret)
		.update(encodedData)
		.digest('base64url');

	return `${encodedData}.${signature}`;
}

/**
 * Verify and decode a signed payload
 * @param {string} token
 * @param {string} secret
 * @returns {any | null}
 */
export function verifySignedPayload(token, secret = AUTH_SECRET) {
	if (!token || typeof token !== 'string') return null;

	const parts = token.split('.');
	if (parts.length !== 2) return null;

	const [encodedData, signature] = parts;

	try {
		const expectedSignature = crypto
			.createHmac('sha256', secret)
			.update(encodedData)
			.digest('base64url');

		const sigBuf = Buffer.from(signature, 'utf-8');
		const expBuf = Buffer.from(expectedSignature, 'utf-8');

		if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
			return null;
		}

		const json = Buffer.from(encodedData, 'base64url').toString('utf-8');
		const payload = JSON.parse(json);

		// Check expiration if present
		if (payload.exp && typeof payload.exp === 'number' && Date.now() > payload.exp) {
			return null;
		}

		return payload;
	} catch (err) {
		console.warn('[Laki Auth] Payload verification error:', err);
		return null;
	}
}

/**
 * Resolve the OAuth redirect URI for Google
 * @param {URL} requestUrl
 * @returns {string}
 */
export function getGoogleRedirectUri(requestUrl) {
	if (process.env.GOOGLE_REDIRECT_URI) {
		return process.env.GOOGLE_REDIRECT_URI;
	}
	return `${requestUrl.origin}/auth/google/callback`;
}

/**
 * Create Google OAuth authorization URL
 * @param {string} redirectUri
 * @param {string} state
 * @param {string} codeChallenge
 * @returns {string}
 */
export function createGoogleAuthUrl(redirectUri, state, codeChallenge) {
	const params = new URLSearchParams({
		client_id: GOOGLE_CLIENT_ID,
		redirect_uri: redirectUri,
		response_type: 'code',
		scope: 'openid email profile',
		state,
		code_challenge: codeChallenge,
		code_challenge_method: 'S256',
		access_type: 'offline',
		prompt: 'select_account'
	});

	return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens with Google
 * @param {string} code
 * @param {string} codeVerifier
 * @param {string} redirectUri
 */
export async function exchangeGoogleCode(code, codeVerifier, redirectUri) {
	const body = new URLSearchParams({
		client_id: GOOGLE_CLIENT_ID,
		client_secret: GOOGLE_CLIENT_SECRET,
		code,
		code_verifier: codeVerifier,
		grant_type: 'authorization_code',
		redirect_uri: redirectUri
	});

	const response = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: body.toString()
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Google token exchange failed (${response.status}): ${errorText}`);
	}

	return await response.json();
}

/**
 * Fetch user info from Google's OpenID UserInfo endpoint
 * @param {string} accessToken
 */
export async function fetchGoogleUserInfo(accessToken) {
	const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
		headers: {
			Authorization: `Bearer ${accessToken}`
		}
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Google userinfo fetch failed (${response.status}): ${errorText}`);
	}

	return await response.json();
}

/**
 * Set session cookie
 * @param {import('@sveltejs/kit').Cookies} cookies
 * @param {{ id: string, email: string, name: string, picture?: string }} user
 * @param {boolean} isSecure
 */
export function setSessionCookie(cookies, user, isSecure = false) {
	const payload = {
		user,
		iat: Date.now(),
		exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000
	};

	const token = signPayload(payload);

	cookies.set(SESSION_COOKIE_NAME, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: isSecure,
		maxAge: SESSION_MAX_AGE_SECONDS
	});
}

/**
 * Retrieve user from session cookie
 * @param {import('@sveltejs/kit').Cookies} cookies
 * @returns {{ id: string, email: string, name: string, picture?: string } | null}
 */
export function getSessionUser(cookies) {
	const token = cookies.get(SESSION_COOKIE_NAME);
	if (!token) return null;

	const payload = verifySignedPayload(token);
	if (!payload || !payload.user) {
		return null;
	}

	return payload.user;
}

/**
 * Delete session cookie
 * @param {import('@sveltejs/kit').Cookies} cookies
 */
export function clearSessionCookie(cookies) {
	cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
}

/**
 * Set temporary OAuth flow cookies
 * @param {import('@sveltejs/kit').Cookies} cookies
 * @param {{ state: string, codeVerifier: string, redirectTo?: string }} data
 * @param {boolean} isSecure
 */
export function setOAuthCookies(cookies, { state, codeVerifier, redirectTo }, isSecure = false) {
	const cookieOptions = {
		path: '/',
		httpOnly: true,
		sameSite: /** @type {'lax'} */ ('lax'),
		secure: isSecure,
		maxAge: OAUTH_STATE_MAX_AGE_SECONDS
	};

	cookies.set(OAUTH_STATE_COOKIE_NAME, state, cookieOptions);
	cookies.set(OAUTH_VERIFIER_COOKIE_NAME, codeVerifier, cookieOptions);
	if (redirectTo) {
		cookies.set(OAUTH_REDIRECT_COOKIE_NAME, redirectTo, cookieOptions);
	}
}

/**
 * Get temporary OAuth flow cookies
 * @param {import('@sveltejs/kit').Cookies} cookies
 */
export function getOAuthCookies(cookies) {
	return {
		state: cookies.get(OAUTH_STATE_COOKIE_NAME),
		codeVerifier: cookies.get(OAUTH_VERIFIER_COOKIE_NAME),
		redirectTo: cookies.get(OAUTH_REDIRECT_COOKIE_NAME) || '/'
	};
}

/**
 * Clear temporary OAuth flow cookies
 * @param {import('@sveltejs/kit').Cookies} cookies
 */
export function clearOAuthCookies(cookies) {
	cookies.delete(OAUTH_STATE_COOKIE_NAME, { path: '/' });
	cookies.delete(OAUTH_VERIFIER_COOKIE_NAME, { path: '/' });
	cookies.delete(OAUTH_REDIRECT_COOKIE_NAME, { path: '/' });
}
