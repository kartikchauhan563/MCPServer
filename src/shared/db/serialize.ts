import { ObjectId, type Document } from 'mongodb';

export function reviveObjectIds(doc: Document): Document {
  const out: Document = { ...doc };
  if (typeof out._id === 'string' && ObjectId.isValid(out._id)) {
    out._id = new ObjectId(out._id);
  }
  return out;
}

export function parseJsonDocument(raw: string, label: string): Document {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON for ${label}`);
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return reviveObjectIds(value as Document);
}

export function parseJsonArray(raw: string, label: string): Document[] {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON for ${label}`);
  }
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be a JSON array of objects`);
  }
  return value.map((item, index) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`${label}[${index}] must be a JSON object`);
    }
    return reviveObjectIds(item as Document);
  });
}

export function toPlain(value: unknown): unknown {
  if (value instanceof ObjectId) return value.toHexString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toPlain);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = toPlain(v);
    }
    return out;
  }
  return value;
}

export function serializeDocs(docs: Document[]): string {
  return JSON.stringify(toPlain(docs), null, 2);
}

export function asDocument(input: unknown, label: string): Document {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error(`${label} must be an object`);
  }
  return reviveObjectIds(input as Document);
}
