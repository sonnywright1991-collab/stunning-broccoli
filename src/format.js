// Number and time formatting. Pure functions, no DOM.
const SUFFIX = ['', 'K', 'M', 'B', 'T'];

function sci(n) {
  let exp = Math.floor(Math.log10(n));
  let m = parseFloat((n / Math.pow(10, exp)).toPrecision(3));
  if (m >= 10) { m = 1; exp += 1; }
  return m + 'e' + exp;
}

/** 0 -> "0", 12.3 -> "12.3", 1234 -> "1.23K", 4.5e6 -> "4.5M", 1.2e15 -> "1.2e15" */
export function fmt(n) {
  if (!Number.isFinite(n)) return n > 0 ? 'Infinity' : '0';
  if (n <= 0) return '0';
  if (n < 100) return String(parseFloat(n.toPrecision(3)));
  if (n < 1000) return String(Math.floor(n));
  if (n >= 1e15) return sci(n);
  let k = 0;
  let v = n;
  while (v >= 1000) { v /= 1000; k++; }
  let s = parseFloat(v.toPrecision(3));
  if (s >= 1000) { s = 1; k++; } // 999.95K rounds up to 1M
  if (k >= SUFFIX.length) return sci(n);
  return s + SUFFIX[k];
}

/** 7200 -> "2h 0m", 75 -> "1m 15s", 9 -> "9s" */
export function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return h + 'h ' + m + 'm';
  if (m > 0) return m + 'm ' + s + 's';
  return s + 's';
}
