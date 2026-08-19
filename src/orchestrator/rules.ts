import type { AgentStep } from './llm.js';
import { findTool } from './tools.js';
import * as docs from '../agents/mongo/domain.js';
import * as excel from '../agents/excel/domain.js';

const EXCEL_WORDS = /\b(excel|spreadsheets?|sheets?|tabs?|worksheets?|workbooks?|xlsx|columns?|rows?|cells?)\b/;
const MONGO_WORDS = /\b(mongo|mongodb|databases?|collections?|documents?|records?)\b/;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mentioned(names: string[], text: string): string | undefined {
  return names.find((name) => new RegExp(`\\b${escapeRegex(name)}\\b`, 'i').test(text));
}

async function safeList<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export type RulesOutcome = {
  mode: 'rules';
  reply: string;
  steps: AgentStep[];
};

function coerce(raw: string): unknown {
  const value = raw.trim().replace(/^["']|["']$/g, '');
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if (/^true$/i.test(value)) return true;
  if (/^false$/i.test(value)) return false;
  return value;
}

/** Parse "name Kartik, role admin" / "name: Kartik and role = admin" into an object. */
function extractPairs(text: string): Record<string, unknown> {
  const marker = text.match(/(?::|\bwith\b|\bvalues\b|\bset\b)([\s\S]+)$/i);
  const body = marker ? marker[1] : text;
  const out: Record<string, unknown> = {};

  for (const part of body.split(/,|\band\b/i)) {
    const pair = part.match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*(?:[:=]|\s+(?:to|is)\s+|\s+)\s*(.+?)\s*$/);
    if (!pair) continue;
    const key = pair[1].trim();
    const value = pair[2].trim();
    if (!key || !value) continue;
    if (/^(a|an|the|row|column|in|into|to|from|sheet|collection)$/i.test(key)) continue;
    out[key] = coerce(value);
  }
  return out;
}

function matchFirst(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const found = text.match(pattern);
    if (found?.[1]) return found[1].trim().replace(/^["']|["']$/g, '');
  }
  return undefined;
}

function detectSheet(prompt: string): string | undefined {
  return matchFirst(prompt, [
    /\b(?:sheet|tab|worksheet)\s+["']?([A-Za-z0-9_\-]+)["']?/i,
    /\b["']?([A-Za-z0-9_\-]+)["']?\s+(?:sheet|tab|worksheet)\b/i,
    /\b(?:in|into|on|from)\s+(?:the\s+)?["']?([A-Za-z0-9_\-]+)["']?/i,
  ]);
}

function detectCollection(prompt: string): string | undefined {
  return matchFirst(prompt, [
    /\b(?:collection|table)\s+["']?([A-Za-z0-9_\-]+)["']?/i,
    /\b(?:into|in|from)\s+(?:the\s+)?["']?([A-Za-z0-9_\-]+)["']?\s*(?:collection|table)\b/i,
    /\b(?:all|every)\s+([A-Za-z0-9_\-]+)\b/i,
    /\b(?:into|in|from)\s+([A-Za-z0-9_\-]+)\b/i,
  ]);
}

async function exec(tool: string, args: Record<string, unknown>): Promise<AgentStep> {
  const found = findTool(tool);
  if (!found) return { tool, args, error: `Unknown tool: ${tool}` };
  try {
    return { tool, args, result: await found.run(args) };
  } catch (err) {
    return { tool, args, error: err instanceof Error ? err.message : String(err) };
  }
}

function summarize(step: AgentStep, description: string): string {
  if (step.error) return `Tried to ${description}, but it failed: ${step.error}`;
  return `${description} — result: ${JSON.stringify(step.result)}`;
}

const HELP = [
  'I could not confidently interpret that with the built-in keyword parser.',
  'Set LLM_API_KEY and LLM_MODEL in .env for full natural-language understanding,',
  'or phrase it like: "add a row in Sheet1: name Kartik, role admin",',
  '"add a column called Status in Sheet1", "remove the Notes column in Sheet1",',
  '"show rows in Sheet1", "insert into users: name Kartik, role admin",',
  '"show all users", "how many users", "delete from users where role = temp".',
].join(' ');

export async function runWithRules(prompt: string): Promise<RulesOutcome> {
  const text = prompt.trim();
  const lower = text.toLowerCase();

  const sheetNames = (await safeList(() => excel.listSheets(), { sheets: [] as string[] })).sheets;
  const collectionNames = (
    await safeList(() => docs.listCollections(), { database: '', collections: [] as string[] })
  ).collections;

  const namedSheet = mentioned(sheetNames, text);
  const namedCollection = mentioned(collectionNames, text);
  const excelWords = EXCEL_WORDS.test(lower);
  const mongoWords = MONGO_WORDS.test(lower);

  // Explicit vocabulary wins; otherwise fall back to whichever real name is mentioned.
  const isExcel = mongoWords && !excelWords ? false : excelWords || Boolean(namedSheet && !namedCollection);
  const wantsDelete = /\b(delete|remove|drop)\b/.test(lower);
  const wantsUpdate = /\b(update|change|modify|rename|set)\b/.test(lower);
  const wantsCreate = /\b(add|create|insert|append|new)\b/.test(lower);
  const wantsRead = /\b(show|list|find|get|read|display|count|how many)\b/.test(lower);

  const steps: AgentStep[] = [];

  if (isExcel) {
    const detected = detectSheet(text);
    const sheet =
      namedSheet ??
      (detected && mentioned(sheetNames, detected)) ??
      detected ??
      sheetNames[0];

    if (/\b(list|show)\b.*\bsheets?\b/.test(lower) || /\bsheets?\b.*\blist\b/.test(lower)) {
      const step = await exec('excel_list_sheets', {});
      steps.push(step);
      return { mode: 'rules', reply: summarize(step, 'listed Excel sheets'), steps };
    }

    if (!sheet) {
      return {
        mode: 'rules',
        reply: 'No Excel sheet found. Create one first, e.g. "create sheet People with columns name, role".',
        steps,
      };
    }

    // Column operations
    const columnName = matchFirst(text, [
      /\bcolumn\s+(?:called|named)\s+["']?([A-Za-z0-9_ \-]+?)["']?(?=\s*(?:,|\.|$|with|default))/i,
      /\b(?:the\s+)?["']?([A-Za-z0-9_\-]+)["']?\s+column\b/i,
      /\bcolumn\s+["']?([A-Za-z0-9_\-]+)["']?/i,
    ]);

    if (columnName && wantsDelete) {
      const step = await exec('excel_remove_column', { sheet, name: columnName });
      steps.push(step);
      return {
        mode: 'rules',
        reply: summarize(step, `removed column "${columnName}" from sheet "${sheet}"`),
        steps,
      };
    }

    if (columnName && wantsCreate) {
      const defaultValue = matchFirst(text, [
        /\bdefault(?:ing)?\s*(?:to|=|:)?\s*["']?([A-Za-z0-9_\- ]+?)["']?(?=\s*(?:,|\.|$))/i,
      ]);
      const step = await exec('excel_add_column', { sheet, name: columnName, defaultValue });
      steps.push(step);
      return {
        mode: 'rules',
        reply: summarize(step, `added column "${columnName}" to sheet "${sheet}"`),
        steps,
      };
    }

    // Row operations
    const rowNumber = text.match(/\brow\s+(\d+)/i)?.[1];

    if (rowNumber && wantsDelete) {
      const step = await exec('excel_delete_row', { sheet, row: Number(rowNumber) });
      steps.push(step);
      return {
        mode: 'rules',
        reply: summarize(step, `deleted row ${rowNumber} from sheet "${sheet}"`),
        steps,
      };
    }

    if (rowNumber && wantsUpdate) {
      const values = extractPairs(text);
      if (Object.keys(values).length === 0) {
        return { mode: 'rules', reply: HELP, steps };
      }
      const step = await exec('excel_update_row', { sheet, row: Number(rowNumber), values });
      steps.push(step);
      return {
        mode: 'rules',
        reply: summarize(step, `updated row ${rowNumber} in sheet "${sheet}"`),
        steps,
      };
    }

    if (wantsCreate && /\brow\b/.test(lower)) {
      const values = extractPairs(text);
      if (Object.keys(values).length === 0) {
        return { mode: 'rules', reply: HELP, steps };
      }
      const step = await exec('excel_add_row', { sheet, values });
      steps.push(step);
      return {
        mode: 'rules',
        reply: summarize(step, `added a row to sheet "${sheet}"`),
        steps,
      };
    }

    if (wantsRead) {
      const step = await exec('excel_read_rows', { sheet, limit: 50 });
      steps.push(step);
      return { mode: 'rules', reply: summarize(step, `read rows from sheet "${sheet}"`), steps };
    }

    return { mode: 'rules', reply: HELP, steps };
  }

  // MongoDB branch
  const collection = namedCollection ?? detectCollection(text);
  if (!collection) {
    if (wantsRead) {
      const step = await exec('mongo_list_collections', {});
      steps.push(step);
      return { mode: 'rules', reply: summarize(step, 'listed MongoDB collections'), steps };
    }
    return { mode: 'rules', reply: HELP, steps };
  }

  const filterPairs = (() => {
    const where = text.match(/\bwhere\b([\s\S]+)$/i);
    return where ? extractPairs(where[1]) : {};
  })();

  if (wantsDelete) {
    if (Object.keys(filterPairs).length === 0) {
      return {
        mode: 'rules',
        reply: `Refusing to delete from "${collection}" without a condition. Add e.g. "where status = inactive".`,
        steps,
      };
    }
    const step = await exec('mongo_delete_many', { collection, filter: filterPairs });
    steps.push(step);
    return {
      mode: 'rules',
      reply: summarize(step, `deleted documents from "${collection}"`),
      steps,
    };
  }

  if (wantsUpdate) {
    const setPart = text.match(/\bset\b([\s\S]+?)(?:\bwhere\b|$)/i);
    const values = setPart ? extractPairs(setPart[1]) : {};
    if (Object.keys(values).length === 0 || Object.keys(filterPairs).length === 0) {
      return {
        mode: 'rules',
        reply: `For updates use: "update ${collection} set field = value where field = value".`,
        steps,
      };
    }
    const step = await exec('mongo_update_many', {
      collection,
      filter: filterPairs,
      update: { $set: values },
    });
    steps.push(step);
    return { mode: 'rules', reply: summarize(step, `updated documents in "${collection}"`), steps };
  }

  if (wantsCreate) {
    const values = extractPairs(text);
    if (Object.keys(values).length === 0) {
      return { mode: 'rules', reply: HELP, steps };
    }
    const step = await exec('mongo_insert_one', { collection, document: values });
    steps.push(step);
    return { mode: 'rules', reply: summarize(step, `inserted a document into "${collection}"`), steps };
  }

  if (/\b(count|how many)\b/.test(lower)) {
    const step = await exec('mongo_count', { collection, filter: filterPairs });
    steps.push(step);
    return { mode: 'rules', reply: summarize(step, `counted documents in "${collection}"`), steps };
  }

  if (wantsRead) {
    const step = await exec('mongo_find', { collection, filter: filterPairs, limit: 25 });
    steps.push(step);
    return { mode: 'rules', reply: summarize(step, `read documents from "${collection}"`), steps };
  }

  return { mode: 'rules', reply: HELP, steps };
}
