import './styles/main.css';
import { supabase, cloudConfigured, authRedirect } from './services/supabase.js';
import * as account from './services/account.js';
import { AuthScreen } from './ui/AuthScreen.js';
import { esc } from './ui/dom.js';
import { get as getStored } from './services/storage.js';

// Boot sequence: auth gate first, then the 3D world (loaded lazily so the login screen is light).

const $ = (id) => document.getElementById(id);
const auth = new AuthScreen($('auth-root'), { onLocalPreview: (name) => enter(null, name) });
let game = null;
let entering = false;

function hideBoot() { $('boot').classList.add('hide'); }

function fatal(msg) {
  document.body.insertAdjacentHTML('beforeend', `<div class="fatal"><div><div class="boot-logo" style="font-size:2rem">FIN<span>VORA</span></div><p class="muted" style="max-width:420px">${esc(msg)}</p><button class="fw-btn primary" onclick="location.reload()">Reload</button></div></div>`);
}

async function enter(session, guestName) {
  if (game || entering) return;
  entering = true;
  auth.showLoading(session ? 'Loading your profile…' : 'Building the city…');
  try {
    const profile = session ? await account.loadProfile(session.user) : await account.localProfile(guestName);
    const { Game } = await import('./core/Game.js');
    game = new Game({
      canvas: $('world'), hudRoot: $('hud-root'), overlayRoot: $('overlay-root'),
      profile, supabase,
      onLogout: async () => { await account.signOut(); location.reload(); },
      onRename: (n) => account.updateDisplayName(n),
      onPasswordReset: (email) => account.sendPasswordReset(email),
    });
    await game.start();
    auth.hide();
    window.__finworld = game; // inspection hook for testing
  } catch (e) {
    console.error(e);
    game = null;
    if (/WebGL/.test(e.message)) { auth.hide(); fatal(e.message); }
    else auth.showError(`Could not start FinVora: ${e.message || e}`, () => { entering = false; enter(session); });
  } finally {
    entering = false;
  }
}

async function boot() {
  hideBoot();
  if (!cloudConfigured) {
    const prev = await getStored('finworld:local-profile');
    return auth.showGuest(prev?.fullName && prev.fullName !== 'Guest' ? prev.fullName : '');
  }

  let recovering = authRedirect.recovery;
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      recovering = true;
      auth.showReset(() => { recovering = false; enter(session); });
    } else if (event === 'SIGNED_IN' && session && !recovering) {
      // setTimeout: never await Supabase calls inside this callback (documented deadlock).
      setTimeout(() => enter(session), 0);
    } else if (event === 'SIGNED_OUT') {
      if (game) location.reload();
    }
  });

  if (authRedirect.error) return auth.show('login', { text: `That link did not work: ${authRedirect.error}. Request a new one.`, cls: 'err' });
  const { data } = await supabase.auth.getSession();
  if (recovering) return; // reset form shown by the event handler
  if (data.session) enter(data.session);
  else auth.showGuest();
}

boot().catch((e) => { console.error(e); fatal(String(e.message || e)); });
