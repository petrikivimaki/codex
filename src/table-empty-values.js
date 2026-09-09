import { createElement } from "./dom.js";

/**
 * Identifies empty JSON values without treating zero, false, or sentinel text as empty.
 * Nonempty containers retain their contents even when every child is empty.
 *
 * @param {unknown} value Source value; undefined represents an absent field.
 * @returns {string} Accessible description, or an empty string for a populated value.
 */
export function getEmptyValueLabel(value) {
	if (value === undefined) {
		return "No data: missing value";
	}
	if (value === null) {
		return "No data: null value";
	}
	if (typeof value === "string" && value.trim().length === 0) {
		return value.length === 0 ? "No data: empty string" : "No data: whitespace-only string";
	}
	if (Array.isArray(value)) {
		return value.length === 0 ? "Empty array: 0 items" : "";
	}
	if (typeof value === "object" && Object.keys(value).length === 0) {
		return "Empty object: 0 properties";
	}
	return "";
}

/**
 * Creates a configurable empty-value indicator with its source meaning retained.
 *
 * @param {object} params Parameters.
 * @param {string} params.label Empty-value description.
 * @param {"blank"|"icon"} params.display Presentation preference.
 * @returns {HTMLElement} Accessible empty-value indicator.
 */
export function createEmptyValueMarker({ label, display }) {
	const marker = createElement({ tag: "span", attributes: { class: "table-empty-value", title: label } });

	if (display === "blank") {
		marker.append(createElement({ tag: "span", attributes: { class: "visually-hidden" }, text: label }));
	} else {
		marker.setAttribute("role", "img");
		marker.setAttribute("aria-label", label);
		marker.append(createElement({ tag: "i", attributes: { class: "fa-solid fa-minus", "aria-hidden": "true" } }));
	}

	return marker;
}
