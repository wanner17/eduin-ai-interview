import { randomUUID } from "crypto";

interface CacheEntry {
  buffer: Buffer;
  createdAt: number;
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 10 * 60 * 1000;

export function storeAudio(buffer: Buffer): string {
  cleanupExpired();
  const id = randomUUID();
  cache.set(id, { buffer, createdAt: Date.now() });
  return id;
}

export function getAudio(id: string): Buffer | null {
  const entry = cache.get(id);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > TTL_MS) {
    cache.delete(id);
    return null;
  }
  return entry.buffer;
}

export function cleanupExpired(): void {
  const now = Date.now();
  for (const [id, entry] of cache.entries()) {
    if (now - entry.createdAt > TTL_MS) cache.delete(id);
  }
}
