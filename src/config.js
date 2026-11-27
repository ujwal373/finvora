// Central constants. World units are metres.

export const CITY = {
  // Boulevard centre lines. Blocks sit between them, centred on -50, 0, 50.
  // 9 × 9 blocks, about 460 m across: compact enough that every landmark is a short walk or drive away.
  // AccoFinTra Tower stands on the centre block at the spawn.
  roadXs: [-225, -175, -125, -75, -25, 25, 75, 125, 175, 225],
  roadZs: [-225, -175, -125, -75, -25, 25, 75, 125, 175, 225],
  blocks: [-200, -150, -100, -50, 0, 50, 100, 150, 200],
  roadWidth: 10,
  asphaltHalf: 3.5, // pavement starts 3.5 m from a road's centre line
  laneOffset: 1.75, // cars keep left (India): lane centre 1.75 m left of the centre line
  walkOffset: 4.3, // pedestrians walk on the pavement 4.3 m from the centre line
  bound: 232, // walkable half-extent
  groundHalf: 330,
};

export const STARTING_BALANCE = 1000000; // ₹10,00,000 virtual (simulated) money

export const CLOCK = {
  realSecondsPerGameHour: 60, // a full in-game day = 24 real minutes
  startHour: 9.5,
};

export const PLAYER = {
  walkSpeed: 4.4,
  sprintSpeed: 7.8,
  radius: 0.45,
  jumpVelocity: 5.2,
  gravity: 16,
  spawn: { x: 0, z: 17, rot: Math.PI }, // on the plaza, facing AccoFinTra Tower
};

export const INTERACT = { npcRange: 2.8, doorRange: 3.6 };

export const GRAPHICS_PRESETS = {
  low: { label: 'Low', maxPixelRatio: 1, pixelScale: 0.8, shadows: false, shadowMap: 0, antialias: false, citizens: 6, cars: 12, fogFar: 160, treeDensity: 0.45, nameTagRange: 12, cullRange: 90 },
  medium: { label: 'Medium', maxPixelRatio: 1.5, pixelScale: 1, shadows: true, shadowMap: 1024, antialias: false, citizens: 12, cars: 24, fogFar: 230, treeDensity: 0.7, nameTagRange: 16, cullRange: 130 },
  high: { label: 'High', maxPixelRatio: 2, pixelScale: 1, shadows: true, shadowMap: 2048, antialias: true, citizens: 20, cars: 36, fogFar: 340, treeDensity: 0.95, nameTagRange: 20, cullRange: 190 },
};

export const SAVE = { debounceMs: 3500, periodicMs: 60000, maxStateBytes: 60000 };

const _inr0 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const _inr2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const formatINR = (n) => _inr0.format(Math.round(n) === 0 ? 0 : n);
export const formatINR2 = (n) => _inr2.format(n);
export const fmtNum = (n, d = 2) => Number(n).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtPct = (n, d = 2) => `${n >= 0 ? '+' : ''}${Number(n).toFixed(d)}%`;
