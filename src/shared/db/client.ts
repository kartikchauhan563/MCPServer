import dns from 'node:dns';

import { MongoClient, type Db } from 'mongodb';

/**
 * Corporate networks often break mongodb+srv SRV lookups, so public resolvers
 * can be opted into via MONGODB_DNS_SERVERS. Managed hosts (Render) must keep
 * their own resolver — forcing external DNS there can hang every request.
 */
const dnsServers = process.env.MONGODB_DNS_SERVERS?.trim();
if (dnsServers) {
  dns.setServers(dnsServers.split(',').map((s) => s.trim()).filter(Boolean));
}
dns.setDefaultResultOrder('ipv4first');

let client: MongoClient | null = null;
let connecting: Promise<MongoClient> | null = null;

export function getDefaultDbName(): string {
  return process.env.MONGODB_DB?.trim() || 'demo_mcp';
}

export function isMongoConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI?.trim());
}

export async function getClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error(
      'MONGODB_URI is not set. Add it to .env or the host environment variables.',
    );
  }

  if (client) return client;
  if (connecting) return connecting;

  const timeout = Number(process.env.MONGODB_TIMEOUT_MS || 8000);

  connecting = (async () => {
    const next = new MongoClient(uri, {
      serverSelectionTimeoutMS: timeout,
      connectTimeoutMS: timeout,
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
