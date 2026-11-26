// IndexedDB via idb-keyval, with an in-memory fallback when the browser blocks storage
// (private modes, sandboxed frames). Callers never crash because storage is unavailable.
import * as idb from 'idb-keyval';

const mem = new Map();
let broken = false;
const safe = (fn, fallback) => async (...a) => {
  if (!broken) { try { return await fn(...a); } catch (e) { broken = true; console.warn('IndexedDB unavailable, using memory only', e); } }
  return fallback(...a);
};
export const get = safe(idb.get, (k) => mem.get(k));
export const set = safe(idb.set, (k, v) => { mem.set(k, v); });
export const del = safe(idb.del, (k) => { mem.delete(k); });
export const storageIsPersistent = () => !broken;
