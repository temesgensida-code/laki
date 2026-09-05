/**
 * Utility functions for formatting numbers, sizes, durations, and file data.
 */

/**
 * Format bytes into human-readable string (e.g. 14.5 MB, 1.2 GB).
 * @param {number} bytes
 * @param {number} [decimals=1]
 * @returns {string}
 */
export function formatBytes(bytes, decimals = 1) {
	if (bytes === 0) return '0 B';
	if (isNaN(bytes) || bytes < 0) return '-- B';

	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

	const i = Math.floor(Math.log(bytes) / Math.log(k));
	const idx = Math.min(i, sizes.length - 1);
	return parseFloat((bytes / Math.pow(k, idx)).toFixed(dm)) + ' ' + sizes[idx];
}

/**
 * Format speed in bytes per second to human-readable string (e.g. 12.4 MB/s).
 * @param {number} bytesPerSec
 * @returns {string}
 */
export function formatSpeed(bytesPerSec) {
	if (bytesPerSec <= 0 || isNaN(bytesPerSec)) return '0 B/s';
	return `${formatBytes(bytesPerSec, 1)}/s`;
}

/**
 * Format seconds into a friendly duration string (MM:SS or HH:MM:SS or 'Xm Ys remaining').
 * @param {number} seconds
 * @returns {string}
 */
export function formatDuration(seconds) {
	if (isNaN(seconds) || seconds < 0 || !isFinite(seconds)) return '--';
	const s = Math.round(seconds);
	const mins = Math.floor(s / 60);
	const secs = s % 60;
	const hours = Math.floor(mins / 60);

	if (hours > 0) {
		return `${hours}h ${mins % 60}m`;
	}
	if (mins > 0) {
		return `${mins}m ${secs}s`;
	}
	return `${secs}s`;
}

/**
 * Format time remaining (ETA).
 * @param {number} seconds
 * @returns {string}
 */
export function formatEta(seconds) {
	if (isNaN(seconds) || seconds <= 0 || !isFinite(seconds)) return 'Calculating...';
	if (seconds > 3600 * 24) return '> 24 hours';
	return `${formatDuration(seconds)} remaining`;
}

/**
 * Generate a friendly readable session ID (e.g. "sky-7x9q").
 * @returns {string}
 */
export function generateSessionId() {
	const adjectives = ['swift', 'hyper', 'pulse', 'orbit', 'cyber', 'solar', 'rapid', 'lunar', 'apex', 'relay'];
	const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
	const rand = Math.random().toString(36).substring(2, 7);
	return `${adj}-${rand}`;
}

/**
 * Get a friendly file category and icon classification based on extension or mime.
 * @param {string} filename
 * @param {string} mimeType
 * @returns {{ category: string, color: string, badge: string }}
 */
export function getFileTypeInfo(filename, mimeType = '') {
	const ext = filename.split('.').pop()?.toLowerCase() || '';

	if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif'].includes(ext)) {
		return { category: 'image', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20', badge: 'Image' };
	}
	if (mimeType.startsWith('video/') || ['mp4', 'mkv', 'mov', 'avi', 'webm'].includes(ext)) {
		return { category: 'video', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', badge: 'Video' };
	}
	if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(ext)) {
		return { category: 'audio', color: 'text-pink-400 bg-pink-500/10 border-pink-500/20', badge: 'Audio' };
	}
	if (['pdf'].includes(ext) || mimeType === 'application/pdf') {
		return { category: 'pdf', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20', badge: 'PDF' };
	}
	if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) {
		return { category: 'archive', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', badge: 'Archive' };
	}
	if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'py', 'rs', 'go', 'c', 'cpp', 'sh'].includes(ext)) {
		return { category: 'code', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', badge: 'Code' };
	}
	if (['doc', 'docx', 'txt', 'md', 'rtf', 'csv', 'xlsx'].includes(ext)) {
		return { category: 'document', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20', badge: 'Document' };
	}
	return { category: 'generic', color: 'text-zinc-400 bg-zinc-800/60 border-zinc-700/40', badge: ext.toUpperCase() || 'File' };
}
