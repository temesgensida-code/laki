/**
 * WebRTC and file transfer configuration constants.
 */

export const RTC_CONFIG = {
	iceServers: [
		{ urls: 'stun:stun.l.google.com:19302' },
		{ urls: 'stun:stun1.l.google.com:19302' },
		{ urls: 'stun:stun2.l.google.com:19302' },
		{ urls: 'stun:stun3.l.google.com:19302' },
		{ urls: 'stun:stun4.l.google.com:19302' },
		{ urls: 'stun:global.stun.twilio.com:3478' }
	],
	iceCandidatePoolSize: 10
};

// 64 KB is standard and optimal for WebRTC DataChannels across all modern browsers
export const CHUNK_SIZE = 64 * 1024; // 65,536 bytes

// 8 bytes prefix: Uint32 chunkIndex (4 bytes) + Uint32 totalChunks (4 bytes)
export const HEADER_SIZE = 8;
export const DATA_PER_CHUNK = CHUNK_SIZE - HEADER_SIZE; // 65,528 bytes of file data per chunk

// Backpressure flow-control thresholds
export const BUFFERED_AMOUNT_LOW_THRESHOLD = 256 * 1024; // 256 KB
export const BUFFERED_AMOUNT_HIGH_WATERMARK = 1024 * 1024; // 1 MB (pause sending)

// Reconnection timeouts
export const ICE_DISCONNECT_GRACE_PERIOD_MS = 8000;
export const MAX_RETRY_ATTEMPTS = 5;
export const HEARTBEAT_INTERVAL_MS = 3000;
export const STALL_TIMEOUT_MS = 7000;
