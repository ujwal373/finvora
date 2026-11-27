// FinVora showrooms. Brands and prices are fictional and illustrative (₹, ex-showroom style).
// Running costs are rough monthly fuel/charging estimates for an average city driver.

export const AFT_BLUE = 0x1800ad; // AccoFinTra brand blue, sampled from the logo
export const PAINTS = [
  { id: 'aft', name: 'AccoFinTra Blue', hex: AFT_BLUE },
  { id: 'gold', name: 'AccoFinTra Gold', hex: 0xd4a846 },
  { id: 'red', name: 'Ruby Red', hex: 0xc0392b },
  { id: 'blue', name: 'Ocean Blue', hex: 0x2e86de },
  { id: 'white', name: 'Pearl White', hex: 0xf2f2ee },
  { id: 'black', name: 'Midnight Black', hex: 0x1b1d22 },
  { id: 'green', name: 'Forest Green', hex: 0x27ae60 },
  { id: 'silver', name: 'Silver', hex: 0xa7adb5 },
];

export const CARS = [
  { id: 'coupe', energy: 'petrol', tank: 35, eff: 18, name: 'AccoFinTra Company Coupe', type: 'Company car', model: 'player', price: 0, fuel: 0, maxKmh: 70, accel: 7, gift: true, desc: 'Lent to you by AccoFinTra. Insurance is covered by the company; you pay for fuel.' },
  { id: 'scoot', energy: 'petrol', tank: 5.3, eff: 50, name: 'Swift Scoot 110', type: 'Scooter', model: 'scooter', price: 95000, fuel: 900, maxKmh: 55, accel: 8, desc: 'Cheapest way to get around. Low running costs, but no roof.' },
  { id: 'auto', energy: 'cng', tank: 8, eff: 30, name: 'City Auto 3W', type: 'Three-wheeler', model: 'autoP', price: 320000, fuel: 2500, maxKmh: 45, accel: 5, desc: 'An auto-rickshaw of your own. Slow, sturdy and very Mumbai.' },
  { id: 'zippy', energy: 'petrol', tank: 35, eff: 20, name: 'Mama Motors Zippy', type: 'Hatchback', model: 'hatchP', price: 620000, fuel: 3500, maxKmh: 65, accel: 7, desc: 'Practical city hatchback. Easy to park, reasonable to run.' },
  { id: 'sedanza', energy: 'petrol', tank: 40, eff: 17, name: 'Mama Motors Sedanza', type: 'Sedan', model: 'sedanP', price: 1150000, fuel: 4500, maxKmh: 72, accel: 7.5, desc: 'Comfortable family sedan with a big boot.' },
  { id: 'volt', energy: 'ev', tank: 40, eff: 7, name: 'BLU Volt EV', type: 'Electric', model: 'ev', price: 1450000, fuel: 1500, maxKmh: 75, accel: 10, desc: 'Electric. Costs more up front, far less to run each month.' },
  { id: 'trekker', energy: 'petrol', tank: 50, eff: 13, name: 'Mama Motors Trekker', type: 'SUV', model: 'suv', price: 1680000, fuel: 6000, maxKmh: 70, accel: 6.5, desc: 'Big, tall SUV. Highest fuel bill of the everyday cars.' },
  { id: 'gt', energy: 'petrol', tank: 65, eff: 8, name: 'Mojidra GT', type: 'Sports car', model: 'sports', price: 4800000, fuel: 9000, maxKmh: 95, accel: 12, desc: 'Very fast and very expensive. Watch what it does to your net worth.' },
];

// Fuel and charging (illustrative city prices). tank: litres, kg of CNG or kWh; eff: km per unit.
export const FUEL = { petrol: { name: 'Petrol', unit: 'litre', price: 104 }, cng: { name: 'CNG', unit: 'kg', price: 77 }, ev: { name: 'Fast charging', unit: 'kWh', price: 22 } };
// FinVora is a compact city: one metre driven in the game counts as this many metres of real driving.
export const DRIVE_SCALE = 40;

export const CAR_LOAN = { rate: 0.09, minDownPct: 10, minMonths: 12, maxMonths: 84 }; // FinVora Bank, illustrative
export const INSURANCE_PCT = { default: 0.03, scooter: 0.025 }; // yearly premium as % of current value, illustrative

/** Resale value: about 15% lost in year one, then 10% a year (a simple illustrative schedule). */
export function carValue(price, years) {
  if (!(years > 0)) return price;
  return price * (1 - 0.15 * Math.min(years, 1)) * 0.9 ** Math.max(0, years - 1);
}

export const CLOTH_COLORS = [0xd4a846, 0x1f6f4a, 0x2e86de, 0xc0392b, 0xf2f2ee, 0x1b1d22, 0x7a3b52, 0xf08a3c, 0x6b5a7a, 0x8e7d5c];

// kind: top | bottom | acc. style maps to Character look fields.
export const CLOTHES = [
  { id: 'tshirt', name: 'Cotton T-shirt', kind: 'top', style: 'tshirt', price: 600 },
  { id: 'shirt', name: 'Classic shirt', kind: 'top', style: 'shirt', price: 1200 },
  { id: 'kurta', name: 'Kurta', kind: 'top', style: 'kurta', price: 1800 },
  { id: 'hoodie', name: 'Hoodie', kind: 'top', style: 'hoodie', price: 2200, outer: true },
  { id: 'jacket', name: 'Denim jacket', kind: 'top', style: 'jacket', price: 3500, outer: true },
  { id: 'saree', name: 'Saree', kind: 'top', style: 'saree', price: 4500, outer: true },
  { id: 'suit', name: 'Business suit', kind: 'top', style: 'suit', price: 12000, outer: true },
  { id: 'chinos', name: 'Chinos', kind: 'bottom', style: 'pants', price: 1800 },
  { id: 'jeans', name: 'Jeans', kind: 'bottom', style: 'pants', price: 2000 },
  { id: 'formal', name: 'Formal trousers', kind: 'bottom', style: 'pants', price: 2500 },
  { id: 'sneakers', name: 'Sneakers', kind: 'acc', style: 'shoes', price: 3500 },
  { id: 'cap', name: 'Cap', kind: 'acc', style: 'cap', price: 500 },
  { id: 'glasses', name: 'Sunglasses', kind: 'acc', style: 'glasses', price: 1500 },
  { id: 'watch', name: 'Watch', kind: 'acc', style: 'watch', price: 3000 },
  { id: 'bag', name: 'Backpack', kind: 'acc', style: 'bag', price: 1800 },
];

export const SKIN_TONES = [0xf1c9a5, 0xe0b48f, 0xc08a64, 0xa77450, 0x8d5a3b, 0x6b4128];
export const HAIR_COLORS = [0x15100c, 0x3b2a1e, 0x6b4a2b, 0xa07040, 0x9a9590, 0xd8c09a];
export const HAIR_STYLES = ['short', 'long', 'bob', 'bun'];
export const BODY_FORMS = [['m', 'Masculine'], ['f', 'Feminine']];
export const BUILDS = [['slim', 'Slim'], ['average', 'Average'], ['broad', 'Broad']];
export const HEIGHTS = [[0.95, 'Shorter'], [1, 'Average'], [1.05, 'Taller']];
export const FACIAL = [['none', 'Clean'], ['stubble', 'Stubble'], ['moustache', 'Moustache'], ['beard', 'Beard']];

export const carById = Object.fromEntries(CARS.map((c) => [c.id, c]));
export const clothById = Object.fromEntries(CLOTHES.map((c) => [c.id, c]));
