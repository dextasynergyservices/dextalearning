/** Compact number, e.g. 2143 → "2.1K". */
export function formatCompact(value: number): string {
	return new Intl.NumberFormat("en", {
		notation: "compact",
		maximumFractionDigits: 1,
	}).format(value);
}

/** Naira currency with no decimals, e.g. 12000 → "₦12,000". */
export function formatNgn(value: number): string {
	return new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency: "NGN",
		maximumFractionDigits: 0,
	}).format(value);
}

/** Localized short date, e.g. "7 Sep 2026". `locale` from i18n.resolvedLanguage. */
export function formatShortDate(iso: string, locale: string): string {
	return new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		year: "numeric",
	}).format(new Date(iso));
}
