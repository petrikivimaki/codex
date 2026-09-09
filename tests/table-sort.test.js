import test from "node:test";
import assert from "node:assert/strict";
import { sortTableRows } from "../src/table-sort.js";

/**
 * Sorts values through the public table API without modifying the fixture.
 * @param {Array<unknown>} values Source values.
 * @param {"ascending"|"descending"} [direction] Sort direction.
 * @returns {Array<number>} Original positions in sorted order.
 */
function positions(values, direction = "ascending") {
	const rows = [];
	for (let index = 0; index < values.length; index += 1) {
		rows.push({ id: index, value: values[index] });
	}
	const before = JSON.stringify(rows);
	const result = sortTableRows({ rows, sourceRows: rows, sort: { field: "value", direction } });
	assert.equal(JSON.stringify(rows), before);
	const ids = [];
	for (const row of result) {
		ids.push(row.id);
	}
	return ids;
}

/** Verifies numeric order, string numbers, and stable ties. */
function numericOrder() {
	assert.deepEqual(positions([10, 2, -3, 0, 2]), [2, 3, 1, 4, 0]);
	assert.deepEqual(positions([10, 2, -3, 0, 2], "descending"), [0, 1, 4, 3, 2]);
	assert.deepEqual(positions(["10", "-2.5", "-10", "2e2", 0]), [2, 1, 4, 0, 3]);
	assert.deepEqual(positions(["item 10", "Item 2", "item 1", "ITEM 2"]), [2, 1, 3, 0]);
	assert.deepEqual(positions(["002", "2", "001"]), [2, 0, 1]);
}
test("numeric and natural text ordering preserves source ties", numericOrder);

/** Verifies empty values remain last and false/zero remain populated. */
function emptyOrder() {
	const values = [null, 0, false, " ", [], {}, undefined, true, -1];
	assert.deepEqual(positions(values), [8, 1, 2, 7, 0, 3, 4, 5, 6]);
	assert.deepEqual(positions(values, "descending"), [7, 2, 1, 8, 0, 3, 4, 5, 6]);
	assert.deepEqual(positions([true, false, true, false]), [1, 3, 0, 2]);
}
test("empty values stay last in both directions without swallowing false or zero", emptyOrder);

/** Verifies timezone-aware chronology, equivalent instants, and calendar validation. */
function dateOrder() {
	const values = ["2020-01-01T00:30:00+02:00", "2019-12-31T23:00:00Z", "2019-12-31T22:30:00Z", "2020-01-01", "2019-12-31T22:45"];
	assert.deepEqual(positions(values), [0, 2, 4, 1, 3]);
	assert.deepEqual(positions(values, "descending"), [3, 1, 4, 0, 2]);
	assert.deepEqual(positions(["2020-02-29", "2019-02-28", "2000-02-29"]), [2, 1, 0]);
	// Invalid dates force the whole column to text, including offset timestamps.
	assert.deepEqual(positions([values[0], values[1], "2020-02-30"]), [1, 0, 2]);
	assert.deepEqual(positions([values[0], values[1], "1900-02-29"]), [2, 1, 0]);
	assert.deepEqual(positions([values[0], values[1], "2020-01-01T24:00:00Z"]), [1, 0, 2]);
}
test("ISO dates sort by instant without accepting invalid calendar dates", dateOrder);

/** Verifies full array contents and deterministic mixed-type ordering. */
function structuredOrder() {
	assert.deepEqual(positions([[2, 10], [2, 2], [1], [2], [], [2, 2]]), [2, 3, 1, 5, 0, 4]);
	assert.deepEqual(positions([[2, 10], [2, 2], [1], [2], []], "descending"), [0, 1, 3, 2, 4]);
	assert.deepEqual(positions([{ name: "item 10" }, { name: "item 2" }, [1], "a", false, 2]), [5, 4, 3, 2, 1, 0]);
}
test("arrays compare complete items and objects use their JSON text", structuredOrder);

/** Verifies filtering does not change format inference and reset retains source order. */
function filterAndReset() {
	const rows = [{ value: "2020-01-01T00:30:00+02:00" }, { value: "2019-12-31T23:00:00Z" }, { value: "not a date" }];
	const filtered = rows.slice(0, 2);
	assert.deepEqual(sortTableRows({ rows: filtered, sourceRows: rows, sort: { field: "value", direction: "ascending" } }), [rows[1], rows[0]]);
	assert.deepEqual(sortTableRows({ rows: filtered, sourceRows: rows, sort: null }), filtered);
	assert.deepEqual(sortTableRows({ rows: [], sourceRows: rows, sort: { field: "value", direction: "ascending" } }), []);
}
test("filtering retains full-column interpretation and reset returns source order", filterAndReset);
