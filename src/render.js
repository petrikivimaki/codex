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
 * Renders a periodic table for the elements dataset.
 *
 * @param {object} params Parameters.
 * @param {HTMLElement} params.container Periodic table container.
 * @param {Array<object>} params.rows Element rows.
 * @returns {void}
 */
export function renderPeriodicTable({ container, rows }) {
	const elementsByAtomicNumber = getElementsByAtomicNumber({ rows });

	clearElement(container);

	if (elementsByAtomicNumber.size === 0) {
		container.appendChild(createElement({
			tag: "p",
			attributes: { class: "empty-state periodic-table__empty" },
			text: "No matching elements."
		}));
		return;
	}

	for (let period = 1; period <= 9; period += 1) {
		for (let group = 1; group <= 18; group += 1) {
			const atomicNumber = getAtomicNumberAtPosition({ period, group });
			const element = elementsByAtomicNumber.get(atomicNumber);

			if (element) {
				container.appendChild(createPeriodicTableElement({ element }));
			} else {
				container.appendChild(createElement({
					tag: "div",
					attributes: {
						class: "periodic-table__gap",
						"aria-hidden": "true"
					}
				}));
			}
		}
	}
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
	const description = createElement({ tag: "span", text: getDatasetDescription({ dataset }) });

	heading.appendChild(title);

	if (dataset.polity) {
		heading.appendChild(createFlagImage({ polity: dataset.polity }));
	}

	description.hidden = !isExpanded;

	button.append(heading, description);
	return button;
}

/**
 * Gets a sidebar dataset description with size context.
 *
 * @param {object} params Parameters.
 * @param {object} params.dataset Dataset summary.
 * @returns {string} Dataset description.
 */
function getDatasetDescription({ dataset }) {
	const datasetSize = getDatasetSize({ dataset });
	const description = dataset.description ?? "";

	if (!datasetSize) {
		return description;
	}

	return `N=${datasetSize} | ${description}`;
}

/**
 * Gets the dataset size from the generated index.
 *
 * @param {object} params Parameters.
 * @param {object} params.dataset Dataset summary.
 * @returns {string} Dataset size.
 */
function getDatasetSize({ dataset }) {
	const size = dataset.size;

	if (typeof size === "number" && Number.isFinite(size)) {
		return String(size);
	}

	if (typeof size === "string" && size.trim()) {
		return size.trim();
	}

	return "";
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
 * Gets element rows by atomic number.
 *
 * @param {object} params Parameters.
 * @param {Array<object>} params.rows Element rows.
 * @returns {Map<number, object>} Elements keyed by atomic number.
 */
function getElementsByAtomicNumber({ rows }) {
	const elementsByAtomicNumber = new Map();

	for (let index = 0; index < rows.length; index += 1) {
		const atomicNumber = Number(rows[index].z);

		if (Number.isInteger(atomicNumber) && atomicNumber >= 1 && atomicNumber <= 118) {
			elementsByAtomicNumber.set(atomicNumber, rows[index]);
		}
	}

	return elementsByAtomicNumber;
}

/**
 * Creates one periodic table element cell.
 *
 * @param {object} params Parameters.
 * @param {object} params.element Element row.
 * @returns {HTMLElement} Element cell.
 */
function createPeriodicTableElement({ element }) {
	const atomicNumber = formatCellValue(element.z);
	const symbol = formatCellValue(element.symbol);
	const name = formatCellValue(element.name);
	const cell = createElement({
		tag: "article",
		attributes: {
			class: "periodic-table__element",
			role: "listitem",
			title: `${atomicNumber} ${symbol} ${name}`.trim()
		}
	});
	const atomicNumberElement = createElement({
		tag: "span",
		attributes: { class: "periodic-table__atomic-number" },
		text: atomicNumber
	});
	const symbolElement = createElement({
		tag: "strong",
		attributes: { class: "periodic-table__symbol" },
		text: symbol
	});

	cell.append(atomicNumberElement, symbolElement);
	return cell;
}

/**
 * Gets the element atomic number at a periodic table position.
 *
 * @param {object} params Parameters.
 * @param {number} params.period Display row.
 * @param {number} params.group Display column.
 * @returns {number} Atomic number or 0.
 */
function getAtomicNumberAtPosition({ period, group }) {
	if (period === 1) {
		return group === 1 ? 1 : group === 18 ? 2 : 0;
	}

	if (period === 2) {
		return getAtomicNumberFromRanges({
			group,
			ranges: [
				{ startGroup: 1, startAtomicNumber: 3, endGroup: 2 },
				{ startGroup: 13, startAtomicNumber: 5, endGroup: 18 }
			]
		});
	}

	if (period === 3) {
		return getAtomicNumberFromRanges({
			group,
			ranges: [
				{ startGroup: 1, startAtomicNumber: 11, endGroup: 2 },
				{ startGroup: 13, startAtomicNumber: 13, endGroup: 18 }
			]
		});
	}

	if (period === 4) {
		return group + 18;
	}

	if (period === 5) {
		return group + 36;
	}

	if (period === 6) {
		return getAtomicNumberFromRanges({
			group,
			ranges: [
				{ startGroup: 1, startAtomicNumber: 55, endGroup: 2 },
				{ startGroup: 4, startAtomicNumber: 72, endGroup: 18 }
			]
		});
	}

	if (period === 7) {
		return getAtomicNumberFromRanges({
			group,
			ranges: [
				{ startGroup: 1, startAtomicNumber: 87, endGroup: 2 },
				{ startGroup: 4, startAtomicNumber: 104, endGroup: 18 }
			]
		});
	}

	if (period === 8 && group >= 3 && group <= 17) {
		return group + 54;
	}

	if (period === 9 && group >= 3 && group <= 17) {
		return group + 86;
	}

	return 0;
}

/**
 * Gets an atomic number from row ranges.
 *
 * @param {object} params Parameters.
 * @param {number} params.group Display column.
 * @param {Array<object>} params.ranges Period ranges.
 * @returns {number} Atomic number or 0.
 */
function getAtomicNumberFromRanges({ group, ranges }) {
	for (let index = 0; index < ranges.length; index += 1) {
		const range = ranges[index];

		if (group >= range.startGroup && group <= range.endGroup) {
			return range.startAtomicNumber + group - range.startGroup;
		}
	}

	return 0;
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
