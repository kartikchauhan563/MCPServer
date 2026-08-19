import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

import { parseJsonArray, parseJsonDocument, serializeDocs } from '../../shared/db/serialize.js';
import { jsonResult, toolError } from '../types.js';
import * as docs from './domain.js';

/** Agent 1 — MongoDB Atlas CRUD tools + prompts. */
export function registerMongoAgent(server: McpServer): void {
  const dbNameSchema = z
    .string()
    .optional()
    .describe(`Database name (default: ${docs.getDefaultDbName()})`);

  server.registerTool(
    'mongo_ping',
    {
      title: 'MongoDB ping',
      description: 'Verify connectivity to MongoDB Atlas.',
      annotations: { readOnlyHint: true },
    },
    async () => {
      try {
        return jsonResult(await docs.ping());
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'mongo_list_databases',
    {
      title: 'List databases',
      description: 'List databases on the connected MongoDB cluster.',
      annotations: { readOnlyHint: true },
    },
    async () => {
      try {
        return jsonResult(await docs.listDatabases());
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'mongo_list_collections',
    {
      title: 'List collections',
      description: 'List collections in a database.',
      inputSchema: z.object({ database: dbNameSchema }),
      annotations: { readOnlyHint: true },
    },
    async ({ database }) => {
      try {
        return jsonResult(await docs.listCollections(database));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'mongo_find',
    {
      title: 'Find documents',
      description:
        'Load/query documents from a collection. filter is a JSON object (MongoDB query).',
      inputSchema: z.object({
        collection: z.string().describe('Collection name'),
        database: dbNameSchema,
        filter: z.string().optional().describe('MongoDB filter as JSON string'),
        limit: z.number().int().min(1).max(200).default(20),
        sort: z.string().optional().describe('Sort as JSON string'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ collection, database, filter, limit, sort }) => {
      try {
        const result = await docs.findDocuments({
          collection,
          database,
          filter: filter ? parseJsonDocument(filter, 'filter') : {},
          limit,
          sort: sort ? parseJsonDocument(sort, 'sort') : undefined,
        });
        return {
          content: [{ type: 'text' as const, text: serializeDocs(result.documents) }],
        };
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'mongo_count',
    {
      title: 'Count documents',
      description: 'Count documents matching a filter.',
      inputSchema: z.object({
        collection: z.string(),
        database: dbNameSchema,
        filter: z.string().optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ collection, database, filter }) => {
      try {
        return jsonResult(
          await docs.countDocuments({
            collection,
            database,
            filter: filter ? parseJsonDocument(filter, 'filter') : {},
          }),
        );
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'mongo_insert_one',
    {
      title: 'Insert one document',
      description: 'Create a single document. document is a JSON object string.',
      inputSchema: z.object({
        collection: z.string(),
        database: dbNameSchema,
        document: z.string(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ collection, database, document }) => {
      try {
        return jsonResult(
          await docs.insertOne({
            collection,
            database,
            document: parseJsonDocument(document, 'document'),
          }),
        );
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'mongo_insert_many',
    {
      title: 'Insert many documents',
      description: 'Create multiple documents. documents is a JSON array string.',
      inputSchema: z.object({
        collection: z.string(),
        database: dbNameSchema,
        documents: z.string(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ collection, database, documents }) => {
      try {
        return jsonResult(
          await docs.insertMany({
            collection,
            database,
            documents: parseJsonArray(documents, 'documents'),
          }),
        );
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'mongo_update_one',
    {
      title: 'Update one document',
      description: 'Update the first matching document. Prefer $set operators.',
      inputSchema: z.object({
        collection: z.string(),
        database: dbNameSchema,
        filter: z.string(),
        update: z.string(),
        upsert: z.boolean().optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ collection, database, filter, update, upsert }) => {
      try {
        return jsonResult(
          await docs.updateOne({
            collection,
            database,
            filter: parseJsonDocument(filter, 'filter'),
            update: parseJsonDocument(update, 'update'),
            upsert,
          }),
        );
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'mongo_update_many',
    {
      title: 'Update many documents',
      description: 'Update all documents matching a filter.',
      inputSchema: z.object({
        collection: z.string(),
        database: dbNameSchema,
        filter: z.string(),
        update: z.string(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ collection, database, filter, update }) => {
      try {
        return jsonResult(
          await docs.updateMany({
            collection,
            database,
            filter: parseJsonDocument(filter, 'filter'),
            update: parseJsonDocument(update, 'update'),
          }),
        );
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'mongo_delete_one',
    {
      title: 'Delete one document',
      description: 'Delete the first document matching a filter.',
      inputSchema: z.object({
        collection: z.string(),
        database: dbNameSchema,
        filter: z.string(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ collection, database, filter }) => {
      try {
        return jsonResult(
          await docs.deleteOne({
            collection,
            database,
            filter: parseJsonDocument(filter, 'filter'),
          }),
        );
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'mongo_delete_many',
    {
      title: 'Delete many documents',
      description: 'Delete all documents matching a filter.',
      inputSchema: z.object({
        collection: z.string(),
        database: dbNameSchema,
        filter: z.string(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ collection, database, filter }) => {
      try {
        return jsonResult(
          await docs.deleteMany({
            collection,
            database,
            filter: parseJsonDocument(filter, 'filter'),
          }),
        );
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerResource(
    'mongo-config',
    'mongo://config',
    {
      title: 'MongoDB config',
      description: 'Non-secret MongoDB settings for Agent 1',
      mimeType: 'application/json',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(
            {
              agent: 'agent-1-mongo',
              defaultDatabase: docs.getDefaultDbName(),
              uriConfigured: Boolean(process.env.MONGODB_URI),
            },
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerPrompt(
    'mongo_load_data',
    {
      title: 'Load MongoDB data',
      description: 'Prompt template to query MongoDB',
      argsSchema: z.object({ collection: z.string(), goal: z.string() }),
    },
    ({ collection, goal }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Load data from MongoDB collection "${collection}".\nGoal: ${goal}\nUse mongo_find / mongo_count.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    'mongo_create_data',
    {
      title: 'Create MongoDB data',
      description: 'Prompt template to insert MongoDB documents',
      argsSchema: z.object({ collection: z.string(), dataDescription: z.string() }),
    },
    ({ collection, dataDescription }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Create data in MongoDB collection "${collection}".\nDetails: ${dataDescription}\nUse mongo_insert_one or mongo_insert_many.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    'mongo_update_data',
    {
      title: 'Update MongoDB data',
      description: 'Prompt template to update MongoDB documents',
      argsSchema: z.object({ collection: z.string(), changeDescription: z.string() }),
    },
    ({ collection, changeDescription }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Update data in MongoDB collection "${collection}".\nChange: ${changeDescription}\nUse mongo_update_one / mongo_update_many with $set.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    'mongo_delete_data',
    {
      title: 'Delete MongoDB data',
      description: 'Prompt template to delete MongoDB documents',
      argsSchema: z.object({ collection: z.string(), deleteDescription: z.string() }),
    },
    ({ collection, deleteDescription }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Delete data from MongoDB collection "${collection}".\nCriteria: ${deleteDescription}\nPreview with mongo_find, then mongo_delete_one / mongo_delete_many.`,
          },
        },
      ],
    }),
  );
}
