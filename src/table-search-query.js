import { isNumericValue } from "./table-value-types.js";

/**
 * @typedef {object} SearchClause
 * @property {string|null} field Exact source key, or null for general text.
 * @property {boolean} excluded Whether to negate the whole clause.
 * @property {"text"|"exact"|"number"|"boolean"|"populated"} kind Matching mode.
 * @property {string|number|boolean} value Parsed operand.
 * @property {string} operator Comparison operator, or an empty string.
 */

/**
 * Parses an AND-only query without executing user-provided code.
 *
 * @param {string} query Search input.
 * @returns {Array<SearchClause>} Conditions to compile against dataset fields.
 * @throws {SyntaxError} For incomplete or unsupported query syntax.
 */
export function parseSearchQuery(query) {
	const clauses = [];
	for (const token of tokenizeQuery(query)) {
		clauses.push(parseClause(token));
	}
	return clauses;
}

/**
 * Splits on whitespace outside double quotes, retaining the first unquoted colon.
 *
 * @param {string} query Search input.
 * @returns {Array<{raw: string, colon: number}>} Complete clause tokens.
 */
function tokenizeQuery(query) {
	const tokens = [];
	let start = 0;
	let colon = -1;
	let quoted = false;
	let escaped = false;
	for (let index = 0; index <= query.length; index += 1) {
		const character = query[index];
		if (index === query.length || (!quoted && /\s/u.test(character))) {
			if (quoted) {
				throw new SyntaxError("Unclosed quoted value.");
			}
			if (index > start) {
				tokens.push({ raw: query.slice(start, index), colon });
			}
			start = index + 1;
			colon = -1;
			continue;
		}
		if (escaped) {
			escaped = false;
		} else if (quoted && character === "\\") {
			escaped = true;
		} else if (character === '"') {
			quoted = !quoted;
		} else if (!quoted && character === ":" && colon === -1) {
			colon = index - start;
		}
	}
	return tokens;
}

/**
 * Separates negation, field, operator, and operand for one condition.
 *
 * @param {{raw: string, colon: number}} token Token with an optional field delimiter.
 * @returns {SearchClause} Parsed condition.
 */
function parseClause({ raw, colon }) {
	const excluded = raw.startsWith("-") && !isNumericValue(raw);
	const source = excluded ? raw.slice(1) : raw;
	const delimiter = colon < 0 ? -1 : colon - Number(excluded);
	if (delimiter < 0) {
		if (/^(?:AND|OR|NOT)$/.test(source) || /^[<>=]/.test(source)) {
			throw new SyntaxError(`Unsupported search expression: ${source}.`);
		}
		const literal = readLiteral(source);
		return { field: null, excluded, kind: "text", value: literal.value.toLowerCase(), operator: "" };
	}
	const field = readLiteral(source.slice(0, delimiter)).value;
	const operand = source.slice(delimiter + 1);
	const operator = /^(?:>=|<=|>|<|=)/.exec(operand)?.[0] ?? "";
	const literal = readLiteral(operand.slice(operator.length));
	return { field, excluded, ...parseOperand({ literal, operator }) };
}

/**
 * Reads plain text or a complete JSON-style quoted string.
 *
 * @param {string} source Operand or field-key source.
 * @returns {{value: string, quoted: boolean}} Decoded literal.
 */
function readLiteral(source) {
	if (!source) {
		throw new SyntaxError("Missing field or value.");
	}
	if (source.startsWith('"')) {
		try {
			const value = JSON.parse(source);
			if (typeof value === "string" && value.trim()) {
				return { value, quoted: true };
			}
		} catch {
			throw new SyntaxError("Invalid quoted value.");
		}
		throw new SyntaxError("Empty quoted value.");
	}
	if (/["()]/.test(source) || /^[<>=]/.test(source)) {
		throw new SyntaxError(`Invalid unquoted value: ${source}.`);
	}
	return { value: source, quoted: false };
}

/**
 * Selects strict typed equality, text matching, presence, or numeric comparison.
 *
 * @param {object} params Parameters.
 * @param {{value: string, quoted: boolean}} params.literal Decoded operand.
 * @param {string} params.operator Optional comparison operator.
 * @returns {{kind: SearchClause["kind"], value: string|number|boolean, operator: string}} Matching mode.
 */
function parseOperand({ literal, operator }) {
	const { value, quoted } = literal;
	if (operator && operator !== "=") {
		if (quoted || !isNumericValue(value)) {
			throw new SyntaxError("Comparison requires a finite number.");
		}
		return { kind: "number", value: Number(value), operator };
	}
	if (operator === "=") {
		return { kind: "exact", value: value.toLowerCase(), operator };
	}
	if (!quoted && value === "*") {
		return { kind: "populated", value: true, operator };
	}
	if (!quoted && /^(true|false)$/i.test(value)) {
		return { kind: "boolean", value: value.toLowerCase() === "true", operator };
	}
	if (!quoted && isNumericValue(value)) {
		return { kind: "number", value: Number(value), operator };
	}
	return { kind: "text", value: value.toLowerCase(), operator };
}
