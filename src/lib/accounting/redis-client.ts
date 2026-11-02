import "server-only";

import { Redis } from "@upstash/redis";
import { getAccountingConfig } from "./config";

/**
 * Common minimal interface needed for persistent accounting and rate limiting.
 */
export interface AccountingRedis {
  eval<T = unknown>(
    script: string,
    keys: string[],
    args: (string | number)[]
  ): Promise<T>;
  get<T = unknown>(key: string): Promise<T | null>;
  set(
    key: string,
    value: unknown,
    options?: { ex?: number; nx?: boolean }
  ): Promise<string | null>;
  del(...keys: string[]): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  hget<T = unknown>(key: string, field: string): Promise<T | null>;
  hset(key: string, kv: Record<string, unknown>): Promise<number>;
  hincrby(key: string, field: string, increment: number): Promise<number>;
  zadd(
    key: string,
    ...scoreMembers: (string | number | { score: number; member: string })[]
  ): Promise<number>;
  zcard(key: string): Promise<number>;
  zremrangebyscore(
    key: string,
    min: number | string,
    max: number | string
  ): Promise<number>;
  zrange(
    key: string,
    min: number,
    max: number,
    options?: { withScores?: boolean }
  ): Promise<unknown[]>;
}

/**
 * In-memory Redis simulator used strictly for automated tests and isolated test environments.
 * Implements deterministic sliding window and atomic budget reservation logic matching Upstash Lua scripts.
 */
export class InMemoryAccountingRedis implements AccountingRedis {
  private kv = new Map<string, { value: unknown; expiresAt?: number }>();
  private hashes = new Map<
    string,
    { fields: Map<string, unknown>; expiresAt?: number }
  >();
  private sortedSets = new Map<
    string,
    { members: Array<{ score: number; member: string }>; expiresAt?: number }
  >();

  private isExpired(entry?: { expiresAt?: number }): boolean {
    if (!entry || !entry.expiresAt) return false;
    return Date.now() > entry.expiresAt;
  }

  private cleanKey(key: string) {
    const kEntry = this.kv.get(key);
    if (kEntry && this.isExpired(kEntry)) this.kv.delete(key);

    const hEntry = this.hashes.get(key);
    if (hEntry && this.isExpired(hEntry)) this.hashes.delete(key);

    const zEntry = this.sortedSets.get(key);
    if (zEntry && this.isExpired(zEntry)) this.sortedSets.delete(key);
  }

  public async get<T = unknown>(key: string): Promise<T | null> {
    this.cleanKey(key);
    const entry = this.kv.get(key);
    if (!entry) return null;
    return entry.value as T;
  }

  public async set(
    key: string,
    value: unknown,
    options?: { ex?: number; nx?: boolean }
  ): Promise<string | null> {
    this.cleanKey(key);
    if (options?.nx && this.kv.has(key)) {
      return null;
    }
    const expiresAt = options?.ex ? Date.now() + options.ex * 1000 : undefined;
    this.kv.set(key, { value, expiresAt });
    return "OK";
  }

  public async del(...keys: string[]): Promise<number> {
    let deleted = 0;
    for (const k of keys) {
      if (this.kv.delete(k)) deleted++;
      if (this.hashes.delete(k)) deleted++;
      if (this.sortedSets.delete(k)) deleted++;
    }
    return deleted;
  }

  public async expire(key: string, seconds: number): Promise<number> {
    const exp = Date.now() + seconds * 1000;
    let found = false;
    const kv = this.kv.get(key);
    if (kv) {
      kv.expiresAt = exp;
      found = true;
    }
    const h = this.hashes.get(key);
    if (h) {
      h.expiresAt = exp;
      found = true;
    }
    const z = this.sortedSets.get(key);
    if (z) {
      z.expiresAt = exp;
      found = true;
    }
    return found ? 1 : 0;
  }

  public async hget<T = unknown>(
    key: string,
    field: string
  ): Promise<T | null> {
    this.cleanKey(key);
    const h = this.hashes.get(key);
    if (!h) return null;
    const val = h.fields.get(field);
    return (val !== undefined ? val : null) as T | null;
  }

