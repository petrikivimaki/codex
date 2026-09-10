import { getEmptyValueLabel } from "./table-empty-values.js";
import { parseSearchQuery } from "./table-search-query.js";
import { getColumnFormat } from "./table-value-types.js";

/**
 * @typedef {import("./table-search-query.js").SearchClause} SearchClause
 * @typedef {{value: string|number|boolean, text: string}} SearchValue
 * @typedef {{populated: boolean, values: Array<SearchValue>}} SearchField
 * @typedef {{row: Record<string, unknown>, fields: Map<string, SearchField>, values: Array<SearchValue>}} SearchEntry
 * @typedef {{numericStrings: boolean, hasNumbers: boolean}} FieldFormat
 * @typedef {{rows: Array<Record<string, unknown>>, entries: Array<SearchEntry>, fields: Map<string, FieldFormat>}} RowSearchIndex
 * @typedef {SearchClause & {numericStrings: boolean}} CompiledClause
 */

/**
 * Prepares source values and full-column formats once when a dataset opens.
 *
 * @param {object} params Parameters.
 * @param {Array<Record<string, unknown>>} params.rows Complete source dataset.
 * @returns {RowSearchIndex} Searchable values independent of table presentation.
 */
export function createRowSearchIndex({ rows }) {
	/** @type {RowSearchIndex} */
	const index = { rows, entries: [], fields: new Map() };
	for (const row of rows) {
		/** @type {SearchEntry} */
		const entry = { row, fields: new Map(), values: [] };
		for (const field of Object.keys(row)) {
			const values = getSearchValues(row[field]);
			entry.fields.set(field, { populated: !getEmptyValueLabel(row[field]), values });
			const format = index.fields.get(field) ?? { numericStrings: false, hasNumbers: false };
			for (const value of values) {
				format.hasNumbers ||= typeof value.value === "number";
				entry.values.push(value);
			}
			index.fields.set(field, format);
		}
		index.entries.push(entry);
	}
	for (const [field, format] of index.fields) {
		format.numericStrings = getColumnFormat({ rows, field }) === "number";
		format.hasNumbers ||= format.numericStrings;
	}
	return index;
}

/**
 * Extracts scalar leaves without joining adjacent fields or array items.
 *
 * @param {unknown} source Source JSON value.
 * @returns {Array<SearchValue>} Normalized scalar values; property names are excluded.
 */
function getSearchValues(source) {
	const values = [];
	const pending = [source];
	while (pending.length) {
		const value = pending.pop();
		if (value === null || value === undefined) {
			continue;
		}
		if (typeof value === "object") {
			for (const child of Object.values(value)) {
				pending.push(child);
			}
		} else if (typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) {
			values.push({ value, text: String(value).toLowerCase() });
		}
	}
	return values;
}

/**
 * Compiles a complete query once and returns matching source row references.
 *
 * @param {object} params Parameters.
 * @param {RowSearchIndex} params.index Prepared full-dataset index.
 * @param {string} params.query Search input.
 * @returns {Array<Record<string, unknown>>} Matching rows in source order.
 * @throws {SyntaxError} For an invalid query, unknown field, or incompatible comparison.
 */
export function filterRows({ index, query }) {
	const clauses = [];
	for (const clause of parseSearchQuery(query)) {
		clauses.push(compileClause({ clause, fields: index.fields }));
	}
	if (!clauses.length) {
		return index.rows;
	}
	const rows = [];
	for (const entry of index.entries) {
		if (matchesEntry({ entry, clauses })) {
			rows.push(entry.row);
		}
	}
	return rows;
}

/**
 * Resolves field metadata and rejects unsupported numeric comparisons up front.
 *
 * @param {object} params Parameters.
 * @param {SearchClause} params.clause Parsed clause.
 * @param {Map<string, FieldFormat>} params.fields Complete dataset fields.
 * @returns {CompiledClause} Validated condition.
 */
function compileClause({ clause, fields }) {
	const format = clause.field === null ? undefined : fields.get(clause.field);
	if (clause.field !== null && !format) {
		throw new SyntaxError(`Unknown field: ${clause.field}.`);
	}
	if (clause.kind === "number" && clause.operator && !format?.hasNumbers) {
		throw new SyntaxError(`Field has no numeric values: ${clause.field}.`);
	}
	return { ...clause, numericStrings: format?.numericStrings ?? false };
}

/**
 * Requires every condition, negating each clause after any-item matching.
 *
 * @param {object} params Parameters.
 * @param {SearchEntry} params.entry Indexed row.
 * @param {Array<CompiledClause>} params.clauses Validated conditions.
 * @returns {boolean} Whether all conditions match.
 */
function matchesEntry({ entry, clauses }) {
	for (const clause of clauses) {
		const field = clause.field === null ? undefined : entry.fields.get(clause.field);
		const values = clause.field === null ? entry.values : field?.values ?? [];
		const matches = clause.kind === "populated" ? field?.populated ?? false : matchesValues({ values, clause });
		if (matches === clause.excluded) {
			return false;
		}
	}
	return true;
}

/**
 * Matches one complete scalar at a time, preserving strict boolean and string types.
 *
 * @param {object} params Parameters.
 * @param {Array<SearchValue>} params.values Scalar leaves of the selected scope.
 * @param {CompiledClause} params.clause Condition to evaluate.
 * @returns {boolean} Whether any scalar matches.
 */
function matchesValues({ values, clause }) {
	for (const { value, text } of values) {
		if (clause.kind === "number") {
			const number = typeof value === "number" ? value : clause.numericStrings && typeof value === "string" && value.trim() ? Number(value) : NaN;
			if (typeof clause.value === "number" && compareNumbers({ number, target: clause.value, operator: clause.operator })) {
				return true;
			}
		} else if (clause.kind === "boolean") {
			if (value === clause.value) {
				return true;
			}
		} else if (typeof clause.value === "string" && (clause.field === null || typeof value === "string")) {
			if (clause.kind === "exact" ? text === clause.value : text.includes(clause.value)) {
				return true;
			}
		}
	}
	return false;
}

/**
 * Compares finite numbers without truthiness or lexicographic coercion.
 *
 * @param {object} params Parameters.
 * @param {number} params.number Source number, or NaN for an ineligible value.
 * @param {number} params.target Parsed operand.
 * @param {string} params.operator Comparison operator; empty means equality.
 * @returns {boolean} Whether the numeric condition holds.
 */
function compareNumbers({ number, target, operator }) {
	if (!Number.isFinite(number)) {
		return false;
	}
	switch (operator) {
		case ">": return number > target;
		case ">=": return number >= target;
		case "<": return number < target;
		case "<=": return number <= target;
		default: return number === target;
	}
}
