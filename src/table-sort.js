import { getEmptyValueLabel } from "./table-empty-values.js";

const textCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/**
 * @typedef {object} SortKey
 * @property {number} rank Value type, with zero reserved for empty values.
 * @property {number|string|Array<SortKey>} value Comparable content.
 */

/**
 * Sorts a copy of filtered rows, inferring scalar formats from the full dataset.
 * Equal values retain source order; empty values stay last in both directions.
 *
 * @param {object} params Parameters.
 * @param {Array<Record<string, unknown>>} params.rows Rows in source order.
 * @param {Array<Record<string, unknown>>} params.sourceRows Full dataset for format inference.
 * @param {{field: string, direction: "ascending"|"descending"}|null} params.sort Active sort.
 * @returns {Array<Record<string, unknown>>} Ordered rows without source mutation.
 */
export function sortTableRows({ rows, sourceRows, sort }) {
	if (!sort) {
		return rows;
	}
	const format = getColumnFormat({ rows: sourceRows, field: sort.field });
	const entries = [];
	for (let index = 0; index < rows.length; index += 1) {
		entries.push({ row: rows[index], index, key: createSortKey({ value: rows[index][sort.field], format }) });
	}
	const direction = sort.direction === "descending" ? -1 : 1;
	/**
	 * Keeps ties stable regardless of the selected direction.
	 * @param {object} left First decorated row.
	 * @param {object} right Second decorated row.
	 * @returns {number} Comparison result.
	 */
	function compareEntries(left, right) {
		return compareKeys({ left: left.key, right: right.key, direction }) || left.index - right.index;
	}
	entries.sort(compareEntries);
	const result = [];
	for (const entry of entries) {
		result.push(entry.row);
	}
	return result;
}

/**
 * Infers dates or numeric strings only when every populated value agrees.
 *
 * @param {object} params Parameters.
 * @param {Array<Record<string, unknown>>} params.rows Complete dataset.
 * @param {string} params.field Column key.
 * @returns {"date"|"number"|"general"} Column interpretation.
 */
function getColumnFormat({ rows, field }) {
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
function isNumericValue(value) {
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
function getIsoTime(value) {
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

/**
 * Decorates full values once, keeping array contents independent of UI previews.
 *
 * @param {object} params Parameters.
 * @param {unknown} params.value JSON value.
 * @param {"date"|"number"|"general"} [params.format] Inferred column format.
 * @returns {SortKey} Comparable value.
 */
function createSortKey({ value, format = "general" }) {
	if (getEmptyValueLabel(value)) {
		return { rank: 0, value: "" };
	}
	if (format === "date") {
		return { rank: 1, value: getIsoTime(value) ?? 0 };
	}
	if (format === "number" || typeof value === "number") {
		return { rank: 1, value: Number(value) };
	}
	if (typeof value === "boolean") {
		return { rank: 2, value: Number(value) };
	}
	if (typeof value === "string") {
		return { rank: 3, value: value.trim() };
	}
	if (Array.isArray(value)) {
		const items = [];
		for (const item of value) {
			items.push(createSortKey({ value: item }));
		}
		return { rank: 4, value: items };
	}
	return { rank: 5, value: JSON.stringify(value) ?? "" };
}

/**
 * Compares like types naturally and mixed types by rank; empty values stay last.
 *
 * @param {object} params Parameters.
 * @param {SortKey} params.left First key.
 * @param {SortKey} params.right Second key.
 * @param {number} params.direction One for ascending, minus one for descending.
 * @returns {number} Comparison result.
 */
function compareKeys({ left, right, direction }) {
	if (!left.rank || !right.rank) {
		return left.rank === right.rank ? 0 : left.rank ? -1 : 1;
	}
	if (left.rank !== right.rank) {
		return (left.rank - right.rank) * direction;
	}
	if (typeof left.value === "number" && typeof right.value === "number") {
		return (left.value - right.value) * direction;
	}
	if (Array.isArray(left.value) && Array.isArray(right.value)) {
		const length = Math.min(left.value.length, right.value.length);
		for (let index = 0; index < length; index += 1) {
			const result = compareKeys({ left: left.value[index], right: right.value[index], direction });
			if (result) {
				return result;
			}
		}
		return (left.value.length - right.value.length) * direction;
	}
	return textCollator.compare(String(left.value), String(right.value)) * direction;
}
