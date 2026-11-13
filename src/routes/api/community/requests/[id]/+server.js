import { json } from '@sveltejs/kit';
import { getResourceRequestsCollection } from '$lib/server/db.js';
import { ObjectId } from 'mongodb';

/** @type {import('./$types').RequestHandler} */
export async function DELETE({ params, locals }) {
	const user = locals.user;
	if (!user) {
		return json(
			{ error: 'Please sign in with Google to delete your request.' },
			{ status: 401 }
		);
	}

	try {
		const id = params.id;
		if (!ObjectId.isValid(id)) {
			return json({ error: 'Invalid request ID' }, { status: 400 });
		}

		const collection = await getResourceRequestsCollection();
		const doc = await collection.findOne({ _id: new ObjectId(id) });

		if (!doc) {
			return json({ error: 'Resource request not found' }, { status: 404 });
		}

		// Ensure only the user who created the request can delete it
		if (doc.requester?.id !== user.id) {
			return json(
				{ error: 'You are not authorized to delete this request.' },
				{ status: 403 }
			);
		}

		await collection.deleteOne({ _id: new ObjectId(id) });

		return json({
			success: true,
			message: 'Request deleted successfully'
		});
	} catch (err) {
		console.error('[API Requests DELETE] Error:', err);
		return json({ error: 'Failed to delete resource request' }, { status: 500 });
	}
}
