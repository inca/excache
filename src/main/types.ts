/**
 * Abstract cache.
 *
 * TTL and LRU guarantees are specific to a particular cache backend.
 */
export interface Cache<V> {
    get(key: string): Promise<V | undefined>;
    set(key: string, value: V): Promise<void>;
    delete(key: string): Promise<void>;
    deleteAll(): Promise<void>;
}

export interface CacheOptions {
    maxSize?: number;
    ttl?: number;
}
