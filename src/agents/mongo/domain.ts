import type { Document } from 'mongodb';

import { getClient, getDb, getDefaultDbName } from '../../shared/db/client.js';
import { asDocument, toPlain } from '../../shared/db/serialize.js';

export type DbScope = {
  database?: string;
  collection: string;
};

export async function ping() {
  const client = await getClient();
  const result = await client.db().admin().ping();
  return {
    ok: result.ok === 1,
    defaultDb: getDefaultDbName(),
  };
}

export async function listDatabases() {
  const client = await getClient();
  const { databases } = await client.db().admin().listDatabases();
  return databases;
}

export async function listCollections(database?: string) {
  const db = await getDb(database);
  const collections = await db.listCollections().toArray();
  return {
    database: db.databaseName,
    collections: collections.map((c) => c.name),
  };
}

export async function findDocuments(options: {
  collection: string;
  database?: string;
  filter?: Document | Record<string, unknown>;
  limit?: number;
  sort?: Document | Record<string, unknown>;
}) {
  const db = await getDb(options.database);
  const filter = asDocument(options.filter ?? {}, 'filter');
  const limit = options.limit ?? 20;
  let cursor = db.collection(options.collection).find(filter).limit(limit);
  if (options.sort) {
    cursor = cursor.sort(asDocument(options.sort, 'sort'));
  }
  const docs = await cursor.toArray();
  return {
    database: db.databaseName,
    collection: options.collection,
    count: docs.length,
    documents: toPlain(docs) as Document[],
  };
}

export async function countDocuments(options: {
  collection: string;
  database?: string;
  filter?: Document | Record<string, unknown>;
}) {
  const db = await getDb(options.database);
  const filter = asDocument(options.filter ?? {}, 'filter');
  const count = await db.collection(options.collection).countDocuments(filter);
  return {
    database: db.databaseName,
    collection: options.collection,
    count,
  };
}

export async function insertOne(options: {
  collection: string;
  database?: string;
  document: Document | Record<string, unknown>;
}) {
  const db = await getDb(options.database);
  const document = asDocument(options.document, 'document');
  const result = await db.collection(options.collection).insertOne(document);
  return {
    database: db.databaseName,
    collection: options.collection,
    insertedId: result.insertedId.toHexString(),
  };
}

export async function insertMany(options: {
  collection: string;
  database?: string;
  documents: Array<Document | Record<string, unknown>>;
}) {
  if (!Array.isArray(options.documents) || options.documents.length === 0) {
    throw new Error('documents must be a non-empty array');
  }
  const db = await getDb(options.database);
  const documents = options.documents.map((doc, i) =>
    asDocument(doc, `documents[${i}]`),
  );
  const result = await db.collection(options.collection).insertMany(documents);
  return {
    database: db.databaseName,
    collection: options.collection,
    insertedCount: result.insertedCount,
    insertedIds: Object.values(result.insertedIds).map((id) => id.toHexString()),
  };
}

export async function updateOne(options: {
  collection: string;
  database?: string;
  filter: Document | Record<string, unknown>;
  update: Document | Record<string, unknown>;
  upsert?: boolean;
}) {
  const db = await getDb(options.database);
  const filter = asDocument(options.filter, 'filter');
  const update = asDocument(options.update, 'update');
  const result = await db.collection(options.collection).updateOne(filter, update, {
    upsert: options.upsert ?? false,
  });
  return {
    database: db.databaseName,
    collection: options.collection,
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount,
    upsertedId: result.upsertedId?.toHexString() ?? null,
  };
}

export async function updateMany(options: {
  collection: string;
  database?: string;
  filter: Document | Record<string, unknown>;
  update: Document | Record<string, unknown>;
}) {
  const db = await getDb(options.database);
  const filter = asDocument(options.filter, 'filter');
  const update = asDocument(options.update, 'update');
  const result = await db.collection(options.collection).updateMany(filter, update);
  return {
    database: db.databaseName,
    collection: options.collection,
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount,
  };
}

export async function deleteOne(options: {
  collection: string;
  database?: string;
  filter: Document | Record<string, unknown>;
}) {
  const db = await getDb(options.database);
  const filter = asDocument(options.filter, 'filter');
  const result = await db.collection(options.collection).deleteOne(filter);
  return {
    database: db.databaseName,
    collection: options.collection,
    deletedCount: result.deletedCount,
  };
}

export async function deleteMany(options: {
  collection: string;
  database?: string;
  filter: Document | Record<string, unknown>;
}) {
  const db = await getDb(options.database);
  const filter = asDocument(options.filter, 'filter');
  const result = await db.collection(options.collection).deleteMany(filter);
  return {
    database: db.databaseName,
    collection: options.collection,
    deletedCount: result.deletedCount,
  };
}

export { getDefaultDbName };
