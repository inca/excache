import { hrtime } from 'node:process';

import { Cache, CacheOptions } from './types.js';

interface CacheRecord<T> { value: T; mtime: bigint; atime: bigint }

export class MemoryCache<T> implements Cache<T> {

    protected map = new Map<string, CacheRecord<T>>();

    constructor(readonly options: CacheOptions) {}

    async get(key: string) {
        const record = this.map.get(key);
        if (!record) {
            return undefined;
        }
        if (this.options.ttl) {
            const stale = (record.mtime + BigInt(this.options.ttl * 1000000)) < hrtime.bigint();
            if (stale) {
                this.map.delete(key);
                return undefined;
            }
        }
        record.atime = hrtime.bigint();
        return record.value;
    }

    async set(key: string, value: T) {
        const now = hrtime.bigint();
        this.map.set(key, {
            value,
            mtime: now,
            atime: now,
        });
        this.sweep();
    }

    async delete(key: string) {
        this.map.delete(key);
    }

    async deleteAll() {
        this.map.clear();
    }

    protected sweep() {
        const { maxSize, ttl } = this.options;
        if (!maxSize && !ttl) {
            return;
        }
        if (ttl) {
            const toRemove = new Set<string>();
            for (const [key, record] of this.map) {
                const stale = (record.mtime + BigInt(ttl * 1000000)) < hrtime.bigint();
                if (stale) {
                    toRemove.add(key);
                }
            }
            for (const key of toRemove) {
                this.map.delete(key);
            }
        }
        if (maxSize) {
            const entries = [...this.map.entries()].sort((a, b) => b[1].atime > a[1].atime ? 1 : -1);
            const excess = entries.slice(maxSize);
            for (const [key] of excess) {
                this.map.delete(key);
            }
        }
    }

}
