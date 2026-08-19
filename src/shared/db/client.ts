import dns from 'node:dns';

import { MongoClient, type Db } from 'mongodb';

dns.setServers(['8.8.8.8', '1.1.1.1']);
dns.setDefaultResultOrder('ipv4first');

let client: MongoClient | null = null;
let connecting: Promise<MongoClient> | null = null;

export function getDefaultDbName(): string {
  return process.env.MONGODB_DB?.trim() || 'demo_mcp';
}

export async function getClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error(
      'MONGODB_URI is not set. Add it to .env or pass it via the server env.',
    );
  }

  if (client) return client;
  if (connecting) return connecting;

  connecting = (async () => {
    const next = new MongoClient(uri, {
      serverSelectionTimeoutMS: 10_000,
    });
    await next.connect();
    client = next;
    connecting = null;
    return next;
  })();

  try {
    return await connecting;
  } catch (error) {
    connecting = null;
    throw error;
  }
}

export async function getDb(dbName?: string): Promise<Db> {
  const mongo = await getClient();
  return mongo.db(dbName?.trim() || getDefaultDbName());
}

export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
  }
}
