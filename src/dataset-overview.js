import { clearElement, createElement } from "./dom.js";
import { hasCoordinateRows } from "./map-view.js";
import { getLongDescription } from "./dataset-descriptions.js";
import { appendDatasetAnnotations } from "./dataset-annotations.js";

/**
 * Renders the optional overview body and expanded footer facts.
 *
 * @param {object} params Parameters.
 * @param {HTMLElement} params.container Overview body.
 * @param {HTMLElement} params.labels Extra footer labels.
 * @param {object} params.dataset Dataset summary.
 * @param {object} params.data Loaded dataset.
 * @returns {void}
 */
export function renderDatasetOverview({ container, labels, dataset, data }) {
	const properties = data.properties;
	const description = getLongDescription({ properties, dataset });
	clearElement(container);
	clearElement(labels);
	if (description) {
		container.append(createElement({ tag: "p", attributes: { class: "metadata-description" }, text: description }));
	}
	appendDatasetAnnotations({ container, notes: properties.notes, sources: properties.sources });
	const format = getMetadataText(properties.format ?? dataset.format) || "JSON";
	const license = getMetadataText(properties.license ?? dataset.license) || "Unknown license";
	labels.append(
		createMetadataPill({ label: "Format", text: format.toUpperCase(), icon: "fa-file-code" }),
		createMetadataPill({ label: "License", text: license, icon: "fa-scale-balanced" }),
		createMetadataPill({ label: "Map support", text: hasCoordinateRows({ rows: data.data }) ? "Coordinates available" : "No coordinates", icon: "fa-location-dot" })
	);
	appendTags({ container: labels, tags: properties.tags ?? dataset.tags });
}

/**
 * Returns usable text for a scalar metadata value.
 *
 * @param {unknown} value Authored metadata.
 * @returns {string} Trimmed text or an empty string.
 */
function getMetadataText(value) {
	return typeof value === "string" ? value.trim() : "";
}

/**
 * Creates a footer pill with an accessible fact label.
 *
 * @param {object} params Parameters.
 * @param {string} params.label Fact name.
 * @param {string} params.text Visible value.
 * @param {string} params.icon Font Awesome icon class.
 * @returns {HTMLElement} Footer pill.
 */
function createMetadataPill({ label, text, icon }) {
	const pill = createElement({ tag: "div", attributes: { class: "status-pill", "aria-label": `${label}: ${text}`, title: `${label}: ${text}` } });
	pill.append(
		createElement({ tag: "i", attributes: { class: `fa-solid ${icon}`, "aria-hidden": "true" } }),
		createElement({ tag: "span", text })
	);
	return pill;
}

/**
 * Adds a separate wrapping tag row when usable tags exist.
 *
 * @param {object} params Parameters.
 * @param {HTMLElement} params.container Footer labels container.
 * @param {unknown} params.tags Authored tags.
 * @returns {void}
 */
function appendTags({ container, tags }) {
	if (!Array.isArray(tags)) {
		return;
	}
	const list = createElement({ tag: "ul", attributes: { class: "dataset-tags", "aria-label": "Tags" } });
	for (const tag of tags) {
		const text = getMetadataText(tag);
		if (text) {
			list.append(createElement({ tag: "li", text }));
		}
	}
	if (list.childElementCount) {
		container.append(list);
	}
}
