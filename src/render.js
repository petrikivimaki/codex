import { clearElement, createElement } from "./dom.js";
import { hasCoordinateRows } from "./map-view.js";

/**
 * Renders dataset suggestions.
 *
 * @param {object} params Parameters.
 * @param {HTMLElement} params.container Suggestions container.
 * @param {Array<object>} params.datasets Dataset summaries.
 * @param {string} params.activeDatasetId Active dataset ID.
 * @param {string} params.expandedDatasetId Expanded dataset ID.
 * @param {Function} params.onPreview Preview handler.
 * @param {Function} params.onSelect Selection handler.
 * @returns {void}
 */
export function renderSuggestions({ container, datasets, activeDatasetId = "", expandedDatasetId = "", onPreview, onSelect }) {
	clearElement(container);

	for (let index = 0; index < datasets.length; index += 1) {
		const dataset = datasets[index];
		const isExpanded = dataset.id === expandedDatasetId;
		const button = createDatasetButton({
			dataset,
			className: "suggestion-button",
			role: "option",
			isExpanded
		});
		const isActive = dataset.id === activeDatasetId;

		button.classList.toggle("is-active", isActive);
		button.classList.toggle("is-expanded", isExpanded);
		button.setAttribute("aria-selected", String(isActive));
		button.setAttribute("aria-expanded", String(isExpanded));
		button.addEventListener("click", createDatasetClickHandler({
			dataset,
			isExpanded,
			onPreview,
			onSelect
		}));
		container.appendChild(button);
	}
}

/**
 * Renders metadata details.
 *
 * @param {object} params Parameters.
 * @param {HTMLElement} params.container Metadata container.
 * @param {object} params.dataset Dataset summary.
 * @param {object} params.data Full dataset.
 * @returns {void}
 */
export function renderMetadata({ container, dataset, data }) {
	const properties = data.properties;
	const rows = data.data;
	const metadataItems = [
		["Description", properties.description ?? dataset.description],
		["Category", properties.category ?? dataset.category],
		["Tags", (properties.tags ?? dataset.tags ?? []).join(", ")],
		["Format", properties.format?.toUpperCase() ?? dataset.format?.toUpperCase() ?? "JSON"],
		["Source", properties.source ?? dataset.source ?? "Remote"],
		["License", properties.license ?? dataset.license ?? "Unknown"],
		["Map support", hasCoordinateRows({ rows }) ? "Coordinates available" : "No coordinates"],
		["Rows", String(rows.length)]
	];

	clearElement(container);

	for (let index = 0; index < metadataItems.length; index += 1) {
		const [label, value] = metadataItems[index];
		const item = createElement({
			tag: "div",
			attributes: { class: label === "Description" ? "metadata-item metadata-item--wide" : "metadata-item" }
		});
		const labelElement = createElement({ tag: "strong", text: label });
		const valueElement = createElement({ tag: "span", text: value });

		item.append(labelElement, valueElement);
		container.appendChild(item);
	}
}

/**
 * Renders a data table.
 *
 * @param {object} params Parameters.
 * @param {HTMLTableElement} params.table Table element.
 * @param {Array<object>} params.rows Dataset rows.
 * @returns {void}
 */
export function renderTable({ table, rows }) {
	clearElement(table);

	if (rows.length === 0) {
		const tbody = createElement({ tag: "tbody" });
		const row = createElement({ tag: "tr" });
		const cell = createElement({
			tag: "td",
			attributes: { colspan: "1" },
			text: "No matching rows."
		});

		row.appendChild(cell);
		tbody.appendChild(row);
		table.appendChild(tbody);
		return;
	}

	const columns = Object.keys(rows[0]);
	const thead = createElement({ tag: "thead" });
	const headerRow = createElement({ tag: "tr" });
	const tbody = createElement({ tag: "tbody" });

	for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
		headerRow.appendChild(createElement({ tag: "th", text: toTitleCase(columns[columnIndex]) }));
	}

	thead.appendChild(headerRow);

	for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
		const row = createElement({ tag: "tr" });

		for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
			const value = rows[rowIndex][columns[columnIndex]];
			row.appendChild(createElement({ tag: "td", text: formatCellValue(value) }));
		}

		tbody.appendChild(row);
	}

	table.append(thead, tbody);
}

/**
 * Creates a dataset selection button.
 *
 * @param {object} params Parameters.
 * @param {object} params.dataset Dataset summary.
 * @param {string} params.className Button class.
 * @param {string} [params.role] Optional ARIA role.
 * @param {boolean} params.isExpanded Whether the card is expanded.
 * @returns {HTMLButtonElement} Dataset button.
 */
function createDatasetButton({ dataset, className, role = "", isExpanded = false }) {
	const attributes = { class: className, type: "button" };

	if (role) {
		attributes.role = role;
	}

	const button = createElement({
		tag: "button",
		attributes
	});
	const heading = createElement({ tag: "div", attributes: { class: "suggestion-button__heading" } });
	const title = createElement({ tag: "strong", text: dataset.name });
	const description = createElement({ tag: "span", text: dataset.description });

	heading.appendChild(title);

	if (dataset.polity) {
		heading.appendChild(createFlagImage({ polity: dataset.polity }));
	}

	description.hidden = !isExpanded;

	button.append(heading, description);
	return button;
}

/**
 * Creates a polity flag image.
 *
 * @param {object} params Parameters.
 * @param {string} params.polity ISO 3166-1 alpha-2 code.
 * @returns {HTMLImageElement} Flag image.
 */
function createFlagImage({ polity }) {
	const normalizedPolity = polity.trim().toUpperCase();

	return createElement({
		tag: "img",
		attributes: {
			class: "dataset-flag",
			src: `images/flags/${normalizedPolity}.png`,
			alt: "",
			loading: "lazy",
			height: "18"
		}
	});
}

/**
 * Creates a dataset card click handler.
 *
 * @param {object} params Parameters.
 * @param {object} params.dataset Dataset summary.
 * @param {boolean} params.isExpanded Whether the card is expanded.
 * @param {Function} params.onPreview Preview handler.
 * @param {Function} params.onSelect Selection handler.
 * @returns {Function} Click handler.
 */
function createDatasetClickHandler({ dataset, isExpanded, onPreview, onSelect }) {
	return function handleDatasetCardClick() {
		if (isExpanded) {
			onSelect({ dataset });
			return;
		}

		onPreview({ dataset });
	};
}

/**
 * Formats table cells.
 *
 * @param {unknown} value Cell value.
 * @returns {string} Formatted value.
 */
function formatCellValue(value) {
	if (value === null || value === undefined) {
		return "";
	}

	if (typeof value === "object") {
		return JSON.stringify(value);
	}

	return String(value);
}

/**
 * Converts camelCase-ish keys to labels.
 *
 * @param {string} value Raw value.
 * @returns {string} Title-cased label.
 */
function toTitleCase(value) {
	return value
		.replace(/([A-Z])/g, " $1")
		.replace(/^./, uppercaseCharacter);
}

/**
 * Uppercases one character.
 *
 * @param {string} character Character.
 * @returns {string} Uppercase character.
 */
function uppercaseCharacter(character) {
	return character.toUpperCase();
}
