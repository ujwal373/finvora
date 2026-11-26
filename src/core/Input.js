// Unified input for PC (keyboard + mouse) and touch (virtual joystick + drag-to-look + buttons).
// The game reads a single snapshot each frame, so both platforms drive identical game logic.

export const isTouchDevice = () =>
  (typeof window !== 'undefined') && (('ontouchstart' in window) || navigator.maxTouchPoints > 0) && matchMedia('(pointer: coarse)').matches;

export class Input {
  constructor(canvas, hudRoot) {
    this.canvas = canvas;
    this.keys = new Set();
    this.move = { x: 0, y: 0 };
    this.look = { dx: 0, dy: 0 };
    this.zoom = 0;
    this.pressed = new Set(); // edge-triggered actions this frame
    this.sprintToggle = false;
    this.enabled = true;
    this.touch = isTouchDevice();
    this.sensitivity = 1;
    this._bind();
    if (this.touch) this._buildTouchUI(hudRoot);
  }

  _bind() {
    const map = { KeyE: 'interact', Enter: 'interact', Space: 'jump', KeyM: 'map', Escape: 'pause', KeyP: 'portfolio', KeyJ: 'journal', KeyT: 'phone', ArrowUp: 'phone', ArrowDown: 'back', Backspace: 'back', Digit1: 'c1', Digit2: 'c2', Digit3: 'c3', Digit4: 'c4', Digit5: 'c5' };
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.repeat) { if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault(); return; }
      this.keys.add(e.code);
      // While the mouse is captured, Esc only releases it (the browser does that); it must not pause.
      if (e.code === 'Escape' && this.locked) return;
      if (map[e.code]) this.pressed.add(map[e.code]);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    // PC mouse look. Click the game once: the pointer is captured (pointer lock) and the camera follows
    // the mouse directly, like a PC action game. Esc releases it. If the browser refuses pointer lock
    // (some embedded frames do), click-and-drag still works as a fallback.
    this.locked = false;
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === this.canvas;
      if (was && !this.locked) this.unlockedAt = performance.now();
      this.onLockChange?.(this.locked);
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked || !this.enabled) return;
      this.look.dx += e.movementX * 0.0022 * this.sensitivity;
      this.look.dy += e.movementY * 0.0022 * this.sensitivity;
    });
    let dragging = false, lx = 0, ly = 0;
    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.canvas.focus();
      if (!this.locked && this.enabled && this.mouseLook !== false) this.lock();
      if (this.locked) return;
      dragging = true; lx = e.clientX; ly = e.clientY;
      try { this.canvas.setPointerCapture(e.pointerId); } catch { /* pointer lock pending */ }
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!dragging || e.pointerType !== 'mouse' || this.locked) return;
      this.look.dx += (e.clientX - lx) * 0.005 * this.sensitivity;
      this.look.dy += (e.clientY - ly) * 0.005 * this.sensitivity;
      lx = e.clientX; ly = e.clientY;
    });
    const end = (e) => { if (e.pointerType === 'mouse') dragging = false; };
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', end);
    this.canvas.addEventListener('wheel', (e) => { this.zoom += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Touch drag on the canvas (right side / anywhere not the joystick) looks around
    const looks = new Map();
    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return;
      looks.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      const p = looks.get(e.pointerId);
      if (!p) return;
      this.look.dx += (e.clientX - p.x) * 0.008 * this.sensitivity;
      this.look.dy += (e.clientY - p.y) * 0.008 * this.sensitivity;
      p.x = e.clientX; p.y = e.clientY;
    });
    const tend = (e) => looks.delete(e.pointerId);
    this.canvas.addEventListener('pointerup', tend);
    this.canvas.addEventListener('pointercancel', tend);
  }

  _buildTouchUI(hudRoot) {
    document.body.classList.add('touch');
    const ui = document.createElement('div');
    ui.className = 'touch-ui';
    ui.innerHTML = `
      <div class="joy-zone"><div class="joy-base idle" style="left:90px;bottom:0;top:auto"><div class="joy-knob"></div></div></div>
      <div class="touch-btns">
        <button class="tbtn" data-a="jump" aria-label="Jump">JUMP</button>
        <button class="tbtn" data-a="sprint" aria-label="Sprint">RUN</button>
        <span></span>
        <button class="tbtn big" data-a="interact" aria-label="Interact">TALK</button>
      </div>`;
    hudRoot.appendChild(ui);
    this.touchUI = ui;
    const zone = ui.querySelector('.joy-zone'), base = ui.querySelector('.joy-base'), knob = ui.querySelector('.joy-knob');
    const rest = () => { base.style.left = '90px'; base.style.top = 'auto'; base.style.bottom = '40px'; base.style.marginTop = '0'; };
    rest();
    let jid = null, cx = 0, cy = 0;
    const R = 52;
    zone.addEventListener('pointerdown', (e) => {
      if (jid !== null) return;
      jid = e.pointerId; zone.setPointerCapture(jid);
      const r = zone.getBoundingClientRect();
      cx = e.clientX; cy = e.clientY;
      base.style.left = `${cx - r.left}px`; base.style.top = `${cy - r.top}px`; base.style.bottom = 'auto'; base.style.marginTop = '-62px';
      base.classList.remove('idle');
      e.preventDefault();
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== jid) return;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const dead = 0.12, mx = dx / R, my = dy / R;
      const mag = Math.hypot(mx, my);
      const k = mag < dead ? 0 : (mag - dead) / (1 - dead) / mag;
      this.move.x = mx * k; this.move.y = -my * k;
    });
    const jend = (e) => {
      if (e.pointerId !== jid) return;
      jid = null; this.move.x = this.move.y = 0;
      knob.style.transform = ''; base.classList.add('idle'); rest();
    };
    zone.addEventListener('pointerup', jend);
    zone.addEventListener('pointercancel', jend);

    ui.querySelectorAll('.tbtn').forEach((btn) => {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        const a = btn.dataset.a;
        if (a === 'sprint') { this.sprintToggle = !this.sprintToggle; btn.classList.toggle('on', this.sprintToggle); }
        else { this.pressed.add(a); if (a === 'jump') this.jumpDown = true; }
      });
    });
    this.interactBtn = ui.querySelector('[data-a="interact"]');
    const jb = ui.querySelector('[data-a="jump"]');
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) jb.addEventListener(ev, () => { this.jumpDown = false; });
    this.jumpBtn = jb;
  }

  setInteractLabel(label) {
    if (!this.interactBtn) return;
    this.interactBtn.textContent = label || 'TALK';
    this.interactBtn.style.opacity = label ? '1' : '0.45';
  }

  lock() {
    if (this.touch || this.locked) return;
    try { const r = this.canvas.requestPointerLock?.({ unadjustedMovement: false }); if (r && r.catch) r.catch(() => {}); } catch { /* not allowed here: drag fallback */ }
  }
  unlock() { if (this.locked) try { document.exitPointerLock(); } catch { /* ignore */ } }

  setDriving(on) { if (this.jumpBtn) this.jumpBtn.textContent = on ? 'BRAKE' : 'JUMP'; }

  setTouchVisible(v) { if (this.touchUI) this.touchUI.style.display = v ? '' : 'none'; }

  /** Snapshot for this frame; clears edge-triggered and accumulated values. */
  read() {
    const k = this.keys;
    let x = this.move.x, y = this.move.y;
    if (!this.touch || (x === 0 && y === 0)) {
      const kx = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
      const ky = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
      if (kx || ky) { const n = Math.hypot(kx, ky); x = kx / n; y = ky / n; }
    }
    // The Esc that releases the mouse should not also open the pause menu.
    if (this.pressed.has('pause') && performance.now() - (this.unlockedAt || 0) < 300) this.pressed.delete('pause');
    const snap = {
      moveX: this.enabled ? x : 0,
      moveY: this.enabled ? y : 0,
      sprint: this.enabled && (k.has('ShiftLeft') || k.has('ShiftRight') || this.sprintToggle),
      lookDX: this.enabled ? this.look.dx : 0,
      lookDY: this.enabled ? this.look.dy : 0,
      zoom: this.enabled ? this.zoom : 0,
      jumpHeld: this.enabled && (k.has('Space') || !!this.jumpDown),
      pressed: new Set(this.pressed),
    };
    this.look.dx = this.look.dy = 0; this.zoom = 0; this.pressed.clear();
    return snap;
  }
}
