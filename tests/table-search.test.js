import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRowSearchIndex, filterRows } from "../src/table-search.js";
import { sortTableRows } from "../src/table-sort.js";

/**
 * Finds original row positions through the same prepared index used by the app.
 * @param {Array<Record<string, unknown>>} rows Source rows.
 * @param {string} query Search input.
 * @returns {Array<number>} Matching source positions.
 */
function positions(rows, query) {
	const matches = filterRows({ index: createRowSearchIndex({ rows }), query });
	const result = [];
	for (const row of matches) {
		result.push(rows.indexOf(row));
	}
	return result;
}

/** Verifies AND terms, independent phrases, source text, and literal punctuation. */
function generalText() {
	const rows = [
		{ name: "John Adams", party: "Federalist", hidden: "Beyond the preview" },
		{ name: "John Quincy Adams", party: "Democratic-Republican" },
		{ first: "John", last: "Adams", year: 1800, active: false },
		{ value: "https://example.com/a?q=one:two", quote: 'He said "hello".', path: "C:\\data", signed: -80 }
	];
	assert.deepEqual(positions(rows, "  ADAMS\tjohn  "), [0, 1, 2]);
	assert.deepEqual(positions(rows, '"john adams"'), [0]);
	assert.deepEqual(positions(rows, "john federalist"), [0]);
	assert.deepEqual(positions(rows, '"beyond the preview"'), [0]);
	assert.deepEqual(positions(rows, "1800 false"), [2]);
	assert.deepEqual(positions(rows, '"https://example.com/a?q=one:two"'), [3]);
	assert.deepEqual(positions(rows, '"He said \\"hello\\"."'), [3]);
	assert.deepEqual(positions(rows, '"C:\\\\data"'), [3]);
	assert.deepEqual(positions(rows, "-80"), [3]);
	assert.deepEqual(positions(rows, "john -quincy"), [0, 2]);
	assert.deepEqual(positions(rows, '-"john adams"'), [1, 2, 3]);
}
test("general search combines terms and keeps phrases within scalar values", generalText);

/** Verifies substring versus whole-string equality and exact source field keys. */
function fieldText() {
	const rows = [
		{ party: "Republican", name: "Republican", "odd field:key": "a:b", label: "*" },
		{ party: "Democratic-Republican", name: "Other", "odd field:key": "a", label: "ordinary" },
		{ party: "Democratic", name: "Republican", label: "true" }
	];
	assert.deepEqual(positions(rows, "party:republican"), [0, 1]);
	assert.deepEqual(positions(rows, "party:=REPUBLICAN"), [0]);
	assert.deepEqual(positions(rows, 'party:="democratic-republican"'), [1]);
	assert.deepEqual(positions(rows, "-party:=Republican"), [1, 2]);
	assert.deepEqual(positions(rows, '"odd field:key":="a:b"'), [0]);
	assert.deepEqual(positions(rows, 'label:"*"'), [0]);
	assert.deepEqual(positions(rows, 'label:"true"'), [2]);
	/** Verifies property keys retain their source casing. */
	function wrongCase() {
		positions(rows, "Party:Republican");
	}
	assert.throws(wrongCase, /Unknown field/);
}
test("field text supports containment, exact values, quoted keys, and literal reserved operands", fieldText);

/** Verifies strict boolean types and the distinction between false and negation. */
function booleans() {
	const rows = [{ value: true }, { value: false }, { value: 0 }, { value: 1 }, { value: "false" }, { value: "true" }, {}, { value: null }];
	assert.deepEqual(positions(rows, "value:true"), [0]);
	assert.deepEqual(positions(rows, "value:FALSE"), [1]);
	assert.deepEqual(positions(rows, '-value:true'), [1, 2, 3, 4, 5, 6, 7]);
	assert.deepEqual(positions(rows, 'value:"false"'), [4]);
	assert.deepEqual(positions(rows, "value:=true"), [5]);
	assert.deepEqual(positions(rows, "value:0"), [2]);
}
test("boolean and numeric equality never coerce false, zero, strings, or absent data", booleans);

/** Verifies every numeric operator, numeric strings, and stable column inference. */
function numbers() {
	const rows = [{ value: -80.5 }, { value: 0 }, { value: 2 }, { value: 10 }, { value: 20 }, { value: null }, {}, { value: " " }];
	assert.deepEqual(positions(rows, "value:2"), [2]);
	assert.deepEqual(positions(rows, "value:>2"), [3, 4]);
	assert.deepEqual(positions(rows, "value:>=2"), [2, 3, 4]);
	assert.deepEqual(positions(rows, "value:<2"), [0, 1]);
	assert.deepEqual(positions(rows, "value:<=2"), [0, 1, 2]);
	assert.deepEqual(positions(rows, "value:<-80"), [0]);
	assert.deepEqual(positions(rows, "value:>=0 value:<2e1"), [1, 2, 3]);
	assert.deepEqual(positions(rows, "value:>=20 value:<0"), []);
	assert.deepEqual(positions(rows, "-value:>2"), [0, 1, 2, 5, 6, 7]);
	const strings = [{ value: "10" }, { value: "2" }, { value: "-2.5" }, { value: 0 }, { value: "" }];
	assert.deepEqual(positions(strings, "value:>2"), [0]);
	assert.deepEqual(positions(strings, "value:2"), [1]);
	assert.deepEqual(positions(strings, 'value:"2"'), [1, 2]);
	assert.deepEqual(positions(strings, "value:=2"), [1]);
	const mixed = [{ value: "10", name: "keep" }, { value: 2, name: "keep" }, { value: "code", name: "skip" }];
	assert.deepEqual(positions(mixed, "name:keep value:>0"), [1]);
	assert.deepEqual(positions([{ value: "002" }, { value: "2" }, { value: 2 }], "value:2"), [2]);
	assert.deepEqual(positions([{ value: "002" }, { value: "2" }, { value: 2 }], 'value:="002"'), [0]);
}
test("numeric comparisons support signs and decimals without changing full-column interpretation", numbers);

