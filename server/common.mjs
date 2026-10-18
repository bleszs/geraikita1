export class ApiError extends Error {
  constructor(status, message, code = 'invalid_request') { super(message); this.status = status; this.code = code; }
}
export function requireValue(condition, message, status = 400, code) { if (!condition) throw new ApiError(status, message, code); }
export function dayAt(time = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(time));
  const find = type => parts.find(p => p.type === type).value;
  return `${find('year')}-${find('month')}-${find('day')}`;
}
export function addDays(day, days) { const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
export const units = quantity => Math.round(quantity * 10000);
export const quantity = value => value / 10000;
// Demo cashiering: accepted payment methods and the 10% platform application fee
// taken from each sale. The owner's balance accrues net = total - fee.
export const PAYMENT_METHODS = ['tunai', 'qris', 'transfer', 'ewallet'];
export const ADMIN_FEE_RATE = 0.1;
export const applicationFee = gross => Math.round(gross * ADMIN_FEE_RATE);
export function proportional(total, weights) {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (!sum) return weights.map(() => 0);
  const raw = weights.map(w => total * w / sum);
  const result = raw.map(Math.floor);
  const order = raw.map((w, i) => ({ i, fraction: w - result[i] })).sort((a, b) => b.fraction - a.fraction || a.i - b.i);
  for (let i = 0, left = total - result.reduce((s, n) => s + n, 0); i < left; i++) result[order[i].i]++;
  return result;
}
