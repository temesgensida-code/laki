import { getResourceRequestsCollection } from '$lib/server/db.js';

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals }) {
	try {
		const collection = await getResourceRequestsCollection();
		const currentUserId = locals.user?.id;

		const docs = await collection.find({}).sort({ createdAt: -1 }).limit(100).toArray();

		const now = new Date();

		const requests = docs.map((doc) => {
			let status = doc.status || 'pending';
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
					name: doc.requester?.name || 'Community Member',
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
							uploadedAt: doc.fulfillment.uploadedAt?.toISOString
								? doc.fulfillment.uploadedAt.toISOString()
								: doc.fulfillment.uploadedAt,
							expiresAt: doc.fulfillment.expiresAt?.toISOString
								? doc.fulfillment.expiresAt.toISOString()
								: doc.fulfillment.expiresAt,
							isExpired: status === 'expired'
						}
					: null,
				createdAt: doc.createdAt?.toISOString ? doc.createdAt.toISOString() : doc.createdAt,
				updatedAt: doc.updatedAt?.toISOString ? doc.updatedAt.toISOString() : doc.updatedAt
			};
		});

		return {
			requests,
			user: locals.user
		};
	} catch (err) {
		console.error('[Community Load] Error querying requests:', err);
		return {
			requests: [],
			user: locals.user
		};
	}
}