  public async hset(key: string, kv: Record<string, unknown>): Promise<number> {
    this.cleanKey(key);
    let h = this.hashes.get(key);
    if (!h) {
      h = { fields: new Map() };
      this.hashes.set(key, h);
    }
    let count = 0;
    for (const [f, v] of Object.entries(kv)) {
      if (!h.fields.has(f)) count++;
      h.fields.set(f, v);
    }
    return count;
  }

  public async hincrby(
    key: string,
    field: string,
    increment: number
  ): Promise<number> {
    this.cleanKey(key);
    let h = this.hashes.get(key);
    if (!h) {
      h = { fields: new Map() };
      this.hashes.set(key, h);
    }
    const cur = Number(h.fields.get(field) || 0);
    const updated = cur + increment;
    h.fields.set(field, updated);
    return updated;
  }

  public async zadd(
    key: string,
    ...scoreMembers: (string | number | { score: number; member: string })[]
  ): Promise<number> {
    this.cleanKey(key);
    let z = this.sortedSets.get(key);
    if (!z) {
      z = { members: [] };
      this.sortedSets.set(key, z);
    }
    let added = 0;
    let i = 0;
    while (i < scoreMembers.length) {
      const item = scoreMembers[i];
      if (
        item &&
        typeof item === "object" &&
        "score" in item &&
        "member" in item
      ) {
        const score = Number(item.score);
        const member = String(item.member);
        const idx = z.members.findIndex((m) => m.member === member);
        if (idx >= 0) {
          z.members[idx]!.score = score;
        } else {
          z.members.push({ score, member });
          added++;
        }
        i += 1;
      } else {
        const score = Number(scoreMembers[i]);
        const member = String(scoreMembers[i + 1]);
        const idx = z.members.findIndex((m) => m.member === member);
        if (idx >= 0) {
          z.members[idx]!.score = score;
        } else {
          z.members.push({ score, member });
          added++;
        }
        i += 2;
      }
    }
    z.members.sort((a, b) => a.score - b.score);
    return added;
  }

  public async zcard(key: string): Promise<number> {
    this.cleanKey(key);
    const z = this.sortedSets.get(key);
    return z ? z.members.length : 0;
  }

  public async zremrangebyscore(
    key: string,
    min: number | string,
    max: number | string
  ): Promise<number> {
    this.cleanKey(key);
    const z = this.sortedSets.get(key);
    if (!z) return 0;
    const minNum = min === "-inf" ? -Infinity : Number(min);
    const maxNum = max === "+inf" ? Infinity : Number(max);
    const initial = z.members.length;
    z.members = z.members.filter((m) => m.score < minNum || m.score > maxNum);
    return initial - z.members.length;
  }

  public async zrange(
    key: string,
    start: number,
    stop: number,
    options?: { withScores?: boolean }
  ): Promise<unknown[]> {
    this.cleanKey(key);
    const z = this.sortedSets.get(key);
    if (!z || z.members.length === 0) return [];

    const len = z.members.length;
    let s = start < 0 ? Math.max(0, len + start) : Math.min(start, len);
    let e = stop < 0 ? Math.max(0, len + stop) : Math.min(stop, len - 1);
    if (s > e) return [];

    const slice = z.members.slice(s, e + 1);
    if (options?.withScores) {
      const flat: unknown[] = [];
      for (const m of slice) {
        flat.push(m.member, m.score);
      }
      return flat;
    }
    return slice.map((m) => m.member);
  }

