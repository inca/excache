import assert from 'assert';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

import { FsCache } from '../main/fs.js';

describe('FsCache', () => {

    const tmpDir = os.tmpdir();
    const cacheDir = path.join(tmpDir, 'cache');

    describe('LRU cache', () => {

        let cache: FsCache<string>;

        beforeEach(async () => {
            await fs.rm(cacheDir, { force: true, recursive: true });
            cache = new FsCache<string>({
                dir: cacheDir,
                maxSize: 3,
                toString: value => value,
                fromString: value => value,
            });
            await cache.set('foo', 'Hello World');
            await new Promise(r => setTimeout(r, 1));
            await cache.set('bar', 'KTHXBYE');
        });

        it('returns undefined on miss', async () => {
            const value = await cache.get('baz');
            assert.strictEqual(value, undefined);
        });

        it('returns value on hit', async () => {
            const value = await cache.get('foo');
            assert.strictEqual(value, 'Hello World');
        });

        it('evicts least recently modified value', async () => {
            // foo is in the cache the longest, evicted
            await cache.set('baz', '42');
            await cache.set('qux', '123');
            const files = await fs.readdir(cacheDir);
            assert.deepStrictEqual(files.sort(), ['bar', 'baz', 'qux']);
            assert.strictEqual(await cache.get('foo'), undefined);
            assert.strictEqual(await cache.get('bar'), 'KTHXBYE');
            assert.strictEqual(await cache.get('baz'), '42');
            assert.strictEqual(await cache.get('qux'), '123');
        });

        it('preserves last accessed value', async () => {
            await cache.get('foo');
            // Now foo stays, bar is evicted
            await cache.set('baz', '42');
            await cache.set('qux', '123');
            const files = await fs.readdir(cacheDir);
            assert.deepStrictEqual(files.sort(), ['baz', 'foo', 'qux']);
            assert.strictEqual(await cache.get('foo'), 'Hello World');
            assert.strictEqual(await cache.get('bar'), undefined);
            assert.strictEqual(await cache.get('baz'), '42');
            assert.strictEqual(await cache.get('qux'), '123');
        });

    });

    describe('TTL cache', () => {

        const TTL = 10;
        let cache: FsCache<string>;

        beforeEach(async () => {
            await fs.rm(cacheDir, { force: true, recursive: true });
            cache = new FsCache<string>({
                dir: cacheDir,
                ttl: TTL,
                toString: value => value,
                fromString: value => value,
            });
            await cache.set('foo', 'Hello World');
            await cache.set('bar', 'KTHXBYE');
        });

        it('returns undefined on miss', async () => {
            const value = await cache.get('baz');
            assert.strictEqual(value, undefined);
        });

        it('returns value on hit', async () => {
            const value = await cache.get('foo');
            assert.strictEqual(value, 'Hello World');
        });

        it('evicts stale values', async () => {
            await new Promise(r => setTimeout(r, TTL + 1));
            await cache.set('baz', '42');
            await cache.set('qux', '123');
            const files = await fs.readdir(cacheDir);
            assert.deepStrictEqual(files.sort(), ['baz', 'qux']);
            assert.strictEqual(await cache.get('foo'), undefined);
            assert.strictEqual(await cache.get('bar'), undefined);
            assert.strictEqual(await cache.get('baz'), '42');
            assert.strictEqual(await cache.get('qux'), '123');
        });

    });


});
