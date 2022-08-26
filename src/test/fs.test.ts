import assert from 'assert';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

import { FsCache } from '../main/fs.js';
import { sleep } from './util/sleep.js';

const cacheDir = process.env.TEST_CACHE_DIR || path.join(os.tmpdir(), 'cache');
const ttl = Number(process.env.TEST_TTL) || 10;
const delay = Number(process.env.TEST_DELAY) || 1;

describe('FsCache', () => {


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
            await sleep(delay);
            await cache.set('bar', 'KTHXBYE');
            await sleep(delay);
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
            await sleep(delay);
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
            await sleep(delay);
            await cache.set('baz', '42');
            await sleep(delay);
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

        let cache: FsCache<string>;

        beforeEach(async () => {
            await fs.rm(cacheDir, { force: true, recursive: true });
            cache = new FsCache<string>({
                dir: cacheDir,
                ttl,
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
            await sleep(ttl * 2);
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
