import { createUrlValue } from "./table-url-values.js";
import { createElement } from "./dom.js";
import { createEmptyValueMarker, getEmptyValueLabel } from "./table-empty-values.js";
import { createBooleanValue } from "./table-boolean-values.js";

/**
 * Creates a plain cell or a preview that controls its record's detail row.
 *
 * @param {object} params Parameters.
 * @param {unknown} params.value Original JSON value.
 * @param {string} params.text Formatted cell text.
 * @param {string} params.label Field label.
 * @param {number} params.rowNumber Position in the displayed records.
 * @param {HTMLElement} params.recordRow Record row.
 * @param {HTMLElement} params.detailRow Shared detail row for this record.
 * @param {number} params.previewLength Character limit for inline values.
 * @param {"blank"|"icon"} params.emptyValueDisplay Empty-value presentation.
 * @param {"text"|"icon"} params.booleanValueDisplay Boolean presentation.
 * @returns {HTMLElement} Table cell.
 */
export function createTableCell({ value, text, label, rowNumber, recordRow, detailRow, previewLength, emptyValueDisplay, booleanValueDisplay }) {
	const cell = createElement({ tag: "td" });
	const emptyLabel = getEmptyValueLabel(value);

	if (emptyLabel) {
		cell.setAttribute("title", emptyLabel);
		cell.append(createEmptyValueMarker({ label: emptyLabel, display: emptyValueDisplay }));
		return cell;
	}

	if (typeof value === "boolean") {
		cell.append(createBooleanValue({ value, display: booleanValueDisplay }));
		return cell;
	}

	const isArray = Array.isArray(value);
	const summary = isArray ? getArraySummary({ items: value, previewLength }) : getTextSummary({ text, previewLength });
	const preview = isArray ? createArrayPreview({ ...summary, booleanValueDisplay }) : createElement({
		tag: "span",
		attributes: summary.expandable ? { class: "table-cell-preview" } : {},
	});
	if (!isArray) {
		preview.append(createUrlValue({ value, text: summary.text }));
	}

	if (!summary.expandable) {
		cell.append(preview);
		return cell;
	}

	cell.className = "table-cell--expandable";
	const button = createElement({
		tag: "button",
		attributes: {
			type: "button",
			class: "table-cell-toggle",
			"aria-expanded": "false",
			"aria-controls": detailRow.id
		}
	});
	button.append(
		createElement({ tag: "i", attributes: { class: "fa-solid fa-chevron-down", "aria-hidden": "true" } }),
		createElement({ tag: "span", attributes: { class: "table-cell-toggle-label" }, text: "Show more" }),
		createElement({ tag: "span", attributes: { class: "visually-hidden" }, text: ` ${label}, row ${rowNumber}` })
	);
	button.addEventListener("click", createDetailToggleHandler({ button, recordRow, detailRow, value, label, emptyValueDisplay, booleanValueDisplay }));
	cell.append(preview, button);
	return cell;
}

/**
 * Summarizes a scalar value using the configured character limit.
 *
 * @param {object} params Parameters.
 * @param {string} params.text Formatted value.
 * @param {number} params.previewLength Inline character limit.
 * @returns {{text: string, expandable: boolean}} Cell summary.
 */
function getTextSummary({ text, previewLength }) {
	const characters = Array.from(text);
	const expandable = characters.length > previewLength;

	return {
		text: expandable ? `${characters.slice(0, previewLength).join("").trimEnd()}…` : text,
		expandable
	};
}

/**
 * Shows a complete comma-separated array, its first item, or its item count.
 * Structured or empty items use a count so the expanded view retains every position.
 *
 * @param {object} params Parameters.
 * @param {Array<unknown>} params.items Array values.
 * @param {number} params.previewLength Inline character limit.
 * @returns {{text: string, expandable: boolean, items?: Array<unknown>}} Summary with source items when shown inline.
 */
function getArraySummary({ items, previewLength }) {
	const count = `${items.length} ${items.length === 1 ? "item" : "items"}`;
	const itemTexts = [];

	if (items.length === 0) {
		return { text: count, expandable: false };
	}

	for (const item of items) {
		if (getEmptyValueLabel(item) || (item !== null && typeof item === "object")) {
			return { text: count, expandable: true };
		}
		itemTexts.push(String(item));
	}

	const fullText = itemTexts.join(", ");

	if (Array.from(fullText).length <= previewLength) {
		return { text: fullText, expandable: false, items };
	}

	const firstText = itemTexts[0];
	const showFirst = firstText.trim().length > 0 && Array.from(firstText).length <= previewLength;

	return { text: showFirst ? firstText : count, expandable: true, items: showFirst ? [items[0]] : undefined };
}

/**
 * Preserves item types when rendering a comma-separated array preview.
 *
 * @param {object} params Parameters.
 * @param {string} params.text Fallback count label.
 * @param {Array<unknown>} [params.items] Source items retained by the summary.
 * @param {"text"|"icon"} params.booleanValueDisplay Boolean presentation.
 * @returns {HTMLElement} Inline array summary.
 */
