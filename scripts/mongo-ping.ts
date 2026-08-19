import 'dotenv/config';

import { closeMongo, getClient, getDefaultDbName } from '../src/shared/db/client.ts';

async function main() {
  const client = await getClient();
  const result = await client.db('admin').command({ ping: 1 });
  console.log(
    JSON.stringify(
      {
        ok: result.ok === 1,
        defaultDb: getDefaultDbName(),
        uriConfigured: Boolean(process.env.MONGODB_URI),
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
