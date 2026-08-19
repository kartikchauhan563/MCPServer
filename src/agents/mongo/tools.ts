import { num, obj, objectSchema, str, type AgentTool } from '../toolHelpers.js';
import * as docs from './domain.js';

export const mongoAgentTools: AgentTool[] = [
  {
    name: 'mongo_list_collections',
    description: 'List collections in the MongoDB database.',
    parameters: { type: 'object', properties: {}, required: [] },
    run: async () => docs.listCollections(),
  },
  {
    name: 'mongo_find',
    description: 'Find documents. filter is a MongoDB query object; use {} for all.',
    parameters: {
      type: 'object',
      properties: {
        collection: { type: 'string' },
        filter: objectSchema,
        limit: { type: 'integer', minimum: 1, maximum: 200 },
      },
      required: ['collection'],
    },
    run: async (args) =>
      docs.findDocuments({
        collection: str(args, 'collection'),
        filter: obj(args, 'filter', false),
        limit: num(args, 'limit', 25),
      }),
  },
  {
    name: 'mongo_count',
    description: 'Count documents matching a filter.',
    parameters: {
      type: 'object',
      properties: { collection: { type: 'string' }, filter: objectSchema },
      required: ['collection'],
    },
    run: async (args) =>
      docs.countDocuments({
        collection: str(args, 'collection'),
        filter: obj(args, 'filter', false),
      }),
  },
  {
    name: 'mongo_insert_one',
    description: 'Insert one document into a MongoDB collection.',
    parameters: {
      type: 'object',
      properties: { collection: { type: 'string' }, document: objectSchema },
      required: ['collection', 'document'],
    },
    run: async (args) =>
      docs.insertOne({
        collection: str(args, 'collection'),
        document: obj(args, 'document'),
      }),
  },
  {
    name: 'mongo_update_many',
    description: 'Update documents matching filter. Use operators like {"$set":{...}}.',
    parameters: {
      type: 'object',
      properties: {
        collection: { type: 'string' },
        filter: objectSchema,
        update: objectSchema,
      },
      required: ['collection', 'filter', 'update'],
    },
    run: async (args) =>
      docs.updateMany({
        collection: str(args, 'collection'),
        filter: obj(args, 'filter'),
        update: obj(args, 'update'),
      }),
  },
  {
    name: 'mongo_delete_many',
    description: 'Delete documents matching filter.',
    parameters: {
      type: 'object',
      properties: { collection: { type: 'string' }, filter: objectSchema },
      required: ['collection', 'filter'],
    },
    run: async (args) =>
      docs.deleteMany({
        collection: str(args, 'collection'),
        filter: obj(args, 'filter'),
      }),
  },
];