/** Verifies presence uses the table's existing empty-value semantics. */
function emptyValues() {
	const rows = [{}, { value: null }, { value: "" }, { value: " \t" }, { value: [] }, { value: {} }, { value: 0 }, { value: false }, { value: "null" }, { value: [null] }, { value: { child: null } }];
	assert.deepEqual(positions(rows, "value:*"), [6, 7, 8, 9, 10]);
	assert.deepEqual(positions(rows, "-value:*"), [0, 1, 2, 3, 4, 5]);
	assert.deepEqual(positions(rows, "value:null"), [8]);
	assert.deepEqual(positions(rows, "value:0"), [6]);
	assert.deepEqual(positions(rows, "value:false"), [7]);
}
test("empty checks preserve zero, false, sentinel strings, and nonempty containers", emptyValues);

/** Verifies any-item semantics, nested values, and negating the whole field. */
function nestedValues() {
	const rows = [
		{ authors: ["Robert Ludlum", "Eric Van Lustbader"], details: { secretKey: "Nested content", deeper: { value: 4 } }, flags: [false, true], numbers: [1, 20] },
		{ authors: ["Robert", "Ludlum"], flags: [false], numbers: ["20"] },
		{ authors: ["Someone else"], details: { value: "Other" } }
	];
	assert.deepEqual(positions(rows, 'authors:"Robert Ludlum"'), [0]);
	assert.deepEqual(positions(rows, 'authors:="Robert Ludlum"'), [0]);
	assert.deepEqual(positions(rows, '-authors:"Robert Ludlum"'), [1, 2]);
	assert.deepEqual(positions(rows, "robert ludlum"), [0, 1]);
	assert.deepEqual(positions(rows, '"nested content"'), [0]);
	assert.deepEqual(positions(rows, "secretKey"), []);
	assert.deepEqual(positions(rows, "details:nested"), [0]);
	assert.deepEqual(positions(rows, "details:>3"), [0]);
	assert.deepEqual(positions(rows, "flags:true"), [0]);
	assert.deepEqual(positions(rows, "-flags:true"), [1, 2]);
	assert.deepEqual(positions(rows, "numbers:>10"), [0]);
	assert.deepEqual(positions(rows, 'numbers:="20"'), [1]);
}
test("arrays and objects search scalar leaves without cross-item phrases or coercion", nestedValues);

/** Verifies invalid syntax cannot silently narrow or broaden a valid query. */
function invalidQueries() {
	const rows = [{ year: 2000, name: "John", boolean: false }];
	const queries = [
		"year:", "year:>", "year:=>2", "year:>>2", 'year:>"2"', "year:>NaN", "year:>Infinity", "year:>1e309", "year:>2years",
		"unknown:2000", "name:John unknown:value", "-unknown:*", "name:>2", "boolean:>0", '"unclosed', 'name:"John',
		'name:"John"extra', 'name:Jo"hn"', 'name:"bad\\q"', "-", ":value", 'name:""', 'name:" "',
		"John OR Paul", "John AND Paul", "NOT John", "(John)", ">2000"
	];
	for (const query of queries) {
		/** Verifies the current invalid query is rejected atomically. */
		function runQuery() {
			positions(rows, query);
		}
		assert.throws(runQuery, SyntaxError, query);
	}
}
test("malformed queries, unknown fields, and unsupported comparisons are rejected", invalidQueries);

/** Verifies row references, empty results, field discovery, sorting, and source immutability. */
function integration() {
	const rows = [{ name: "first", year: 2000 }, { name: "second", year: 1990, later: true }];
	const before = JSON.stringify(rows);
	const index = createRowSearchIndex({ rows });
	assert.equal(filterRows({ index, query: " \t" }), rows);
	assert.deepEqual(filterRows({ index, query: "later:true" }), [rows[1]]);
	assert.deepEqual(filterRows({ index, query: "year:>3000" }), []);
	assert.deepEqual(filterRows({ index, query: "year:>=1990" }), rows);
	const matches = filterRows({ index, query: "year:>=1990" });
	assert.deepEqual(sortTableRows({ rows: matches, sourceRows: rows, sort: { field: "year", direction: "ascending" } }), [rows[1], rows[0]]);
	assert.equal(matches[0], rows[0]);
	assert.equal(JSON.stringify(rows), before);
	assert.deepEqual(filterRows({ index: createRowSearchIndex({ rows: [] }), query: "anything" }), []);
}
test("search preserves original rows, source order, later fields, and sorting behavior", integration);

/** Verifies the intended composed query against the current working dataset. */
function presidents() {
	const { data: rows } = JSON.parse(readFileSync(new URL("../data/us-presidents-new.json", import.meta.url), "utf8"));
	const index = createRowSearchIndex({ rows });
	const matches = filterRows({ index, query: "termStart:>=1900 termStart:<2000 wasImpeached:true" });
	assert.equal(matches.length, 1);
	assert.equal(matches[0].name, "Bill Clinton");
	assert.equal(filterRows({ index, query: "wasImpeached:true" }).length, 3);
	assert.equal(filterRows({ index, query: "wasImpeached:false" }).length, 44);
	assert.equal(filterRows({ index, query: "notes:*" }).length, 2);
}
test("composed field, interval, boolean, and presence filters work on presidents", presidents);
