import assert from 'assert';

import { MemoryCache } from '../main/memory.js';
import { sleep } from './util/sleep.js';

const ttl = Number(process.env.TEST_TTL) || 10;
const delay = Number(process.env.TEST_DELAY) || 1;

describe('MemoryCache', () => {

    describe('LRU cache', () => {

        let cache: MemoryCache<string>;

        beforeEach(async () => {
            cache = new MemoryCache<string>({
                maxSize: 3,
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
            assert.strictEqual(await cache.get('foo'), undefined);
            assert.strictEqual(await cache.get('bar'), 'KTHXBYE');
            assert.strictEqual(await cache.get('baz'), '42');
            assert.strictEqual(await cache.get('qux'), '123');
        });

        it('preserves last accessed value', async () => {
            await cache.get('foo');
            await sleep(delay);
            // Now foo stays, bar is evicted
            await cache.set('baz', '42');
            await sleep(delay);
            await cache.set('qux', '123');
            assert.strictEqual(await cache.get('foo'), 'Hello World');
            assert.strictEqual(await cache.get('bar'), undefined);
            assert.strictEqual(await cache.get('baz'), '42');
            assert.strictEqual(await cache.get('qux'), '123');
        });

    });

    describe('TTL cache', () => {

        let cache: MemoryCache<string>;

        beforeEach(async () => {
            cache = new MemoryCache<string>({
                ttl,
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
            assert.strictEqual(await cache.get('foo'), undefined);
            assert.strictEqual(await cache.get('bar'), undefined);
            assert.strictEqual(await cache.get('baz'), '42');
            assert.strictEqual(await cache.get('qux'), '123');
        });

    });

});
