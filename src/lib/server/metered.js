import { env } from '$env/dynamic/private';

/**
 * In-memory cache for Metered ICE credentials to reduce API roundtrips
 * and stay well within rate limits.
 */
let cachedIceServers = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Fallback public STUN servers if Metered is unconfigured
const FALLBACK_STUN_SERVERS = [
	{ urls: 'stun:stun.l.google.com:19302' },
	{ urls: 'stun:stun1.l.google.com:19302' },
	{ urls: 'stun:stun2.l.google.com:19302' },
	{ urls: 'stun:stun.cloudflare.com:3478' }
];

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

	// 1. Direct ICE Servers JSON override (from "Show ICE Servers Array" button)
	const rawJson = env.METERED_ICE_SERVERS_JSON?.trim();
	if (rawJson) {
		try {
			const parsed = JSON.parse(rawJson);
			if (Array.isArray(parsed) && parsed.length > 0) {
				cachedIceServers = parsed;
				cacheExpiresAt = now + 60 * 60 * 1000; // 1 hr
				return {
					iceServers: parsed,
					isRelayAvailable: true
				};
			}
		} catch (e) {
			console.warn('[Metered] Failed to parse METERED_ICE_SERVERS_JSON:', e.message);
		}
	}

	// 2. Fetch using Credential API Key
	const appInput = (env.METERED_DOMAIN || env.METERED_APP_NAME || '').trim();
	const apiKey = env.METERED_API_KEY?.trim();

	if (!appInput || !apiKey) {
		return {
			iceServers: FALLBACK_STUN_SERVERS,
			isRelayAvailable: false
		};
	}

	// Parse host: handle "laki.metered.live", "laki.metered.ca", or just "laki"
	let host = appInput;
	if (!host.includes('.')) {
		host = `${host}.metered.live`;
	}

	try {
		const targetUrl = `https://${host}/api/v1/turn/credentials?apiKey=${encodeURIComponent(apiKey)}`;
		const res = await fetch(targetUrl, {
			headers: { 'Accept': 'application/json' }
		});

		if (!res.ok) {
			console.warn(`[Metered] API returned status HTTP ${res.status}`);
			return {
				iceServers: FALLBACK_STUN_SERVERS,
				isRelayAvailable: false
			};
		}

		const data = await res.json();

		if (Array.isArray(data) && data.length > 0) {
			cachedIceServers = data;
			cacheExpiresAt = now + CACHE_TTL_MS;
			return {
				iceServers: data,
				isRelayAvailable: true
			};
		}

		return {
			iceServers: FALLBACK_STUN_SERVERS,
			isRelayAvailable: false
		};
	} catch (err) {
		console.error('[Metered] Error requesting TURN relay credentials:', err);
		return {
			iceServers: FALLBACK_STUN_SERVERS,
			isRelayAvailable: false
		};
	}
}
