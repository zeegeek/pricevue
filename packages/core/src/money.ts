/** All money in PriceVue is stored as integer paise to avoid float drift. */
export type Paise = number;

const inrFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export function rupeesToPaise(rupees: number): Paise {
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: Paise): number {
  return paise / 100;
}

/** Formats paise as Indian rupees with Indian digit grouping, e.g. ₹1,29,999. */
export function formatINR(paise: Paise): string {
  return `₹${inrFormatter.format(Math.round(paise / 100))}`;
}

/** Compact form for axes: ₹62k, ₹1.3L. */
export function formatINRCompact(paise: Paise): string {
  const rupees = paise / 100;
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(1).replace(/\.0$/, "")}L`;
  if (rupees >= 1000) return `₹${Math.round(rupees / 1000)}k`;
  return `₹${Math.round(rupees)}`;
}

/** Parses user input like "59,999" or "₹ 59999" into paise. Returns null when empty/invalid. */
export function parseINRInput(input: string): Paise | null {
  const digits = input.replace(/[^\d]/g, "");
  if (!digits) return null;
  return rupeesToPaise(Number(digits));
}
