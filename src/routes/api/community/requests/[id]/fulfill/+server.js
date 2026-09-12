import { json } from '@sveltejs/kit';
import { getResourceRequestsCollection } from '$lib/server/db.js';
import { uploadResourceFile } from '$lib/server/fileio.js';
import { sendResourceFulfilledNotification } from '$lib/server/email.js';
import { ObjectId } from 'mongodb';

/** @type {import('./$types').RequestHandler} */
export async function POST({ params, request, url, locals }) {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Please sign in with Google to volunteer files.' }, { status: 401 });
	}

	try {
		const id = params.id;
		if (!ObjectId.isValid(id)) {
			return json({ error: 'Invalid request ID' }, { status: 400 });
		}

		const formData = await request.formData();
		const file = formData.get('file');

		if (!file || !(file instanceof File) || file.size === 0) {
			return json({ error: 'Please select a file to upload.' }, { status: 400 });
		}

		// Enforce a sensible 100MB ceiling for uploads
		if (file.size > 100 * 1024 * 1024) {
			return json({ error: 'File size exceeds maximum limit of 100MB.' }, { status: 400 });
		}

		const collection = await getResourceRequestsCollection();
		const doc = await collection.findOne({ _id: new ObjectId(id) });

		if (!doc) {
			return json({ error: 'Resource request not found' }, { status: 404 });
		}

		// Read file buffer
		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		// Upload via file.io with 24-hour expiration rule
		const uploadResult = await uploadResourceFile(buffer, file.name, file.type, url.origin);

		const fulfillmentData = {
			fulfilledBy: {
				id: user.id,
				name: user.name,
				picture: user.picture || null
			},
			fileName: file.name,
			fileSize: file.size,
			fileLink: uploadResult.link,
			fileKey: uploadResult.key,
			provider: uploadResult.provider,
			uploadedAt: new Date(),
			expiresAt: uploadResult.expiresAt
		};

		await collection.updateOne(
			{ _id: new ObjectId(id) },
			{
				$set: {
					status: 'fulfilled',
					fulfillment: fulfillmentData,
					updatedAt: new Date()
				}
			}
		);

		// Dispatch email notifications to the requester and all interested volunteers/subscribers
		const siteUrl = `${url.origin}/community`;
		sendResourceFulfilledNotification({
			requestTitle: doc.title,
			requesterEmail: doc.requesterEmail,
			subscribers: doc.subscribers || [],
			fulfilledByName: user.name,
			downloadUrl: uploadResult.link,
			expiresAt: uploadResult.expiresAt,
			siteUrl
		}).catch((err) => {
			console.error('[API Fulfill] Error sending notifications:', err);
		});

		return json({
			success: true,
			fulfillment: {
				fulfilledBy: fulfillmentData.fulfilledBy,
				fileName: fulfillmentData.fileName,
				fileSize: fulfillmentData.fileSize,
				fileLink: fulfillmentData.fileLink,
				uploadedAt: fulfillmentData.uploadedAt,
				expiresAt: fulfillmentData.expiresAt,
				isExpired: false
			}
		});
	} catch (err) {
		console.error('[API Fulfill POST] Error:', err);
		return json({ error: 'Failed to upload and fulfill resource' }, { status: 500 });
	}
}
