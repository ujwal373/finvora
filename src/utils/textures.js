import * as THREE from 'three';

// All textures are generated at runtime on small canvases: no image downloads, tiny memory footprint.

function canvasTex(w, h, draw, { repeat = false, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 2;
  return t;
}

/** Window grid. White = glass. Used as a lightmap-ish pattern (map) and as an emissive mask at night. */
export function windowTextures() {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const lit = [];
  for (let i = 0; i < 64; i++) lit.push(rnd() > 0.45);
  const draw = (emissive) => (g, w, h) => {
    g.fillStyle = emissive ? '#000' : '#fff';
    g.fillRect(0, 0, w, h);
    const cols = 4, rows = 8, cw = w / cols, rh = h / rows;
    let k = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const on = lit[k++];
      if (emissive) g.fillStyle = on ? '#ffd890' : '#000';
      else g.fillStyle = on ? '#9fb3c4' : '#6f8394';
      g.fillRect(c * cw + cw * 0.18, r * rh + rh * 0.22, cw * 0.64, rh * 0.56);
    }
  };
  return {
    map: canvasTex(64, 128, draw(false), { repeat: true }),
    emissive: canvasTex(64, 128, draw(true), { repeat: true }),
  };
}

export function signTexture(text, accentHex, sub = 'FINVORA') {
  const accent = '#' + accentHex.toString(16).padStart(6, '0');
  const t = canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = '#0d0f12'; g.fillRect(0, 0, w, h);
    g.strokeStyle = accent; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = accent; g.fillRect(6, h - 64, w - 12, 58);
    let size = 120;
    const font = (sz) => `800 ${sz}px system-ui, "Segoe UI", Arial, sans-serif`;
    g.font = font(size);
    while (g.measureText(text).width > w - 80 && size > 40) { size -= 4; g.font = font(size); }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#ffffff';
    g.fillText(text, w / 2, (h - 64) / 2 + 6);
    g.font = '800 34px system-ui, Arial, sans-serif';
    g.fillStyle = '#0d0f12';
    g.fillText(sub, w / 2, h - 35);
  });
  t.anisotropy = 8;
  return t;
}

export function labelTexture(name, role, color = '#d4a846') {
  const tex = canvasTex(256, 72, (g, w, h) => {
    g.fillStyle = 'rgba(12,13,16,0.82)';
    roundRect(g, 4, 4, w - 8, h - 8, 14); g.fill();
    g.fillStyle = '#ecebe6'; g.font = '700 24px system-ui, Arial, sans-serif'; g.textAlign = 'center';
    g.fillText(name, w / 2, 32);
    g.fillStyle = color; g.font = '600 16px system-ui, Arial, sans-serif';
    g.fillText(role.toUpperCase(), w / 2, 55);
  });
  return tex;
}

export function tickerTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 64;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return { tex: t, canvas: c };
}

export function groundTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#2b2f36'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const v = 38 + Math.floor(Math.random() * 14);
      g.fillStyle = `rgb(${v},${v + 3},${v + 8})`;
      g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
    }
  }, { repeat: true });
}

export function paverTexture() {
  return canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#a7a59d'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#8f8d86'; g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(0, i * 16); g.lineTo(w, i * 16); g.stroke(); }
    for (let r = 0; r < 4; r++) for (let i = 0; i <= 2; i++) {
      const x = i * 32 + (r % 2) * 16; g.beginPath(); g.moveTo(x, r * 16); g.lineTo(x, r * 16 + 16); g.stroke();
    }
  }, { repeat: true });
}

export function grassTexture() {
  return canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#4f7a3a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) {
      g.fillStyle = Math.random() > 0.5 ? '#5a8742' : '#466d33';
      g.fillRect(Math.random() * w, Math.random() * h, 1, 2);
    }
  }, { repeat: true });
}

export function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
