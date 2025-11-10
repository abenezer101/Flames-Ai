// A simple key-val store using IndexedDB
// src/lib/idb-cache.ts

import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'webcontainer-cache';
const STORE_NAME = 'file-cache';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, 1, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            },
        });
    }
    return dbPromise;
}

export async function setCache(key: string, value: any): Promise<void> {
    try {
        const db = await getDb();
        await db.put(STORE_NAME, value, key);
    } catch (error) {
        console.error(`[IDB] Failed to set cache for key: ${key}`, error);
    }
}

export async function getCache<T>(key: string): Promise<T | undefined> {
    try {
        const db = await getDb();
        return await db.get(STORE_NAME, key);
    } catch (error) {
        console.error(`[IDB] Failed to get cache for key: ${key}`, error);
        return undefined;
    }
}

export async function clearCache(): Promise<void> {
    try {
        const db = await getDb();
        await db.clear(STORE_NAME);
        console.log('[IDB] Cache cleared.');
    } catch (error) {
        console.error('[IDB] Failed to clear cache', error);
    }
}
