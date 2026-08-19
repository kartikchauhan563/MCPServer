import 'dotenv/config';

import {
  addColumn,
  addRow,
  addSheet,
  deleteRow,
  getInfo,
  getWorkbookPath,
  listSheets,
  readRows,
  removeColumn,
  updateRow,
} from '../src/agents/excel/domain.ts';

async function main() {
  const sheet = 'people';

  const before = await getInfo();
  if (!(await listSheets()).sheets.includes(sheet)) {
    await addSheet({ name: sheet, headers: ['name', 'role'] });
  }

  const added = await addRow({ sheet, values: { name: 'Kartik', role: 'admin' } });
  await addColumn({ sheet, name: 'status', defaultValue: 'active' });
  await updateRow({ sheet, row: added.row, values: { role: 'owner' } });
  const afterUpdate = await readRows({ sheet, limit: 10 });
  await removeColumn({ sheet, name: 'status' });
  await deleteRow({ sheet, row: added.row });
  const afterCleanup = await readRows({ sheet, limit: 10 });

  console.log(
    JSON.stringify(
      {
        file: getWorkbookPath(),
        existedBefore: before.exists,
        addedRow: added.row,
        rowsAfterUpdate: afterUpdate.rows,
        headersAfterRemove: afterCleanup.headers,
        rowsAfterCleanup: afterCleanup.count,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
