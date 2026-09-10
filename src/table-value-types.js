import { getEmptyValueLabel } from "./table-empty-values.js";

/**
 * Infers dates or numeric strings only when every populated value agrees.
 *
 * @param {object} params Parameters.
 * @param {Array<Record<string, unknown>>} params.rows Complete dataset.
 * @param {string} params.field Column key.
 * @returns {"date"|"number"|"general"} Column interpretation.
 */
export function getColumnFormat({ rows, field }) {
	let dates = true;
	let numbers = true;
	let populated = false;
	for (const row of rows) {
		const value = row[field];
		if (getEmptyValueLabel(value)) {
			continue;
		}
		populated = true;
		dates = dates && getIsoTime(value) !== null;
		numbers = numbers && isNumericValue(value);
		if (!dates && !numbers) {
			return "general";
		}
	}
	return populated && dates ? "date" : populated && numbers ? "number" : "general";
}

/**
 * Accepts finite numbers and unambiguous numeric strings, preserving code-like text.
 *
 * @param {unknown} value Source value.
 * @returns {boolean} Whether numeric column inference can use the value.
 */
export function isNumericValue(value) {
	if (typeof value === "number") {
		return Number.isFinite(value);
	}
	return typeof value === "string" && /^[+-]?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(value.trim()) && Number.isFinite(Number(value));
}

/**
 * Parses calendar-valid ISO dates or timestamps with optional seconds and timezone.
 * Date-only and timezone-free timestamps use UTC for consistent ordering.
 *
 * @param {unknown} value Source value.
 * @returns {number|null} Epoch milliseconds or null for non-ISO/invalid dates.
 */
export function getIsoTime(value) {
	if (typeof value !== "string") {
		return null;
	}
	const text = value.trim();
	const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?)?$/i.exec(text);
	if (!match) {
		return null;
	}
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
	const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	if (month < 1 || month > 12 || day < 1 || day > days[month - 1] || Number(match[4] ?? 0) > 23 || Number(match[5] ?? 0) > 59 || Number(match[6] ?? 0) > 59) {
		return null;
	}
	const normalized = text.toUpperCase();
	const timestamp = Date.parse(match[4] && !match[8] ? `${normalized}Z` : normalized);
	return Number.isFinite(timestamp) ? timestamp : null;
}

