import { MongoClient, ServerApiVersion } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB_NAME || 'lakidrop';

/** @type {MongoClient | null} */
let clientInstance = null;
/** @type {Promise<MongoClient> | null} */
let clientPromise = null;

/**
 * Gets or initializes the MongoDB client singleton
 * @returns {Promise<MongoClient>}
 */
export async function getMongoClient() {
	if (clientInstance) {
		return clientInstance;
	}

	if (!clientPromise) {
		const client = new MongoClient(uri, {
			serverApi: {
				version: ServerApiVersion.v1,
				strict: false,
				deprecationErrors: true
			}
		});

		clientPromise = client.connect().then((connectedClient) => {
			clientInstance = connectedClient;
			console.log(`[MongoDB] Connected successfully to database: ${dbName}`);
			return connectedClient;
		}).catch((err) => {
			clientPromise = null;
			console.error('[MongoDB] Connection error:', err.message);
			throw err;
		});
	}

	return clientPromise;
}

/**
 * Gets the MongoDB database instance
 * @returns {Promise<import('mongodb').Db>}
 */
export async function getDb() {
	const client = await getMongoClient();
	return client.db(dbName);
}

/**
 * Gets the resource_requests collection and ensures necessary indexes
 * @returns {Promise<import('mongodb').Collection>}
 */
export async function getResourceRequestsCollection() {
	const db = await getDb();
	const collection = db.collection('resource_requests');

	// Create indexes asynchronously without blocking
	collection.createIndex({ createdAt: -1 }).catch(() => {});
	collection.createIndex({ status: 1 }).catch(() => {});
	collection.createIndex({ 'fulfillment.expiresAt': 1 }).catch(() => {});

	return collection;
}
