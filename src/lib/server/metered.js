import { env } from '$env/dynamic/private';

/**
 * In-memory cache for Metered ICE credentials to reduce API roundtrips
 * and stay well within rate limits.
 */
let cachedIceServers = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const FAILED_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache for failed calls

/**
 * Curated Metered STUN & TURN Relay credentials grouped into 2 clean entries:
 * 1. Working STUN server (port 80)
 * 2. Working TCP and TLS (TURNS port 443) TURN servers
 *
 * Grouping avoids Firefox's "Using five or more STUN/TURN servers slows down discovery"
 * warning and eliminates timeouts on blocked UDP ports.
 */
export const DEFAULT_METERED_ICE_SERVERS = [
	{
		urls: 'stun:stun.relay.metered.ca:80'
	},
	{
		urls: [
			'turns:global.relay.metered.ca:443?transport=tcp',
			'turn:global.relay.metered.ca:80?transport=tcp'
		],
		username: 'd02bb0ddedcd405a948b0e80',
		credential: 'fUsjQojKdvJ3unhq'
	}
];

/**
 * Curates and groups ICE servers into a clean 2-entry array:
 * 1. STUN server
 * 2. Working TCP / TLS TURN servers
 * @param {Array<any>} rawServers
 * @returns {Array<RTCIceServer>}
 */
function curateIceServers(rawServers) {
	if (!Array.isArray(rawServers) || rawServers.length === 0) {
		return DEFAULT_METERED_ICE_SERVERS;
	}

	let username = 'd02bb0ddedcd405a948b0e80';
	let credential = 'fUsjQojKdvJ3unhq';
	const stunUrls = [];
	const turnUrls = [];

	for (const srv of rawServers) {
		if (srv.username) username = srv.username;
		if (srv.credential) credential = srv.credential;

		const urls = Array.isArray(srv.urls) ? srv.urls : [srv.urls];
		for (const u of urls) {
			if (!u || typeof u !== 'string') continue;

			if (u.startsWith('stun:')) {
				const clean = u.split('?')[0];
				if (!stunUrls.includes(clean)) stunUrls.push(clean);
			} else if (u.startsWith('turn:') || u.startsWith('turns:')) {
				// Prioritize TLS and TCP endpoints which bypass UDP filtering and timeouts
				if (u.includes('transport=tcp') && !turnUrls.includes(u)) {
					turnUrls.push(u);
				}
			}
		}
	}

	// Always ensure TURNS over TLS on port 443 is primary
	if (!turnUrls.includes('turns:global.relay.metered.ca:443?transport=tcp')) {
		turnUrls.unshift('turns:global.relay.metered.ca:443?transport=tcp');
	}
	if (!turnUrls.includes('turn:global.relay.metered.ca:80?transport=tcp')) {
		turnUrls.push('turn:global.relay.metered.ca:80?transport=tcp');
	}

	return [
		{
			urls: stunUrls.length > 0 ? stunUrls : 'stun:stun.relay.metered.ca:80'
		},
		{
			urls: turnUrls,
			username,
			credential
		}
	];
}

/**
 * Fetches dynamic STUN and TURN relay credentials from Metered
 * @returns {Promise<{ iceServers: Array<RTCIceServer>, isRelayAvailable: boolean }>}
 */
export async function getMeteredIceServers() {
	const now = Date.now();

	if (cachedIceServers && now < cacheExpiresAt) {
		return {
			iceServers: cachedIceServers,
			isRelayAvailable: true
		};
	}

	// 1. Direct ICE Servers JSON override (from .env or UI)
	const rawJson = env.METERED_ICE_SERVERS_JSON?.trim();
	if (rawJson) {
		try {
			const parsed = JSON.parse(rawJson);
			if (Array.isArray(parsed) && parsed.length > 0) {
				const curated = curateIceServers(parsed);
				cachedIceServers = curated;
				cacheExpiresAt = now + 60 * 60 * 1000; // 1 hr
				return {
					iceServers: curated,
					isRelayAvailable: true
				};
			}
		} catch (e) {
			console.warn('[Metered] Failed to parse METERED_ICE_SERVERS_JSON:', e.message);
		}
	}

	// 2. Fetch using Credential API Key
	const appInput = (env.METERED_DOMAIN || env.METERED_APP_NAME || 'laki.metered.live').trim();
	const apiKey = (env.METERED_API_KEY || '2b622bfed37c44ea849d802872779ddd720a').trim();

	// Parse host: handle "laki.metered.live", "laki.metered.ca", or just "laki"
	let host = appInput;
	if (!host.includes('.')) {
		host = `${host}.metered.live`;
	}

	try {
		const targetUrl = `https://${host}/api/v1/turn/credentials?apiKey=${encodeURIComponent(apiKey)}`;
		const res = await fetch(targetUrl, {
			headers: { Accept: 'application/json' }
		});

		if (!res.ok) {
			console.warn(`[Metered] API returned status HTTP ${res.status}. Using default Metered relay credentials.`);
			cachedIceServers = DEFAULT_METERED_ICE_SERVERS;
			cacheExpiresAt = now + FAILED_CACHE_TTL_MS;
			return {
				iceServers: DEFAULT_METERED_ICE_SERVERS,
				isRelayAvailable: true
			};
		}

		const data = await res.json();

		if (Array.isArray(data) && data.length > 0) {
			const curated = curateIceServers(data);
			cachedIceServers = curated;
			cacheExpiresAt = now + CACHE_TTL_MS;
			return {
				iceServers: curated,
				isRelayAvailable: true
			};
		}

		cachedIceServers = DEFAULT_METERED_ICE_SERVERS;
		cacheExpiresAt = now + CACHE_TTL_MS;
		return {
			iceServers: DEFAULT_METERED_ICE_SERVERS,
			isRelayAvailable: true
		};
	} catch (err) {
		console.warn('[Metered] Network error requesting credentials, using fallback:', err.message);
		cachedIceServers = DEFAULT_METERED_ICE_SERVERS;
		cacheExpiresAt = now + FAILED_CACHE_TTL_MS;
		return {
			iceServers: DEFAULT_METERED_ICE_SERVERS,
			isRelayAvailable: true
		};
	}
}
