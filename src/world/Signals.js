// Traffic signals at FinVora's inner junctions. Pure timing logic (unit tested) shared by the traffic AI
// and the signal lamps. Each junction runs its own offset so the whole city never stops at once.

export const SIGNAL = { green: 12, amber: 3, allRed: 1.5 };
export const CYCLE = 2 * (SIGNAL.green + SIGNAL.amber + SIGNAL.allRed);
export const SIGNAL_LIMIT = 175; // junctions with |x| and |z| up to this are signalised (all but the outer ring road)
export const STOP_LINE = 7.4; // cars stop this far before the junction centre (just behind the zebra crossing)

export const isSignalised = (x, z) => Math.abs(x) <= SIGNAL_LIMIT + 1 && Math.abs(z) <= SIGNAL_LIMIT + 1;

const offsetOf = (x, z) => ((((Math.round(x / 50) * 5 + Math.round(z / 50) * 3) % 11) + 11) % 11) * 3;

/** State of the light facing traffic that travels along `axis` ('x' or 'z') through junction (x, z) at time t. */
export function signalAt(t, x, z, axis) {
  const half = CYCLE / 2;
  let p = (t + offsetOf(x, z)) % CYCLE;
  if (axis === 'z') p = (p + half) % CYCLE;
  if (p < SIGNAL.green) return 'green';
  if (p < SIGNAL.green + SIGNAL.amber) return 'amber';
  return 'red';
}
