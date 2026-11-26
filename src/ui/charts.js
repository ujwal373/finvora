// Tiny dependency-free SVG charts sized to their container.
const PALETTE = ['#9aa1ab', '#2fbf71', '#f0c868', '#5aa9e6', '#e5534b'];

export function lineChart(series, { height = 140, xLabels = null, zero = false, money = true } = {}) {
  const W = 600, H = 200, P = { t: 10, b: 10 };
  const all = series.flatMap(([, v]) => v).filter(Number.isFinite);
  if (!all.length) return '';
  let min = Math.min(...all), max = Math.max(...all);
  if (zero) { min = Math.min(0, min); max = Math.max(0, max); }
  if (max === min) { max += 1; min -= 1; }
  const n = Math.max(...series.map(([, v]) => v.length));
  const X = (i) => (n <= 1 ? 0 : (i / (n - 1)) * W);
  const Y = (v) => P.t + (1 - (v - min) / (max - min)) * (H - P.t - P.b);
  const fmt = (v) => (money ? '₹' : '') + (Math.abs(v) >= 1e7 ? (v / 1e7).toFixed(2) + ' Cr' : Math.abs(v) >= 1e5 ? (v / 1e5).toFixed(2) + ' L' : Math.abs(v) >= 100 ? Math.round(v).toLocaleString('en-IN') : v.toFixed(2));
  const col = (k) => PALETTE[(k + (series.length === 1 ? 1 : 0)) % PALETTE.length];
  const paths = series.map(([, v], k) => `<path d="${v.map((y, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(y).toFixed(1)}`).join('')}" fill="none" stroke="${col(k)}" stroke-width="2" vector-effect="non-scaling-stroke"/>`).join('');
  const zeroLine = zero && min < 0 && max > 0 ? `<line x1="0" x2="${W}" y1="${Y(0)}" y2="${Y(0)}" stroke="#4a505a" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/>` : '';
  const legend = series.length > 1 ? series.map(([name], k) => `<span style="color:${col(k)}">● ${name}</span>`).join(' ') : '';
  return `<div class="chartbox" style="height:${height}px"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img">${zeroLine}${paths}</svg>
    <span class="cl tl">${legend}</span><span class="cl tr">${fmt(max)}</span><span class="cl br">${fmt(min)}</span>${xLabels ? `<span class="cl bl">${xLabels}</span>` : ''}</div>`;
}

export function spark(values, up) {
  if (!values || values.length < 2) return '';
  const W = 90, H = 26, min = Math.min(...values), max = Math.max(...values) || 1;
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${(i / (values.length - 1) * W).toFixed(1)},${(H - 2 - ((v - min) / (max - min || 1)) * (H - 4)).toFixed(1)}`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="spark"><path d="${d}" fill="none" stroke="${up ? '#2fbf71' : '#e5534b'}" stroke-width="1.5"/></svg>`;
}
