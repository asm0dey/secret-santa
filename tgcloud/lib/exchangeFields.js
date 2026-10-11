import { ERR, fail } from './errors.js';
import { validateBudget } from './budget.js';
import { isValidFutureDate, closeAtFor } from './dates.js';
import { clock } from './clock.js';

export function cleanName(name) {
  const n = typeof name === 'string' ? name.trim() : '';
  return n && n.length <= 60 ? n : fail(ERR.BAD_INPUT);
}

export const budgetColumns = (b) => {
  const v = validateBudget(b) ?? fail(ERR.BAD_INPUT);
  return { budgetKind: v.kind, budgetMin: v.min, budgetMax: v.max, currency: v.currency };
};

export const deadlineColumns = (d) =>
  isValidFutureDate(d, clock.now()) ? { deadline: d, closeAt: closeAtFor(d) } : fail(ERR.BAD_INPUT);

// DB row -> the budget object clients see (inverse of budgetColumns).
export const budgetOf = (ex) => ({ kind: ex.budgetKind, min: ex.budgetMin, max: ex.budgetMax, currency: ex.currency });
