import { get, set, del } from './storage.js';
import { SAVE } from '../config.js';

// Debounced checkpoint saving with an offline queue.
//
// Cloud mode: state is written through the `save_game_state` RPC with optimistic versioning.
// The server only accepts a write whose base version matches the stored one, so an older device
// can never overwrite newer progress. On conflict the cloud copy wins and the local copy is kept
// as a recoverable backup in IndexedDB.
//
// The status shown to the player only says "Saved to Cloud" after the database confirms.

export const SAVE_STATUS = {
  idle: '',
  saving: 'Saving…',
  saved: 'Saved to Cloud',
  failed: 'Save Failed',
  offline: 'Offline Mode',
  local: 'Saved on this device',
};

export class SaveService {
  constructor({ supabase, profile, onStatus, onConflict }) {
    this.sb = supabase;
    this.profile = profile;
    this.cloud = profile.mode === 'cloud';
    this.onStatus = onStatus || (() => {});
    this.onConflict = onConflict || (() => {});
    this.version = 0;
    this.pending = null;
    this.timer = null;
    this.inFlight = null;
    this.key = `finworld:${this.cloud ? 'pending' : 'local-state'}:${profile.id}`;
    window.addEventListener('online', () => this.cloud && this.pending && this.flush());
    window.addEventListener('offline', () => this.cloud && this.onStatus('offline'));
  }

  /** Returns the authoritative state to start the session with. */
  async load() {
    if (!this.cloud) {
      const local = await get(this.key);
      this.onStatus('local');
      return local?.state || null;
    }
    const { data, error } = await this.sb.from('game_state').select('state, version, updated_at').eq('player_id', this.profile.id).single();
    if (error) throw error;
    this.version = Number(data.version);
    let state = data.state && Object.keys(data.state).length ? data.state : null;

    const queued = await get(this.key);
    if (queued) {
      if (queued.baseVersion === this.version) {
        // Offline progress made on top of the latest cloud copy: safe to apply and upload.
        state = queued.state; this.pending = queued.state;
        await this.flush();
      } else {
        // Cloud moved on (another device). Cloud wins; keep the local copy as a backup.
        await set(`finworld:backup:${this.profile.id}`, { ...queued, backedUpAt: new Date().toISOString() });
        await del(this.key);
        this.onConflict({ reason: 'cloud-newer-on-load' });
      }
    }
    this.onStatus(navigator.onLine ? 'saved' : 'offline');
    return state;
  }

  /** Queue a save. `immediate` for checkpoints (transactions, missions, leaving). */
  schedule(state, { immediate = false } = {}) {
    this.pending = state;
    clearTimeout(this.timer);
    if (immediate) return this.flush();
    this.timer = setTimeout(() => this.flush(), SAVE.debounceMs);
  }

  async flush() {
    clearTimeout(this.timer);
    if (!this.pending) return;
    if (this.inFlight) { await this.inFlight; if (!this.pending) return; }
    const state = this.pending;
    const bytes = new Blob([JSON.stringify(state)]).size;
    if (bytes > SAVE.maxStateBytes) { this.onStatus('failed'); console.error('Save state too large', bytes); return; }

    if (!this.cloud) {
      await set(this.key, { state, savedAt: new Date().toISOString() });
      this.pending = null; this.onStatus('local');
      return;
    }

    // Always keep a local copy first so nothing is lost if the network drops mid-request.
    await set(this.key, { state, baseVersion: this.version, savedAt: new Date().toISOString() });
    if (!navigator.onLine) { this.onStatus('offline'); return; }

    this.onStatus('saving');
    this.inFlight = (async () => {
      try {
        const { data, error } = await this.sb.rpc('save_game_state', { p_state: state, p_base_version: this.version });
        if (error) {
          if (String(error.message).includes('version_conflict')) {
            await set(`finworld:backup:${this.profile.id}`, { state, baseVersion: this.version, backedUpAt: new Date().toISOString() });
            await del(this.key);
            this.pending = null;
            this.onStatus('failed');
            const fresh = await this.sb.from('game_state').select('state, version').eq('player_id', this.profile.id).single();
            if (!fresh.error) this.version = Number(fresh.data.version);
            this.onConflict({ reason: 'cloud-newer-on-save', cloudState: fresh.data?.state });
            return;
          }
          throw error;
        }
        this.version = Number(data);
        if (this.pending === state) { this.pending = null; await del(this.key); }
        this.onStatus('saved');
      } catch (e) {
        console.warn('Cloud save failed, kept locally', e);
        this.onStatus(navigator.onLine ? 'failed' : 'offline');
        setTimeout(() => this.pending && this.flush(), 15000);
      } finally {
        this.inFlight = null;
      }
    })();
    return this.inFlight;
  }

  /** Best effort on tab close: the local IndexedDB copy is already written by flush(). */
  flushOnExit() { if (this.pending) this.flush(); }
}
