import { createClient } from '@supabase/supabase-js';

// Implicit flow so a verification or reset link works even when opened on a different device
// than the one used to register (PKCE would need the original browser's code verifier).
// Only PUBLIC keys are read here (publishable / anon). Row Level Security protects the data.
// The service-role (secret) key must never appear in frontend code or any VITE_ variable.

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

export const cloudConfigured = Boolean(url && key && !String(url).includes('your-project-ref'));

// Local Preview is a developer convenience. It is never available once Supabase is configured.
export const localPreviewAllowed = !cloudConfigured && (import.meta.env.DEV || import.meta.env.VITE_ALLOW_LOCAL_PREVIEW === 'true');

function isSecretKey(k) {
  if (k.startsWith('sb_secret_')) return true;
  const parts = k.split('.');
  if (parts.length !== 3) return false;
  try { return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'service_role'; } catch { return false; }
}

if (cloudConfigured && isSecretKey(key)) {
  // Fail loudly rather than ship a secret key to every visitor.
  throw new Error('FinVora: a Supabase secret/service-role key was supplied to the frontend. Use the publishable (anon) key.');
}

// Read auth redirect hints before the client consumes the URL fragment.
const h = typeof location !== 'undefined' ? new URLSearchParams(location.hash.slice(1)) : new URLSearchParams();
export const authRedirect = {
  recovery: h.get('type') === 'recovery',
  signup: h.get('type') === 'signup',
  error: h.get('error_description') ? h.get('error_description').replace(/\+/g, ' ') : null,
};

export const supabase = cloudConfigured
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' } })
  : null;
