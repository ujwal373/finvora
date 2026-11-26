import { el, esc, $, $$ } from './dom.js';
import * as account from '../services/account.js';
import { cloudConfigured } from '../services/supabase.js';

// The first screen. Everyone can play as a guest (progress saved in the browser).
// When Supabase is configured, optional accounts add cross-device cloud saves.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function friendly(err) {
  const m = String(err?.message || err || '');
  if (/invalid login credentials/i.test(m)) return 'That email and password do not match an account.';
  if (/email not confirmed/i.test(m)) return 'Please verify your email first. Check your inbox for the link.';
  if (/rate limit|too many/i.test(m)) return 'Too many attempts. Please wait a minute and try again.';
  if (/password should be|weak/i.test(m)) return m;
  if (/failed to fetch|network/i.test(m)) return 'Could not reach the server. Check your connection.';
  return m || 'Something went wrong. Please try again.';
}

export class AuthScreen {
  constructor(root, { onLocalPreview }) {
    this.root = root;
    this.onLocalPreview = onLocalPreview;
  }

  hide() { this.root.innerHTML = ''; }

  _frame(body) {
    this.root.innerHTML = '';
    const n = el(`<div class="auth"><div class="auth-grid"></div><div class="fw-card auth-panel">
      <div class="auth-kicker">AccoFinTra presents</div>
      <div class="auth-title">WELCOME TO FIN<span style="color:var(--fw-gold)">VORA</span></div>
      <p class="auth-sub">Enter the World of Finance.</p>
      <div data-body></div>
      <div class="auth-foot">An educational 3D simulation. Every rupee in FinVora is virtual money for learning. Nothing here is financial advice.</div>
    </div></div>`);
    $(n, '[data-body]').appendChild(body);
    this.root.appendChild(n);
    return n;
  }

  _busy(form, busy) { $$(form, 'button, input').forEach((x) => (x.disabled = busy)); }
  _msg(form, text, cls = 'err') { const m = $(form, '[data-msg]'); m.innerHTML = text ? `<div class="fw-msg ${cls}">${esc(text)}</div>` : ''; }

