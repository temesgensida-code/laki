import { json } from '@sveltejs/kit';
import { getResourceRequestsCollection } from '$lib/server/db.js';
import { ObjectId } from 'mongodb';

/**
 * Sanitizes a request document so private emails are never exposed to public clients
 * @param {any} doc
 * @param {string | undefined} currentUserId
 */
function sanitizeRequest(doc, currentUserId) {
	const now = new Date();
	let status = doc.status || 'pending';

	// Auto-expire 24 hours after fulfillment
	if (status === 'fulfilled' && doc.fulfillment?.expiresAt) {
		const expiresAt = new Date(doc.fulfillment.expiresAt);
		if (now > expiresAt) {
			status = 'expired';
		}
	}

	const hasSubscribed = Boolean(
		currentUserId && doc.subscribers?.some((/** @type {any} */ s) => s.userId === currentUserId)
	);

	const isRequester = Boolean(currentUserId && doc.requester?.id === currentUserId);

	return {
		id: doc._id.toString(),
		title: doc.title,
		description: doc.description,
		requester: {
			id: doc.requester?.id,
			name: doc.requester?.name || 'Anonymous',
			picture: doc.requester?.picture || null
		},
		subscriberCount: doc.subscribers?.length || doc.subscriberCount || 0,
		hasSubscribed,
		isRequester,
		status,
		fulfillment: doc.fulfillment
			? {
					fulfilledBy: doc.fulfillment.fulfilledBy,
					fileName: doc.fulfillment.fileName,
					fileSize: doc.fulfillment.fileSize,
					fileLink: doc.fulfillment.fileLink,
					uploadedAt: doc.fulfillment.uploadedAt,
					expiresAt: doc.fulfillment.expiresAt,
					isExpired: status === 'expired'
				}
			: null,
		createdAt: doc.createdAt,
		updatedAt: doc.updatedAt
	};
}

/** @type {import('./$types').RequestHandler} */
export async function GET({ locals }) {
	try {
		const collection = await getResourceRequestsCollection();
		const currentUserId = locals.user?.id;

		const docs = await collection.find({}).sort({ createdAt: -1 }).limit(100).toArray();

		const sanitized = docs.map((doc) => sanitizeRequest(doc, currentUserId));

		return json({ success: true, requests: sanitized });
	} catch (err) {
		console.error('[API Requests GET] Error:', err);
		return json({ error: 'Failed to retrieve community requests' }, { status: 500 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
	const user = locals.user;
	if (!user) {
		return json(
			{ error: 'Please sign in with Google to post a resource request.' },
			{ status: 401 }
		);
	}

	try {
		const body = await request.json();
		const title = (body.title || '').trim();
		const description = (body.description || '').trim();
		const email = (body.email || user.email || '').trim().toLowerCase();

		if (!title || title.length < 3 || title.length > 150) {
			return json({ error: 'Title must be between 3 and 150 characters.' }, { status: 400 });
		}

		if (!description || description.length < 5 || description.length > 2500) {
			return json({ error: 'Description must be between 5 and 2,500 characters.' }, { status: 400 });
		}

		// Basic email format validation
		if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			return json({ error: 'A valid email address is required to notify you when the file is available.' }, { status: 400 });
		}

		const collection = await getResourceRequestsCollection();

		const newDoc = {
			title,
			description,
			requester: {
				id: user.id,
				name: user.name,
				picture: user.picture || null
			},
			requesterEmail: email, // Kept strictly private on server
			subscribers: [],
			subscriberCount: 0,
			status: 'pending',
			fulfillment: null,
			createdAt: new Date(),
			updatedAt: new Date()
		};

		const result = await collection.insertOne(newDoc);
		const createdDoc = { ...newDoc, _id: result.insertedId };

		return json({
			success: true,
			request: sanitizeRequest(createdDoc, user.id)
		});
	} catch (err) {
		console.error('[API Requests POST] Error:', err);
		return json({ error: 'Failed to create resource request' }, { status: 500 });
	}
}
