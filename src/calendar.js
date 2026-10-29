export const SUPPORTED_YEARS = Object.freeze([2026, 2027]);
export const DEFAULT_YEAR = SUPPORTED_YEARS[0];
const DAY_MS = 24 * 60 * 60 * 1000;

export function isIsoDate(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso;
}

export function isSupportedDate(iso) {
  return isIsoDate(iso) && SUPPORTED_YEARS.includes(Number(iso.slice(0, 4)));
}

export function getTodayDate(now = new Date()) {
  const year = now.getFullYear();
  if (!SUPPORTED_YEARS.includes(year)) return `${DEFAULT_YEAR}-01-01`;
  return `${year}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function getInitialDate(search, now = new Date()) {
  const iso = new URLSearchParams(search).get('date');
  return isSupportedDate(iso) ? iso : getTodayDate(now);
}

export function dateInYear(iso, year) {
  const [, month, day] = iso.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

export function getDaysInYear(year) {
  return (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / DAY_MS;
}

export function isoFromDayIndex(year, dayIndex) {
  return new Date(Date.UTC(year, 0, 1 + dayIndex)).toISOString().slice(0, 10);
}

export function dayIndexFromIso(iso) {
  const year = Number(iso.slice(0, 4));
  return (Date.parse(`${iso}T00:00:00Z`) - Date.UTC(year, 0, 1)) / DAY_MS;
}
