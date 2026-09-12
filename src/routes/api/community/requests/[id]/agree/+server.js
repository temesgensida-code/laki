import { json } from '@sveltejs/kit';
import { getResourceRequestsCollection } from '$lib/server/db.js';
import { ObjectId } from 'mongodb';

/** @type {import('./$types').RequestHandler} */
export async function POST({ params, request, locals }) {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Please sign in with Google to subscribe.' }, { status: 401 });
	}

	try {
		const id = params.id;
		if (!ObjectId.isValid(id)) {
			return json({ error: 'Invalid request ID' }, { status: 400 });
		}

		let body = {};
		try {
			body = await request.json();
		} catch {}

		const email = (body.email || user.email || '').trim().toLowerCase();
		if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			return json({ error: 'A valid email is required to receive notifications.' }, { status: 400 });
		}

		const collection = await getResourceRequestsCollection();
		const doc = await collection.findOne({ _id: new ObjectId(id) });

		if (!doc) {
			return json({ error: 'Resource request not found' }, { status: 404 });
		}

		// Check if already subscribed
		const alreadySubscribed = doc.subscribers?.some((/** @type {any} */ s) => s.userId === user.id);

		if (!alreadySubscribed) {
			const subscriberObj = {
				userId: user.id,
				name: user.name,
				email, // Kept private
				subscribedAt: new Date()
			};

			await collection.updateOne(
				{ _id: new ObjectId(id) },
				{
					$push: { subscribers: subscriberObj },
					$inc: { subscriberCount: 1 },
					$set: { updatedAt: new Date() }
				}
			);
		}

		const updatedDoc = await collection.findOne({ _id: new ObjectId(id) });
		const count = updatedDoc?.subscribers?.length || 0;

		return json({
			success: true,
			hasSubscribed: true,
			subscriberCount: count
		});
	} catch (err) {
		console.error('[API Agree POST] Error:', err);
		return json({ error: 'Failed to subscribe to resource' }, { status: 500 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function DELETE({ params, locals }) {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Please sign in with Google.' }, { status: 401 });
	}

	try {
		const id = params.id;
		if (!ObjectId.isValid(id)) {
			return json({ error: 'Invalid request ID' }, { status: 400 });
		}

		const collection = await getResourceRequestsCollection();
		await collection.updateOne(
			{ _id: new ObjectId(id) },
			{
				$pull: { subscribers: { userId: user.id } },
				$set: { updatedAt: new Date() }
			}
		);

		const updatedDoc = await collection.findOne({ _id: new ObjectId(id) });
		const count = updatedDoc?.subscribers?.length || 0;

		return json({
			success: true,
			hasSubscribed: false,
			subscriberCount: count
		});
	} catch (err) {
		console.error('[API Agree DELETE] Error:', err);
		return json({ error: 'Failed to unsubscribe' }, { status: 500 });
	}
}
