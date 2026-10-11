const posInt = (n) => Number.isInteger(n) && n > 0;

export function validateBudget(b) {
  const { kind, min, max, currency } = b ?? {};
  if (kind === 'any') return { kind, min: null, max: null, currency: null };
  if (!['max', 'min', 'range'].includes(kind) || !/^[A-Z]{3}$/.test(currency ?? '')) return null;
  const needMin = kind !== 'max', needMax = kind !== 'min';
  if (needMin && !posInt(min)) return null;
  if (needMax && !posInt(max)) return null;
  if (kind === 'range' && min > max) return null;
  return { kind, min: needMin ? min : null, max: needMax ? max : null, currency };
}

const num = (n) => String(n).replace(/\B(?=(\d{3})+$)/g, ' ');

export function formatBudget(b, lang) {
  const ru = lang === 'ru';
  if (b.kind === 'any') return ru ? 'любой бюджет' : 'any budget';
  const cur = b.currency;
  if (b.kind === 'max') return `${ru ? 'до' : 'up to'} ${num(b.max)} ${cur}`;
  if (b.kind === 'min') return `${ru ? 'от' : 'from'} ${num(b.min)} ${cur}`;
  return `${num(b.min)}–${num(b.max)} ${cur}`;
}
