// Minimal interfaces used by this app; no remote database is configured.
interface Fetcher { fetch(request: Request): Promise<Response> }
interface D1Database { prepare(query: string): unknown }
declare module 'cloudflare:workers' { export const env: Record<string, D1Database>; }
