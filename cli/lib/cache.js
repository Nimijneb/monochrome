/** In-memory only cache for CLI (no IndexedDB). */
export class APICache {
    constructor(options = {}) {
        this.memoryCache = new Map();
        this.maxSize = options.maxSize || 200;
        this.ttl = options.ttl || 1000 * 60 * 30;
    }

    generateKey(type, params) {
        const paramString = typeof params === 'object' ? JSON.stringify(params) : String(params);
        return `${type}:${paramString}`;
    }

    async get(type, params) {
        const key = this.generateKey(type, params);
        const cached = this.memoryCache.get(key);
        if (cached && Date.now() - cached.timestamp < this.ttl) {
            return cached.data;
        }
        if (cached) this.memoryCache.delete(key);
        return null;
    }

    async set(type, params, data) {
        const key = this.generateKey(type, params);
        this.memoryCache.set(key, { key, data, timestamp: Date.now() });
        if (this.memoryCache.size > this.maxSize) {
            const firstKey = this.memoryCache.keys().next().value;
            this.memoryCache.delete(firstKey);
        }
    }

    async clear() {
        this.memoryCache.clear();
    }

    async clearExpired() {
        const now = Date.now();
        for (const [key, entry] of this.memoryCache.entries()) {
            if (now - entry.timestamp >= this.ttl) this.memoryCache.delete(key);
        }
    }

    getCacheStats() {
        return { memoryEntries: this.memoryCache.size, maxSize: this.maxSize, ttl: this.ttl };
    }
}
