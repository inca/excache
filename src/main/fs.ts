import { promises as fs, Stats } from 'fs';
import path from 'path';

import { Cache, CacheOptions } from './types.js';

export interface FsCacheOptions<T> extends CacheOptions {
    dir: string;
    toBuffer: (value: T) => Buffer;
    fromBuffer: (value: Buffer) => T;
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
            const buffer = await fs.readFile(file);
            return this.options.fromBuffer(buffer);
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
        const buffer = this.options.toBuffer(value);
        await fs.writeFile(file, buffer);
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
        const fileStats = await this.readCachedFiles();
        const toRemove = new Set<string>();
        if (ttl) {
            for (const { file, stat } of fileStats) {
                const stale = (stat.mtimeMs + ttl) < Date.now();
                if (stale) {
                    toRemove.add(file);
                }
            }
        }
        if (maxSize) {
            const excess = fileStats
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

    protected async readCachedFiles(): Promise<Array<{ file: string; stat: Stats }>> {
        const vfiles = await fs.readdir(this.options.dir)
            .catch(err => err.code === 'ENOENT' ? [] : Promise.reject(err));
        const promises = vfiles.map(async _ => {
            const file = path.join(this.options.dir, _);
            try {
                const stat = await fs.stat(file);
                return { file, stat };
            } catch (err: any) {
                if (err.code === 'ENOENT') {
                    return null;
                }
                throw err;
            }
        });
        const res = await Promise.all(promises);
        return res.filter(_ => _ != null);
    }

}
