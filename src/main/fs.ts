import { promises as fs } from 'fs';
import path from 'path';

import { Cache, CacheOptions } from './types.js';

export interface FsCacheOptions<T> extends CacheOptions {
    dir: string;
    toString: (value: T) => string;
    fromString: (value: string) => T;
}

export class FsCache<T> implements Cache<T> {

    protected initPromise: any = null;

    constructor(
        readonly options: FsCacheOptions<T>,
    ) {}

    async get(key: string): Promise<T | undefined> {
        const file = this.getFile(key);
        try {
            const stat = await fs.stat(file);
            if (this.options.ttl) {
                const stale = (stat.mtimeMs + this.options.ttl) < Date.now();
                if (stale) {
                    await fs.rm(file);
                    return undefined;
                }
            }
            const text = await fs.readFile(file, 'utf-8');
            return this.options.fromString(text);
        } catch (err: any) {
            if (err.code === 'ENOENT') {
                return undefined;
            }
            throw err;
        }
    }

    async set(key: string, value: T) {
        await this.init();
        const file = this.getFile(key);
        const serialized = this.options.toString(value);
        await fs.writeFile(file, serialized, 'utf-8');
        await this.sweep();
    }

    async delete(key: string) {
        const file = this.getFile(key);
        await fs.rm(file);
    }

    async deleteAll() {
        await fs.rm(this.options.dir, { force: true, recursive: true });
        this.initPromise = null;
    }

    protected init() {
        if (!this.initPromise) {
            this.initPromise = (async () => {
                await fs.mkdir(this.options.dir, { recursive: true });
            })();
        }
        return this.initPromise;
    }

    protected async sweep() {
        const { maxSize, ttl } = this.options;
        if (!maxSize && !ttl) {
            return;
        }
        const vfiles = await fs.readdir(this.options.dir);
        const promises = vfiles.map(async _ => {
            const file = path.join(this.options.dir, _);
            const stat = await fs.stat(file);
            return { file, stat };
        });
        const toRemove = new Set<string>;
        const stats = await Promise.all(promises);
        if (ttl) {
            for (const { file, stat } of stats) {
                const stale = (stat.mtimeMs + ttl) < Date.now();
                if (stale) {
                    toRemove.add(file);
                }
            }
        }
        if (maxSize) {
            const excess = stats
                .filter(_ => !toRemove.has(_.file))
                .sort((a, b) => b.stat.atimeMs > a.stat.atimeMs ? 1 : -1)
                .slice(maxSize);
            for (const { file } of excess) {
                toRemove.add(file);
            }
        }
        for (const f of toRemove) {
            await fs.rm(f, { force: true });
        }
    }

    protected getFile(key: string) {
        return path.join(this.options.dir, key);
    }

}
