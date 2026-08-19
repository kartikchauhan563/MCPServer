import fs from 'node:fs';
import path from 'node:path';

import ExcelJS from 'exceljs';

/**
 * Shared Excel (.xlsx) domain layer.
 *
 * Model: row 1 of each sheet is the header row. Data rows start at row 2.
 * All operations load the file, mutate, and save — serialized through a
 * simple in-process queue so concurrent tool calls don't corrupt the file.
 */

export function getWorkbookPath(): string {
  const configured = process.env.EXCEL_FILE?.trim();
  const rel = configured || path.join('data', 'workbook.xlsx');
  return path.isAbsolute(rel) ? rel : path.resolve(process.cwd(), rel);
}

let queue: Promise<unknown> = Promise.resolve();

function serialize<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

async function loadWorkbook(): Promise<ExcelJS.Workbook> {
  const filePath = getWorkbookPath();
  const wb = new ExcelJS.Workbook();
  if (fs.existsSync(filePath)) {
    await wb.xlsx.readFile(filePath);
  }
  return wb;
}

async function saveWorkbook(wb: ExcelJS.Workbook): Promise<void> {
  const filePath = getWorkbookPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  await wb.xlsx.writeFile(filePath);
}

function requireSheet(wb: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const sheet = wb.getWorksheet(name);
  if (!sheet) {
    const available = wb.worksheets.map((w) => w.name).join(', ') || '(none)';
    throw new Error(`Sheet "${name}" not found. Available: ${available}`);
  }
  return sheet;
}

function readHeaders(sheet: ExcelJS.Worksheet): string[] {
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col - 1] = cellToString(cell.value);
  });
  return headers.map((h) => (h ?? '').toString());
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') return value.text;
    if ('result' in value) return String((value as { result: unknown }).result ?? '');
    if ('richText' in value && Array.isArray((value as ExcelJS.CellRichTextValue).richText)) {
      return (value as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join('');
    }
  }
  return String(value);
}

function cellToPlain(value: ExcelJS.CellValue): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return cellToString(value);
  return value;
}

export async function getInfo() {
  return serialize(async () => {
    const filePath = getWorkbookPath();
    const exists = fs.existsSync(filePath);
    const wb = await loadWorkbook();
    return {
      file: filePath,
      exists,
      sheets: wb.worksheets.map((w) => ({
        name: w.name,
        rows: w.actualRowCount,
        columns: w.actualColumnCount,
      })),
    };
  });
}

export async function listSheets() {
  return serialize(async () => {
    const wb = await loadWorkbook();
    return { sheets: wb.worksheets.map((w) => w.name) };
  });
}

export async function addSheet(options: { name: string; headers?: string[] }) {
  return serialize(async () => {
    const wb = await loadWorkbook();
    if (wb.getWorksheet(options.name)) {
      throw new Error(`Sheet "${options.name}" already exists`);
    }
    const sheet = wb.addWorksheet(options.name);
    if (options.headers && options.headers.length > 0) {
      const headerRow = sheet.getRow(1);
      options.headers.forEach((header, i) => {
        headerRow.getCell(i + 1).value = header;
      });
      headerRow.commit();
    }
    await saveWorkbook(wb);
    return { sheet: options.name, headers: options.headers ?? [] };
  });
}

export async function readRows(options: { sheet: string; limit?: number }) {
  return serialize(async () => {
    const wb = await loadWorkbook();
    const sheet = requireSheet(wb, options.sheet);
    const headers = readHeaders(sheet);
    const limit = options.limit ?? 100;
    const rows: Array<{ row: number; data: Record<string, unknown> }> = [];

    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      if (rows.length >= limit) return;
      const data: Record<string, unknown> = {};
      headers.forEach((header, i) => {
        if (!header) return;
        data[header] = cellToPlain(row.getCell(i + 1).value);
      });
      rows.push({ row: rowNumber, data });
    });

    return {
      sheet: options.sheet,
      headers: headers.filter(Boolean),
      count: rows.length,
      rows,
    };
  });
}

