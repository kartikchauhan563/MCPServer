import 'dotenv/config';

import * as excel from '../src/agents/excel/domain.ts';

async function main() {
  const sheets = (await excel.listSheets()).sheets;
  const sheet = sheets.includes('people') ? 'people' : sheets[0] || 'people';
  const wanted = ['name', 'roll number'];

  if (!sheets.includes(sheet)) {
    await excel.addSheet({ name: sheet, headers: wanted });
    console.log(JSON.stringify({ action: 'created_sheet', sheet, headers: wanted }, null, 2));
    return;
  }

  const before = await excel.readRows({ sheet, limit: 1 });
  const existing = before.headers ?? [];
  const added: string[] = [];

  for (const col of wanted) {
    if (!existing.includes(col)) {
      await excel.addColumn({ sheet, name: col });
      added.push(col);
    }
  }

  const after = await excel.readRows({ sheet, limit: 1 });
  console.log(
    JSON.stringify(
      {
        action: 'ensure_columns',
        sheet,
        before: existing,
        added,
        headers: after.headers,
        file: excel.getWorkbookPath(),
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
