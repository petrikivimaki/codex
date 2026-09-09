import { createElement } from "./dom.js";

/**
 * Presents an actual boolean as source text or a noninteractive, labeled icon.
 *
 * @param {object} params Parameters.
 * @param {boolean} params.value Source boolean.
 * @param {"text"|"icon"} params.display Presentation preference.
 * @returns {HTMLElement} Boolean value.
 */
export function createBooleanValue({ value, display }) {
	const text = String(value);

	if (display === "text") {
		return createElement({ tag: "span", text });
	}

	const marker = createElement({
		tag: "span",
		attributes: { class: "table-boolean-value", title: text, role: "img", "aria-label": text }
	});
	marker.append(createElement({
		tag: "i",
		attributes: { class: `fa-solid ${value ? "fa-check" : "fa-xmark"}`, "aria-hidden": "true" }
	}));
	return marker;
}
