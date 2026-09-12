import fs from 'node:fs';
import { error } from '@sveltejs/kit';
import { getLocalEphemeralFile } from '$lib/server/fileio.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ params }) {
	const fileId = params.fileId;
	const fileInfo = getLocalEphemeralFile(fileId);

	if (!fileInfo) {
		throw error(410, {
			message: 'This resource has expired after 24 hours and has been permanently removed.'
		});
	}

	const fileBuffer = fs.readFileSync(fileInfo.filePath);
	const encodedFilename = encodeURIComponent(fileInfo.filename);

	return new Response(fileBuffer, {
		headers: {
			'Content-Type': fileInfo.mimeType || 'application/octet-stream',
			'Content-Disposition': `attachment; filename="${fileInfo.filename}"; filename*=UTF-8''${encodedFilename}`,
			'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
		}
	});
}
