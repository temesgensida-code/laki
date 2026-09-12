import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from '$env/dynamic/private';

const UPLOAD_DIR = path.resolve(process.cwd(), '.data', 'community_files');

// Ensure upload directory exists for resilient local fallback
if (!fs.existsSync(UPLOAD_DIR)) {
	fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function getFileIoApiKey() {
	return env.FILE_IO_API_KEY || (typeof process !== 'undefined' && process.env.FILE_IO_API_KEY);
}

/**
 * Periodically purge expired local files older than 24 hours
 */
export function purgeExpiredFiles() {
	try {
		if (!fs.existsSync(UPLOAD_DIR)) return;
		const now = Date.now();
		const files = fs.readdirSync(UPLOAD_DIR);
		for (const file of files) {
			const filePath = path.join(UPLOAD_DIR, file);
			const stats = fs.statSync(filePath);
			// 24 hours in milliseconds = 86,400,000
			if (now - stats.mtimeMs > 24 * 60 * 60 * 1000) {
				fs.unlinkSync(filePath);
				console.log(`[File Cleanup] Purged expired file: ${file}`);
			}
		}
	} catch (err) {
		console.error('[File Cleanup] Error purging expired files:', err);
	}
}

/**
 * Uploads a file via file.io API with 24-hour expiration, with fallback to local ephemeral storage.
 * @param {Buffer | Uint8Array} buffer
 * @param {string} filename
 * @param {string} mimeType
 * @param {string} origin
 * @returns {Promise<{ link: string, key: string, provider: 'file.io' | 'local', expiresAt: Date }>}\n */
export async function uploadResourceFile(buffer, filename, mimeType, origin) {
	const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
	const safeFilename = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');

	// Attempt 1: Upload via file.io API with 24h expiration (expires=1d)
	try {
		console.log(`[file.io] Attempting upload of "${safeFilename}" (${buffer.length} bytes)...`);

		const formData = new FormData();
		const blob = new Blob([buffer], { type: mimeType || 'application/octet-stream' });
		formData.append('file', blob, safeFilename);

		/** @type {Record<string, string>} */
		const headers = {};
		const apiKey = getFileIoApiKey();
		if (apiKey) {
			headers['Authorization'] = `Bearer ${apiKey}`;
		}

		// 15-second timeout for file.io request
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 15000);

		const response = await fetch('https://file.io/?expires=1d', {
			method: 'POST',
			body: formData,
			headers,
			signal: controller.signal
		});

		clearTimeout(timeoutId);

		if (response.ok) {
			const data = await response.json();
			if (data && (data.success || data.link)) {
				console.log(`[file.io] Successfully uploaded file to file.io: ${data.link}`);
				return {
					link: data.link,
					key: data.key || data.id || 'fileio',
					provider: 'file.io',
					expiresAt
				};
			}
		}

		console.warn(`[file.io] file.io returned status ${response.status}. Switching to resilient local 24h storage.`);
	} catch (err) {
		console.warn('[file.io] External file.io upload failed/timed out:', /** @type {Error} */ (err).message);
	}

	// Resilient Fallback: Local ephemeral storage with exact 24-hour expiration
	const fileId = crypto.randomBytes(16).toString('hex');
	const localStoredName = `${fileId}_${safeFilename}`;
	const filePath = path.join(UPLOAD_DIR, localStoredName);

	fs.writeFileSync(filePath, Buffer.from(buffer));
	console.log(`[Storage] Stored ephemeral file locally: ${localStoredName} (expires in 24h)`);

	// Run cleanup
	purgeExpiredFiles();

	const localDownloadUrl = `${origin.replace(/\/$/, '')}/api/community/download/${fileId}`;
	return {
		link: localDownloadUrl,
		key: fileId,
		provider: 'local',
		expiresAt
	};
}

/**
 * Retrieves a locally stored ephemeral file if not expired
 * @param {string} fileId
 * @returns {{ filePath: string, filename: string, mimeType: string } | null}
 */
export function getLocalEphemeralFile(fileId) {
	if (!fs.existsSync(UPLOAD_DIR)) return null;
	const files = fs.readdirSync(UPLOAD_DIR);
	const match = files.find((f) => f.startsWith(`${fileId}_`));
	if (!match) return null;

	const filePath = path.join(UPLOAD_DIR, match);
	const stats = fs.statSync(filePath);

	// Expired after 24 hours
	if (Date.now() - stats.mtimeMs > 24 * 60 * 60 * 1000) {
		try {
			fs.unlinkSync(filePath);
		} catch {}
		return null;
	}

	const originalName = match.substring(fileId.length + 1);
	return {
		filePath,
		filename: originalName,
		mimeType: 'application/octet-stream'
	};
}