function createArrayPreview({ text, items, booleanValueDisplay }) {
	const preview = createElement({ tag: "span", attributes: { class: "table-cell-array-summary" } });

	if (!items) {
		preview.textContent = text;
		return preview;
	}

	for (let index = 0; index < items.length; index += 1) {
		if (index > 0) {
			preview.append(", ");
		}
		const item = items[index];
		preview.append(typeof item === "boolean" ? createBooleanValue({ value: item, display: booleanValueDisplay }) : createUrlValue({ value: item }));
	}
	return preview;
}

/**
 * Creates a handler that opens one field at a time beneath a record.
 *
 * @param {object} params Parameters.
 * @param {HTMLElement} params.button Trigger button.
 * @param {HTMLElement} params.recordRow Record row.
 * @param {HTMLElement} params.detailRow Shared detail row.
 * @param {unknown} params.value Full JSON value.
 * @param {string} params.label Field label.
 * @param {"blank"|"icon"} params.emptyValueDisplay Empty-value presentation.
 * @param {"text"|"icon"} params.booleanValueDisplay Boolean presentation.
 * @returns {function(): void} Click handler.
 */
function createDetailToggleHandler({ button, recordRow, detailRow, value, label, emptyValueDisplay, booleanValueDisplay }) {
	/**
	 * Toggles the current field while keeping other records independent.
	 * @returns {void}
	 */
	return function handleDetailToggle() {
		const shouldOpen = button.getAttribute("aria-expanded") !== "true";

		for (const toggle of recordRow.querySelectorAll(".table-cell-toggle")) {
			const isOpen = shouldOpen && toggle === button;
			toggle.setAttribute("aria-expanded", String(isOpen));
			toggle.querySelector(".table-cell-toggle-label").textContent = isOpen ? "Show less" : "Show more";
		}

		detailRow.hidden = !shouldOpen;
		recordRow.classList.toggle("table-record--expanded", shouldOpen);
		const detailCell = detailRow.querySelector("td");
		detailCell.replaceChildren();

		if (shouldOpen) {
			detailCell.append(createDetailContent({ value, label, button, detailRow, emptyValueDisplay, booleanValueDisplay }));
		}
	};
}

/**
 * Builds a labeled, wrapping detail panel with an accessible close action.
 *
 * @param {object} params Parameters.
 * @param {unknown} params.value Full JSON value.
 * @param {string} params.label Field label.
 * @param {HTMLElement} params.button Original toggle.
 * @param {HTMLElement} params.detailRow Detail row.
 * @param {"blank"|"icon"} params.emptyValueDisplay Empty-value presentation.
 * @param {"text"|"icon"} params.booleanValueDisplay Boolean presentation.
 * @returns {HTMLElement} Detail content.
 */
function createDetailContent({ value, label, button, detailRow, emptyValueDisplay, booleanValueDisplay }) {
	const titleId = `${detailRow.id}-title`;
	const content = createElement({
		tag: "div",
		attributes: { class: "table-cell-detail", role: "group", "aria-labelledby": titleId }
	});
	const header = createElement({ tag: "div", attributes: { class: "table-cell-detail-header" } });
	const closeButton = createElement({
		tag: "button",
		attributes: { type: "button", class: "table-cell-detail-close", "aria-label": `Close ${label}` }
	});
	closeButton.append(createElement({ tag: "i", attributes: { class: "fa-solid fa-xmark", "aria-hidden": "true" } }));
	/**
	 * Closes the panel and returns keyboard focus to its trigger.
	 * @returns {void}
	 */
	function handleClose() {
		button.click();
		button.focus({ preventScroll: true });
	}
	closeButton.addEventListener("click", handleClose);
	header.append(createElement({ tag: "strong", attributes: { id: titleId }, text: label }), closeButton);
	content.append(header, createFullValue({ value, emptyValueDisplay, booleanValueDisplay }));
	return content;
}

/**
 * Preserves full strings and formats arrays as lists, using safe text nodes and detected HTTP(S) links.
 *
 * @param {object} params Parameters.
 * @param {unknown} params.value JSON value.
 * @param {"blank"|"icon"} params.emptyValueDisplay Empty-value presentation.
 * @param {"text"|"icon"} params.booleanValueDisplay Boolean presentation.
 * @returns {HTMLElement} Full value element.
 */
function createFullValue({ value, emptyValueDisplay, booleanValueDisplay }) {
	const emptyLabel = getEmptyValueLabel(value);

	if (emptyLabel) {
		return createEmptyValueMarker({ label: emptyLabel, display: emptyValueDisplay });
	}

	if (typeof value === "boolean") {
		return createBooleanValue({ value, display: booleanValueDisplay });
	}

	if (Array.isArray(value)) {
		const list = createElement({ tag: "ul", attributes: { class: "table-cell-detail-list" } });

		for (const item of value) {
			const listItem = createElement({ tag: "li" });
			listItem.append(createFullValue({ value: item, emptyValueDisplay, booleanValueDisplay }));
			list.append(listItem);
		}

		return list;
	}

	const content = createElement({ tag: "div", attributes: { class: "table-cell-detail-text" } });
	content.append(createUrlValue({ value, text: formatDetailValue(value) }));
	return content;
}

/**
 * Keeps strings verbatim and makes nested JSON values readable.
 *
 * @param {unknown} value JSON value.
 * @returns {string} Full text.
 */
function formatDetailValue(value) {
	return typeof value === "string" ? value : JSON.stringify(value, null, 2) ?? "";
}