  /** Main entry: tabs for Create Account / Login. */
  show(tab = 'login', notice = null) {
    if (!cloudConfigured) return this.showNotConfigured();
    const body = el(`<div>
      <div class="auth-tabs" role="tablist"><button data-t="register">Create Account</button><button data-t="login">Login</button></div>
      <div data-form></div>
      <button type="button" class="fw-btn ghost block" data-guest style="margin-top:.8rem">Play as guest instead</button>
    </div>`);
    this._frame(body);
    const render = (t) => {
      $$(body, '[data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
      const f = $(body, '[data-form]'); f.innerHTML = '';
      f.appendChild(t === 'register' ? this._registerForm() : this._loginForm());
      if (notice) { this._msg(f.firstElementChild, notice.text, notice.cls); notice = null; }
    };
    $$(body, '[data-t]').forEach((b) => b.addEventListener('click', () => render(b.dataset.t)));
    $(body, '[data-guest]').addEventListener('click', () => this.showGuest());
    render(tab);
  }

  _registerForm() {
    const f = el(`<form novalidate>
      <label class="fw-label" for="r-name">Full name</label><input class="fw-input" id="r-name" autocomplete="name" maxlength="80" required>
      <label class="fw-label" for="r-email">Email address</label><input class="fw-input" id="r-email" type="email" autocomplete="email" inputmode="email" required>
      <label class="fw-label" for="r-pw">Password</label><input class="fw-input" id="r-pw" type="password" autocomplete="new-password" minlength="8" required>
      <label class="fw-label" for="r-pw2">Confirm password</label><input class="fw-input" id="r-pw2" type="password" autocomplete="new-password" required>
      <div class="muted" style="font-size:.78rem;margin-top:.4rem">At least 8 characters, with a letter and a number.</div>
      <div data-msg></div>
      <button class="fw-btn primary block" style="margin-top:1rem" type="submit">Create account</button>
    </form>`);
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fullName = $(f, '#r-name').value.trim(), email = $(f, '#r-email').value.trim().toLowerCase();
      const password = $(f, '#r-pw').value, confirm = $(f, '#r-pw2').value;
      if (fullName.length < 2) return this._msg(f, 'Please enter your full name.');
      if (!EMAIL_RE.test(email)) return this._msg(f, 'Please enter a valid email address.');
      if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return this._msg(f, 'Password needs at least 8 characters, including a letter and a number.');
      if (password !== confirm) return this._msg(f, 'Passwords do not match.');
      this._busy(f, true); this._msg(f, '');
      try {
        const r = await account.signUp({ fullName, email, password });
        if (r.alreadyRegistered) { this._busy(f, false); return this._msg(f, 'An account with this email already exists. Try logging in.'); }
        if (r.needsVerification) this.showVerify(email);
        // If verification is disabled in Supabase, a session is returned and onAuthStateChange takes over.
      } catch (err) { this._msg(f, friendly(err)); this._busy(f, false); }
    });
    return f;
  }

  _loginForm() {
    const f = el(`<form novalidate>
      <label class="fw-label" for="l-email">Email address</label><input class="fw-input" id="l-email" type="email" autocomplete="email" inputmode="email" required>
      <label class="fw-label" for="l-pw">Password</label><input class="fw-input" id="l-pw" type="password" autocomplete="current-password" required>
      <div class="auth-row"><span></span><button type="button" class="auth-link" data-forgot>Forgot password?</button></div>
      <div data-msg></div>
      <button class="fw-btn primary block" style="margin-top:.6rem" type="submit">Login and play</button>
    </form>`);
    $(f, '[data-forgot]').addEventListener('click', () => this.showForgot($(f, '#l-email').value.trim()));
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = $(f, '#l-email').value.trim().toLowerCase(), password = $(f, '#l-pw').value;
      if (!EMAIL_RE.test(email) || !password) return this._msg(f, 'Enter your email and password.');
      this._busy(f, true); this._msg(f, '');
      try { await account.signIn({ email, password }); /* onAuthStateChange continues */ }
      catch (err) {
        this._msg(f, friendly(err)); this._busy(f, false);
        if (/not confirmed/i.test(err?.message)) {
          const b = el('<button type="button" class="auth-link">Resend verification email</button>');
          b.addEventListener('click', async () => { try { await account.resendVerification(email); this._msg(f, 'Verification email sent.', 'ok'); } catch (x) { this._msg(f, friendly(x)); } });
          $(f, '[data-msg]').appendChild(b);
        }
      }
    });
    return f;
  }

  showVerify(email) {
    const b = el(`<div>
      <div class="fw-msg ok" style="margin-top:0">Account created. We sent a verification link to <b>${esc(email)}</b>.</div>
      <p class="muted" style="font-size:.92rem">Open the link on any device to activate your account, then log in. Check your spam folder if it does not arrive within a few minutes.</p>
      <div data-msg></div>
      <button class="fw-btn block" data-resend style="margin-top:.6rem">Resend email</button>
      <button class="fw-btn primary block" data-login style="margin-top:.6rem">Back to login</button>
    </div>`);
    this._frame(b);
    $(b, '[data-login]').addEventListener('click', () => this.show('login'));
    $(b, '[data-resend]').addEventListener('click', async () => {
      try { await account.resendVerification(email); this._msg(b, 'Sent again.', 'ok'); } catch (e) { this._msg(b, friendly(e)); }
    });
  }

  showForgot(prefill = '') {
    const f = el(`<form novalidate>
      <p style="margin-top:0">Enter your email and we will send a link to set a new password.</p>
      <label class="fw-label" for="f-email">Email address</label><input class="fw-input" id="f-email" type="email" value="${esc(prefill)}" autocomplete="email" required>
      <div data-msg></div>
      <button class="fw-btn primary block" style="margin-top:1rem" type="submit">Send reset link</button>
      <button class="fw-btn ghost block" style="margin-top:.5rem" type="button" data-back>Back to login</button>
    </form>`);
    this._frame(f);
    $(f, '[data-back]').addEventListener('click', () => this.show('login'));
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = $(f, '#f-email').value.trim().toLowerCase();
      if (!EMAIL_RE.test(email)) return this._msg(f, 'Please enter a valid email address.');
      this._busy(f, true);
      try { await account.sendPasswordReset(email); this._msg(f, 'If an account exists for that email, a reset link is on its way.', 'ok'); }
      catch (err) { this._msg(f, friendly(err)); }
      this._busy(f, false);
    });
  }

  /** Shown after clicking the email reset link (Supabase PASSWORD_RECOVERY event). */
  showReset(onDone) {
    const f = el(`<form novalidate>
      <p style="margin-top:0">Choose a new password for your FinVora account.</p>
      <label class="fw-label" for="n-pw">New password</label><input class="fw-input" id="n-pw" type="password" autocomplete="new-password" required>
      <label class="fw-label" for="n-pw2">Confirm new password</label><input class="fw-input" id="n-pw2" type="password" autocomplete="new-password" required>
      <div data-msg></div>
      <button class="fw-btn primary block" style="margin-top:1rem" type="submit">Set new password</button>
    </form>`);
    this._frame(f);
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const a = $(f, '#n-pw').value, b = $(f, '#n-pw2').value;
      if (a.length < 8 || !/[A-Za-z]/.test(a) || !/\d/.test(a)) return this._msg(f, 'Password needs at least 8 characters, including a letter and a number.');
      if (a !== b) return this._msg(f, 'Passwords do not match.');
      this._busy(f, true);
      try { await account.updatePassword(a); onDone(); }
      catch (err) { this._msg(f, friendly(err)); this._busy(f, false); }
    });
  }

  showLoading(text = 'Signing you in…') {
    this._frame(el(`<div class="muted" style="padding:1rem 0;text-align:center">${esc(text)}</div>`));
  }

  showError(text, retry) {
    const b = el(`<div><div class="fw-msg err" style="margin-top:0">${esc(text)}</div><button class="fw-btn primary block" style="margin-top:1rem">Try again</button></div>`);
    this._frame(b);
    $(b, 'button').addEventListener('click', retry);
  }

  /** Guest entry: no account needed. Progress is kept in this browser. */
  showGuest(savedName = '') {
    const b = el(`<form novalidate>
      <label class="fw-label" for="g-name">Your name (optional)</label>
      <input class="fw-input" id="g-name" maxlength="40" autocomplete="nickname" placeholder="Guest" value="${esc(savedName)}">
      <button class="fw-btn primary block" style="margin-top:1rem" type="submit">Play now</button>
      <p class="muted" style="font-size:.82rem;margin-bottom:0">Free and open to everyone, no sign-up. You start with ₹10,00,000 of virtual money. Your progress is saved in this browser on this device.${cloudConfigured ? '' : ' Accounts for playing across devices are coming later.'}</p>
      ${cloudConfigured ? '<button type="button" class="auth-link" data-acc>Have an account? Log in or sign up</button>' : ''}
    </form>`);
    this._frame(b);
    b.addEventListener('submit', (e) => { e.preventDefault(); this.onLocalPreview($(b, '#g-name').value.trim().slice(0, 40)); });
    $(b, '[data-acc]')?.addEventListener('click', () => this.show('login'));
    setTimeout(() => $(b, '#g-name')?.focus({ preventScroll: true }), 50);
  }

  showNotConfigured() { this.showGuest(); }
}
