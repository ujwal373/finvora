import { supabase, cloudConfigured } from './supabase.js';
import { STARTING_BALANCE } from '../config.js';
import { get, set } from './storage.js';

// Account + profile access. Passwords are handled only by Supabase Auth; nothing here stores them.

export const redirectUrl = () => `${location.origin}${location.pathname}`;

export async function signUp({ fullName, email, password }) {
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name: fullName }, emailRedirectTo: redirectUrl() },
  });
  if (error) throw error;
  // With "Confirm email" on (Supabase default), there is no session until the link is clicked.
  // If the address is already registered Supabase returns a user with no identities.
  const exists = data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0;
  return { needsVerification: !data.session, alreadyRegistered: exists };
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function sendPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl() });
  if (error) throw error;
}

export async function resendVerification(email) {
  const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: redirectUrl() } });
  if (error) throw error;
}

export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
}

/**
 * Loads the player's profile and wallet. Rows are created server-side by a database trigger on
 * sign-up, so the client can never (re)initialise a wallet. `ensure_player` covers accounts made
 * before the schema existed; it inserts only when missing.
 */
export async function loadProfile(user) {
  let { data: player, error } = await supabase.from('players').select('*').eq('id', user.id).maybeSingle();
  if (error) throw error;
  if (!player) {
    const r = await supabase.rpc('ensure_player');
    if (r.error) throw r.error;
    ({ data: player, error } = await supabase.from('players').select('*').eq('id', user.id).single());
    if (error) throw error;
  }
  const { data: wallet, error: we } = await supabase.from('wallets').select('*').eq('player_id', user.id).single();
  if (we) throw we;
  return {
    mode: 'cloud',
    id: user.id,
    playerCode: player.player_code,
    fullName: player.full_name || user.user_metadata?.full_name || user.email.split('@')[0],
    email: user.email,
    createdAt: player.created_at,
    level: player.level,
    xp: player.xp,
    wallet: {
      initial: Number(wallet.initial_balance),
      available: Number(wallet.available_balance),
      realisedPL: Number(wallet.realised_pl),
      updatedAt: wallet.updated_at,
    },
  };
}

export async function updateDisplayName(name) {
  const { error } = await supabase.rpc('update_display_name', { p_name: name });
  if (error) throw error;
}

/** Guest profile: no account, saved in this browser. The wallet shown is display-only; the finance engine holds the real (virtual) balance. */
export async function localProfile(name) {
  let p = await get('finworld:local-profile');
  if (!p) {
    const code = 'FW-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    p = {
      mode: 'local', id: 'guest', playerCode: code,
      fullName: name || 'Guest', email: 'not signed in', createdAt: new Date().toISOString(), level: 1, xp: 0,
      wallet: { initial: STARTING_BALANCE, available: STARTING_BALANCE, realisedPL: 0, updatedAt: new Date().toISOString() },
    };
    await set('finworld:local-profile', p);
  } else if (name && name !== p.fullName) { p.fullName = name; await set('finworld:local-profile', p); }
  if (p.id === 'local-preview') { p.id = 'guest'; await set('finworld:local-profile', p); }
  return p;
}

export { cloudConfigured };
