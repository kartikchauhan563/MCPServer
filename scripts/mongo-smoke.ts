import 'dotenv/config';

import { closeMongo } from '../src/shared/db/client.ts';
import {
  deleteOne,
  getDefaultDbName,
  insertOne,
  listCollections,
  ping,
} from '../src/agents/mongo/domain.ts';

async function main() {
  const health = await ping();
  const listed = await listCollections();
  const inserted = await insertOne({
    collection: '_mcp_smoke',
    document: {
      source: 'mcp-smoke',
      createdAt: new Date().toISOString(),
      note: 'connectivity check',
    },
  });
  const deleted = await deleteOne({
    collection: '_mcp_smoke',
    filter: { _id: inserted.insertedId },
  });

  console.log(
    JSON.stringify(
      {
        ok: health.ok,
        defaultDb: getDefaultDbName(),
        collections: listed.collections,
        insertedId: inserted.insertedId,
        deletedCount: deleted.deletedCount,
      },
      null,
      2,
    ),
  );

  await closeMongo();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
