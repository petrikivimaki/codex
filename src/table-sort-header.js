import { createElement } from "./dom.js";

/**
 * Builds a keyboard-operable column header with paired direction indicators.
 *
 * @param {object} params Parameters.
 * @param {string} params.field Source field key.
 * @param {string} params.label Visible column name.
 * @param {{field: string, direction: "ascending"|"descending"}|null} params.sort Active sort.
 * @returns {HTMLElement} Column header.
 */
export function createSortHeader({ field, label, sort }) {
	const direction = sort?.field === field ? sort.direction : "none";
	const action = direction === "descending" ? `Restore source order (${label})` : `Sort ${label} ${direction === "ascending" ? "descending" : "ascending"}`;
	const header = createElement({ tag: "th", attributes: { scope: "col", "aria-sort": direction } });
	const button = createElement({ tag: "button", attributes: {
		type: "button", class: "table-sort-button", "data-sort-field": field, "aria-label": action, title: action
	} });
	const indicators = createElement({ tag: "span", attributes: { class: "table-sort-indicators", "aria-hidden": "true" } });
	indicators.append(
		createElement({ tag: "i", attributes: { class: "fa-solid fa-caret-up" } }),
		createElement({ tag: "i", attributes: { class: "fa-solid fa-caret-down" } })
	);
	button.append(createElement({ tag: "span", text: label }), indicators);
	header.append(button);
	return header;
}
