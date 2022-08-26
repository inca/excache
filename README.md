# Extensible Cache

## Key features

- ⚡️ TTL and LRU cache
- 💾 File System and Memory backends out of box
- 🔌 Simple interface, extensible to other backends
- 📦 ESM (ECMAScript Module)
- 🔬 100% TypeScript

## Usage

Simple in-memory cache:

```ts
import { Cache, MemoryCache } from 'excache';

// Keep Cache<T> interface, so you can swap cache implementation
const cache: Cache<T> = new MemoryCache<T>({
    maxSize: 100,   // Specify to enable LRU cache
    ttl: 60 * 1000, // Specify to enable TTL cache
});

await cache.get('foo'); // T | undefined
await cache.set('foo', myValue);
```

Upgrade to FS cache:

```ts
import { Cache, FsCache } from 'excache';

const cache: Cache<T> = new FsCache({
    dir: '/path/to/cache',
    toString(value: string): T {
        // Serialize to text data
    },
    fromString(value: stirng): T {
        // Deserialize from text data
    },
    maxSize: 100,
    ttl: 60 * 1000,
});

await cache.get('foo');
await cache.set('foo', myValue);
```
