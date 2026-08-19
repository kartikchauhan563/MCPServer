import 'dotenv/config';

// Prefer `npm start` (tsx src/http/listen.ts) on Render.
// This file is a thin alias for local `node --import tsx src/index.ts`.
await import('./http/listen.ts');
