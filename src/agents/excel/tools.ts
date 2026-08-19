import { num, obj, objectSchema, str, type AgentTool } from '../toolHelpers.js';
import * as excel from './domain.js';

export const excelAgentTools: AgentTool[] = [
  {
    name: 'excel_list_sheets',
    description: 'List worksheet names in the Excel workbook.',
    parameters: { type: 'object', properties: {}, required: [] },
    run: async () => excel.listSheets(),
  },
  {
    name: 'excel_add_sheet',
    description: 'Create a new Excel worksheet, optionally with headers.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        headers: { type: 'array', items: { type: 'string' } },
      },
      required: ['name'],
    },
    run: async (args) =>
      excel.addSheet({
        name: str(args, 'name'),
        headers: Array.isArray(args.headers) ? (args.headers as string[]) : undefined,
      }),
  },
  {
    name: 'excel_read_rows',
    description: 'Read data rows from an Excel sheet.',
    parameters: {
      type: 'object',
      properties: { sheet: { type: 'string' }, limit: { type: 'integer' } },
      required: ['sheet'],
    },
    run: async (args) =>
      excel.readRows({ sheet: str(args, 'sheet'), limit: num(args, 'limit', 50) }),
  },
  {
    name: 'excel_add_row',
    description: 'Append a row. values is keyed by column header.',
    parameters: {
      type: 'object',
      properties: { sheet: { type: 'string' }, values: objectSchema },
      required: ['sheet', 'values'],
    },
    run: async (args) =>
      excel.addRow({ sheet: str(args, 'sheet'), values: obj(args, 'values') }),
  },
  {
    name: 'excel_update_row',
    description: 'Update cells in an Excel row (row >= 2).',
    parameters: {
      type: 'object',
      properties: {
        sheet: { type: 'string' },
        row: { type: 'integer', minimum: 2 },
        values: objectSchema,
      },
      required: ['sheet', 'row', 'values'],
    },
    run: async (args) =>
      excel.updateRow({
        sheet: str(args, 'sheet'),
        row: num(args, 'row'),
        values: obj(args, 'values'),
      }),
  },
  {
    name: 'excel_delete_row',
    description: 'Delete an Excel row by sheet row number (>= 2).',
    parameters: {
      type: 'object',
      properties: { sheet: { type: 'string' }, row: { type: 'integer', minimum: 2 } },
      required: ['sheet', 'row'],
    },
    run: async (args) =>
      excel.deleteRow({ sheet: str(args, 'sheet'), row: num(args, 'row') }),
  },
  {
    name: 'excel_add_column',
    description: 'Add a column header to an Excel sheet.',
    parameters: {
      type: 'object',
      properties: {
        sheet: { type: 'string' },
        name: { type: 'string' },
        defaultValue: { type: 'string' },
      },
      required: ['sheet', 'name'],
    },
    run: async (args) =>
      excel.addColumn({
        sheet: str(args, 'sheet'),
        name: str(args, 'name'),
        defaultValue: str(args, 'defaultValue', false) || undefined,
      }),
  },
  {
    name: 'excel_remove_column',
    description: 'Remove a column by header name.',
    parameters: {
      type: 'object',
      properties: { sheet: { type: 'string' }, name: { type: 'string' } },
      required: ['sheet', 'name'],
    },
    run: async (args) =>
      excel.removeColumn({ sheet: str(args, 'sheet'), name: str(args, 'name') }),
  },
  {
    name: 'excel_rename_column',
    description: 'Rename an Excel column header.',
    parameters: {
      type: 'object',
      properties: {
        sheet: { type: 'string' },
        from: { type: 'string' },
        to: { type: 'string' },
      },
      required: ['sheet', 'from', 'to'],
    },
    run: async (args) =>
      excel.renameColumn({
        sheet: str(args, 'sheet'),
        from: str(args, 'from'),
        to: str(args, 'to'),
      }),
  },
];
