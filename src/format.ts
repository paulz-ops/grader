/** 'YYYY-MM-DD' → '17.11.' */
export function formatShortDate(date: string): string {
  const [, m, d] = date.split('-');
  return d && m ? `${d}.${m}.` : date;
}

/** 'YYYY-MM-DD' → '17.11.2026' */
export function formatDate(date: string): string {
  const [y, m, d] = date.split('-');
  return d && m && y ? `${d}.${m}.${y}` : date;
}

export function formatNumber(n: number): string {
  return n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
}

/** Akzeptiert "1,5" und "1.5"; null bei ungültiger Eingabe */
export function parseNumber(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

export function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}