  /**
   * Executes deterministic TypeScript implementations of our production Lua scripts
   * for reliable in-memory testing without a live Redis server.
   */
  public async eval<T = unknown>(
    script: string,
    keys: string[],
    args: (string | number)[]
  ): Promise<T> {
    // 1. Sliding Window Rate Limiting script
    if (script.includes("ZREMRANGEBYSCORE")) {
      const key = keys[0]!;
      const maxRequests = Number(args[0]);
      const windowSeconds = Number(args[1]);
      const now = Number(args[2]);
      const clearBefore = now - windowSeconds * 1000;

      await this.zremrangebyscore(key, 0, clearBefore);
      const currentCount = await this.zcard(key);

      if (currentCount < maxRequests) {
        await this.zadd(key, now, `${now}:${currentCount + 1}`);
        await this.expire(key, windowSeconds);
        return [1, maxRequests - currentCount - 1, 0] as T;
      } else {
        const oldest = await this.zrange(key, 0, 0, { withScores: true });
        let retryAfter = 1;
        if (oldest.length >= 2) {
          const oldestScore = Number(oldest[1]);
          retryAfter = Math.ceil(
            (oldestScore + windowSeconds * 1000 - now) / 1000
          );
          if (retryAfter < 1) retryAfter = 1;
        }
        return [0, 0, retryAfter] as T;
      }
    }

    // 2. Budget Reservation Script
    if (script.includes("operations_count")) {
      const budgetKey = keys[0]!;
      const resvKey = keys[1]!;
      const estimated = Number(args[0]);
      const maxBudget = Number(args[1]);
      const ttl = Number(args[2]);
      const payload = String(args[3]);

      const confirmed = Number(
        (await this.hget(budgetKey, "confirmed_cost_micros")) || 0
      );
      const reserved = Number(
        (await this.hget(budgetKey, "reserved_cost_micros")) || 0
      );

      if (confirmed + reserved + estimated > maxBudget) {
        let remaining = maxBudget - (confirmed + reserved);
        if (remaining < 0) remaining = 0;
        return [0, remaining] as T;
      }

      await this.hincrby(budgetKey, "reserved_cost_micros", estimated);
      await this.hincrby(budgetKey, "operations_count", 1);
      await this.expire(budgetKey, 86400 * 3);
      await this.set(resvKey, payload, { ex: ttl });

      const newRemaining = maxBudget - (confirmed + reserved + estimated);
      return [1, newRemaining] as T;
    }

    // 3. Budget Settlement Script
    if (script.includes("already_settled")) {
      const budgetKey = keys[0]!;
      const resvKey = keys[1]!;
      const actualCostMicros = Number(args[0]);
      const status = String(args[1]);

      const rawResv = await this.get<string>(resvKey);
      if (!rawResv) {
        return [0, "reservation_not_found"] as T;
      }

      let parsed: {
        estimatedCostMicros: number;
        settled?: boolean;
      };
      try {
        parsed = JSON.parse(rawResv);
      } catch {
        return [0, "invalid_reservation_format"] as T;
      }

      if (parsed.settled) {
        return [1, "already_settled"] as T;
      }

      const estimated = parsed.estimatedCostMicros;
      await this.hincrby(budgetKey, "reserved_cost_micros", -estimated);
      await this.hincrby(budgetKey, "confirmed_cost_micros", actualCostMicros);

      parsed.settled = true;
      await this.set(
        resvKey,
        JSON.stringify({ ...parsed, status, actualCostMicros }),
        { ex: 300 }
      );

      return [1, "settled"] as T;
    }

    throw new Error("Unsupported Lua script in InMemoryAccountingRedis");
  }

  public clearAll() {
    this.kv.clear();
    this.hashes.clear();
    this.sortedSets.clear();
  }
}

// Module-level test override
let testRedisInstance: AccountingRedis | null = null;
let testRedisDisabled = false;

export function setTestRedisInstance(instance: AccountingRedis | null) {
  testRedisInstance = instance;
  testRedisDisabled = false;
}

export function setTestRedisDisabled(disabled: boolean) {
  testRedisDisabled = disabled;
  if (disabled) {
    testRedisInstance = null;
  }
}

export function isRedisConfigured(): boolean {
  if (testRedisDisabled) return false;
  if (testRedisInstance) return true;
  const config = getAccountingConfig();
  return Boolean(
    config.redisRestUrl &&
    config.redisRestUrl.startsWith("https://") &&
    config.redisRestToken &&
    config.redisRestToken.length > 5
  );
}

/**
 * Returns the singleton Redis client for accounting operations.
 * If credentials are not configured in production, returns null (enforcing fail-closed).
 */
export function getAccountingRedis(): AccountingRedis | null {
  if (testRedisDisabled) {
    return null;
  }

  if (testRedisInstance) {
    return testRedisInstance;
  }

  const config = getAccountingConfig();
  if (!config.redisRestUrl || !config.redisRestToken) {
    // In test environment, provide an in-memory instance so tests run without live network
    if (process.env.NODE_ENV === "test") {
      testRedisInstance = new InMemoryAccountingRedis();
      return testRedisInstance;
    }
    return null;
  }

  try {
    return new Redis({
      url: config.redisRestUrl,
      token: config.redisRestToken,
    }) as unknown as AccountingRedis;
  } catch {
    return null;
  }
}