export async function addRow(options: {
  sheet: string;
  values: Record<string, unknown>;
}) {
  return serialize(async () => {
    const wb = await loadWorkbook();
    const sheet = requireSheet(wb, options.sheet);
    let headers = readHeaders(sheet).filter(Boolean);

    if (headers.length === 0) {
      headers = Object.keys(options.values);
      const headerRow = sheet.getRow(1);
      headers.forEach((header, i) => {
        headerRow.getCell(i + 1).value = header;
      });
      headerRow.commit();
    } else {
      for (const key of Object.keys(options.values)) {
        if (!headers.includes(key)) {
          headers.push(key);
          sheet.getRow(1).getCell(headers.length).value = key;
        }
      }
      sheet.getRow(1).commit();
    }

    const newRowNumber = Math.max(sheet.actualRowCount, 1) + 1;
    const target = sheet.getRow(newRowNumber);
    headers.forEach((header, i) => {
      target.getCell(i + 1).value = (options.values[header] ?? null) as ExcelJS.CellValue;
    });
    target.commit();
    await saveWorkbook(wb);
    return { sheet: options.sheet, row: newRowNumber, headers };
  });
}

export async function updateRow(options: {
  sheet: string;
  row: number;
  values: Record<string, unknown>;
}) {
  return serialize(async () => {
    if (options.row <= 1) throw new Error('row must be >= 2 (row 1 is the header)');
    const wb = await loadWorkbook();
    const sheet = requireSheet(wb, options.sheet);
    const headers = readHeaders(sheet);
    const target = sheet.getRow(options.row);

    for (const [key, value] of Object.entries(options.values)) {
      let col = headers.indexOf(key);
      if (col === -1) {
        headers.push(key);
        col = headers.length - 1;
        sheet.getRow(1).getCell(col + 1).value = key;
      }
      target.getCell(col + 1).value = (value ?? null) as ExcelJS.CellValue;
    }
    sheet.getRow(1).commit();
    target.commit();
    await saveWorkbook(wb);
    return { sheet: options.sheet, row: options.row, updated: Object.keys(options.values) };
  });
}

export async function deleteRow(options: { sheet: string; row: number }) {
  return serialize(async () => {
    if (options.row <= 1) throw new Error('row must be >= 2 (row 1 is the header)');
    const wb = await loadWorkbook();
    const sheet = requireSheet(wb, options.sheet);
    sheet.spliceRows(options.row, 1);
    await saveWorkbook(wb);
    return { sheet: options.sheet, deletedRow: options.row };
  });
}

export async function addColumn(options: {
  sheet: string;
  name: string;
  defaultValue?: unknown;
  position?: number;
}) {
  return serialize(async () => {
    const wb = await loadWorkbook();
    const sheet = requireSheet(wb, options.sheet);
    const headers = readHeaders(sheet);
    if (headers.includes(options.name)) {
      throw new Error(`Column "${options.name}" already exists`);
    }

    const insertAt = options.position && options.position >= 1 ? options.position : headers.length + 1;
    const columnData: ExcelJS.CellValue[] = [options.name];
    const lastRow = sheet.actualRowCount;
    for (let r = 2; r <= lastRow; r++) {
      columnData.push((options.defaultValue ?? null) as ExcelJS.CellValue);
    }
    sheet.spliceColumns(insertAt, 0, columnData);
    await saveWorkbook(wb);
    return { sheet: options.sheet, column: options.name, position: insertAt };
  });
}

export async function removeColumn(options: { sheet: string; name: string }) {
  return serialize(async () => {
    const wb = await loadWorkbook();
    const sheet = requireSheet(wb, options.sheet);
    const headers = readHeaders(sheet);
    const index = headers.indexOf(options.name);
    if (index === -1) {
      throw new Error(
        `Column "${options.name}" not found. Available: ${headers.filter(Boolean).join(', ') || '(none)'}`,
      );
    }
    sheet.spliceColumns(index + 1, 1);
    await saveWorkbook(wb);
    return { sheet: options.sheet, removedColumn: options.name };
  });
}

export async function renameColumn(options: {
  sheet: string;
  from: string;
  to: string;
}) {
  return serialize(async () => {
    const wb = await loadWorkbook();
    const sheet = requireSheet(wb, options.sheet);
    const headers = readHeaders(sheet);
    const index = headers.indexOf(options.from);
    if (index === -1) throw new Error(`Column "${options.from}" not found`);
    sheet.getRow(1).getCell(index + 1).value = options.to;
    sheet.getRow(1).commit();
    await saveWorkbook(wb);
    return { sheet: options.sheet, from: options.from, to: options.to };
  });
}
