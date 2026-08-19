import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

import { jsonResult, toolError } from '../types.js';
import * as excel from './domain.js';

function parseValues(raw: string, label: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON for ${label}`);
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return value as Record<string, unknown>;
}

/** Agent 2 — Excel workbook CRUD tools + prompts. */
export function registerExcelAgent(server: McpServer): void {
  const sheetSchema = z.string().describe('Worksheet/tab name');

  server.registerTool(
    'excel_info',
    {
      title: 'Excel info',
      description: 'Show the configured Excel file path and sheets.',
      annotations: { readOnlyHint: true },
    },
    async () => {
      try {
        return jsonResult(await excel.getInfo());
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'excel_list_sheets',
    {
      title: 'List sheets',
      description: 'List worksheet names in the Excel file.',
      annotations: { readOnlyHint: true },
    },
    async () => {
      try {
        return jsonResult(await excel.listSheets());
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'excel_add_sheet',
    {
      title: 'Add sheet',
      description: 'Create a new worksheet, optionally with header columns.',
      inputSchema: z.object({
        name: sheetSchema,
        headers: z.array(z.string()).optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ name, headers }) => {
      try {
        return jsonResult(await excel.addSheet({ name, headers }));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'excel_read_rows',
    {
      title: 'Read rows',
      description: 'Read data rows from a sheet. Row 1 is headers.',
      inputSchema: z.object({
        sheet: sheetSchema,
        limit: z.number().int().min(1).max(1000).default(100),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ sheet, limit }) => {
      try {
        return jsonResult(await excel.readRows({ sheet, limit }));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'excel_add_row',
    {
      title: 'Add row',
      description: 'Append a row. values is JSON keyed by column header.',
      inputSchema: z.object({
        sheet: sheetSchema,
        values: z.string(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ sheet, values }) => {
      try {
        return jsonResult(await excel.addRow({ sheet, values: parseValues(values, 'values') }));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'excel_update_row',
    {
      title: 'Update row',
      description: 'Update cells in a row (row number >= 2).',
      inputSchema: z.object({
        sheet: sheetSchema,
        row: z.number().int().min(2),
        values: z.string(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ sheet, row, values }) => {
      try {
        return jsonResult(
          await excel.updateRow({ sheet, row, values: parseValues(values, 'values') }),
        );
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'excel_delete_row',
    {
      title: 'Delete row',
      description: 'Delete a row by sheet row number (>= 2).',
      inputSchema: z.object({
        sheet: sheetSchema,
        row: z.number().int().min(2),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ sheet, row }) => {
      try {
        return jsonResult(await excel.deleteRow({ sheet, row }));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'excel_add_column',
    {
      title: 'Add column',
      description: 'Add a column header to a sheet.',
      inputSchema: z.object({
        sheet: sheetSchema,
        name: z.string(),
        defaultValue: z.string().optional(),
        position: z.number().int().min(1).optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ sheet, name, defaultValue, position }) => {
      try {
        return jsonResult(await excel.addColumn({ sheet, name, defaultValue, position }));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'excel_remove_column',
    {
      title: 'Remove column',
      description: 'Remove a column by header name.',
      inputSchema: z.object({
        sheet: sheetSchema,
        name: z.string(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ sheet, name }) => {
      try {
        return jsonResult(await excel.removeColumn({ sheet, name }));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'excel_rename_column',
    {
      title: 'Rename column',
      description: 'Rename a column header.',
      inputSchema: z.object({
        sheet: sheetSchema,
        from: z.string(),
        to: z.string(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ sheet, from, to }) => {
      try {
        return jsonResult(await excel.renameColumn({ sheet, from, to }));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerPrompt(
    'excel_edit_data',
    {
      title: 'Edit Excel data',
      description: 'Prompt template to edit Excel via excel_* tools',
      argsSchema: z.object({
        sheet: z.string(),
        instruction: z.string(),
      }),
    },
    ({ sheet, instruction }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Edit Excel sheet "${sheet}".\nInstruction: ${instruction}\nUse excel_* tools. Report what changed.`,
          },
        },
      ],
    }),
  );
}
