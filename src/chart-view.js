const chartInstances = new WeakMap();
const defaultBubbleRadius = 5;
const maxBubbleRadius = 24;
const minBubbleRadius = 4;

/**
 * Gets the default graph fields for a dataset.
 *
 * @param {object} params Parameters.
 * @param {Array<object>} params.rows Dataset rows.
 * @returns {object} Default field selection.
 */
export function getDefaultChartFields({ rows }) {
	const numericFields = getNumericFields({ rows });

	return {
		xField: numericFields[0] ?? "",
		yField: numericFields[1] ?? "",
		zField: numericFields[2] ?? ""
	};
}

/**
 * Renders a dataset graph.
 *
 * @param {object} params Parameters.
 * @param {HTMLElement} params.controls Controls container.
 * @param {HTMLCanvasElement} params.canvas Chart canvas.
 * @param {HTMLElement} params.emptyState Empty state element.
 * @param {Array<object>} params.rows Dataset rows.
 * @param {object} params.fields Selected fields.
 * @returns {void}
 */
export function renderChart({ controls, canvas, emptyState, rows, fields }) {
	const numericFields = getNumericFields({ rows });
	const selectedFields = normalizeSelectedFields({
		fields,
		numericFields
	});
	const chartRows = getChartRows({
		rows,
		fields: selectedFields
	});
	const canRenderChart = Boolean(window.Chart) && numericFields.length >= 2 && chartRows.length > 0;

	emptyState.textContent = getEmptyStateText({
		hasChart: Boolean(window.Chart),
		numericFieldCount: numericFields.length,
		chartRowCount: chartRows.length
	});
	renderChartControls({
		controls,
		numericFields,
		fields: selectedFields
	});

	emptyState.hidden = canRenderChart;
	canvas.parentElement.hidden = !canRenderChart;

	if (!canRenderChart) {
		destroyChart({ canvas });
		return;
	}

	renderChartInstance({
		canvas,
		rows: chartRows,
		fields: selectedFields
	});
}

/**
 * Gets numeric object keys from dataset rows.
 *
 * @param {object} params Parameters.
 * @param {Array<object>} params.rows Dataset rows.
 * @returns {Array<string>} Numeric fields.
 */
export function getNumericFields({ rows }) {
	const fieldCounts = new Map();

	for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
		const row = rows[rowIndex];
		const entries = Object.entries(row);

		for (let entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
			const [field, value] = entries[entryIndex];

			if (Number.isFinite(getNumericValue(value))) {
				fieldCounts.set(field, (fieldCounts.get(field) ?? 0) + 1);
			}
		}
	}

	return Array.from(fieldCounts.keys());
}

/**
 * Renders graph controls.
 *
 * @param {object} params Parameters.
 * @param {HTMLElement} params.controls Controls container.
 * @param {Array<string>} params.numericFields Numeric fields.
 * @param {object} params.fields Selected fields.
 * @returns {void}
 */
function renderChartControls({ controls, numericFields, fields }) {
	const fieldsFragment = document.createDocumentFragment();

	controls.replaceChildren();

	fieldsFragment.appendChild(createFieldSelect({
		id: "graph-x-field",
		name: "xField",
		label: "X axis",
		numericFields,
		selectedField: fields.xField,
		includeEmptyOption: false
	}));
	fieldsFragment.appendChild(createFieldSelect({
		id: "graph-y-field",
		name: "yField",
		label: "Y axis",
		numericFields,
		selectedField: fields.yField,
		includeEmptyOption: false
	}));
	fieldsFragment.appendChild(createFieldSelect({
		id: "graph-z-field",
		name: "zField",
		label: "Bubble size",
		numericFields,
		selectedField: fields.zField,
		includeEmptyOption: true
	}));

	controls.appendChild(fieldsFragment);
}

/**
 * Creates a field select control.
 *
 * @param {object} params Parameters.
 * @param {string} params.id Select ID.
 * @param {string} params.name Select name.
 * @param {string} params.label Select label.
 * @param {Array<string>} params.numericFields Numeric fields.
 * @param {string} params.selectedField Selected field.
 * @param {boolean} params.includeEmptyOption Whether to include a blank option.
 * @returns {HTMLLabelElement} Select label element.
 */
function createFieldSelect({ id, name, label, numericFields, selectedField, includeEmptyOption }) {
	const labelElement = document.createElement("label");
	const labelText = document.createElement("span");
	const select = document.createElement("select");

	labelElement.className = "graph-field";
	labelText.textContent = label;
	select.id = id;
	select.name = name;
	select.disabled = numericFields.length === 0 || (!includeEmptyOption && numericFields.length < 2);

	if (includeEmptyOption) {
		select.appendChild(createOption({
			value: "",
			text: "None",
			isSelected: !selectedField
		}));
	}

	for (let index = 0; index < numericFields.length; index += 1) {
		const field = numericFields[index];
		select.appendChild(createOption({
			value: field,
			text: toTitleCase(field),
			isSelected: field === selectedField
		}));
	}

	labelElement.append(labelText, select);
	return labelElement;
}

/**
 * Creates a select option.
 *
 * @param {object} params Parameters.
 * @param {string} params.value Option value.
 * @param {string} params.text Option label.
 * @param {boolean} params.isSelected Whether the option is selected.
 * @returns {HTMLOptionElement} Option element.
 */
function createOption({ value, text, isSelected }) {
	const option = document.createElement("option");

	option.value = value;
	option.textContent = text;
	option.selected = isSelected;

	return option;
}

/**
 * Normalizes selected fields against available numeric fields.
 *
 * @param {object} params Parameters.
 * @param {object} params.fields Selected fields.
 * @param {Array<string>} params.numericFields Numeric fields.
 * @returns {object} Normalized fields.
 */
function normalizeSelectedFields({ fields, numericFields }) {
	const xField = numericFields.includes(fields.xField) ? fields.xField : numericFields[0] ?? "";
	const yField = numericFields.includes(fields.yField) ? fields.yField : getFallbackYField({
		xField,
		numericFields
	});
	const zField = numericFields.includes(fields.zField) ? fields.zField : "";

	return { xField, yField, zField };
}

/**
 * Gets a fallback y-axis field that differs from the x-axis field when possible.
 *
 * @param {object} params Parameters.
 * @param {string} params.xField X-axis field.
 * @param {Array<string>} params.numericFields Numeric fields.
 * @returns {string} Fallback field.
 */
function getFallbackYField({ xField, numericFields }) {
	for (let index = 0; index < numericFields.length; index += 1) {
		if (numericFields[index] !== xField) {
			return numericFields[index];
		}
	}

	return "";
}

/**
 * Gets rows that can be plotted.
 *
 * @param {object} params Parameters.
 * @param {Array<object>} params.rows Dataset rows.
 * @param {object} params.fields Selected fields.
 * @returns {Array<object>} Chart rows.
 */
function getChartRows({ rows, fields }) {
	const chartRows = [];
	const zValues = getZValues({
		rows,
		zField: fields.zField
	});

	for (let index = 0; index < rows.length; index += 1) {
		const row = rows[index];
		const xValue = getNumericValue(row[fields.xField]);
		const yValue = getNumericValue(row[fields.yField]);

		if (!Number.isFinite(xValue) || !Number.isFinite(yValue)) {
			continue;
		}

		chartRows.push({
			x: xValue,
			y: yValue,
			r: fields.zField ? getBubbleRadius({
				value: getNumericValue(row[fields.zField]),
				values: zValues
			}) : defaultBubbleRadius,
			raw: row
		});
	}

	return chartRows;
}

/**
 * Renders the Chart.js instance.
 *
 * @param {object} params Parameters.
 * @param {HTMLCanvasElement} params.canvas Chart canvas.
 * @param {Array<object>} params.rows Chart rows.
 * @param {object} params.fields Selected fields.
 * @returns {void}
 */
function renderChartInstance({ canvas, rows, fields }) {
	const chart = chartInstances.get(canvas);
	const theme = getChartTheme();
	const config = {
		type: fields.zField ? "bubble" : "scatter",
		data: {
			datasets: [{
				label: getChartLabel({ fields }),
				data: rows,
				backgroundColor: theme.pointBackgroundColor,
				borderColor: theme.pointBorderColor,
				borderWidth: 1,
				pointHoverRadius: getPointHoverRadius,
				pointRadius: getPointRadius
			}]
		},
		options: {
			animation: false,
			maintainAspectRatio: false,
			plugins: {
				legend: {
					display: false
				},
				tooltip: {
					callbacks: {
						label: createTooltipLabel
					}
				}
			},
			scales: {
				x: createScaleOptions({
					label: toTitleCase(fields.xField),
					theme
				}),
				y: createScaleOptions({
					label: toTitleCase(fields.yField),
					theme
				})
			}
		}
	};

	if (chart) {
		chart.destroy();
	}

	chartInstances.set(canvas, new window.Chart(canvas, config));
}

/**
 * Destroys the chart for a canvas.
 *
 * @param {object} params Parameters.
 * @param {HTMLCanvasElement} params.canvas Chart canvas.
 * @returns {void}
 */
function destroyChart({ canvas }) {
	const chart = chartInstances.get(canvas);

	if (!chart) {
		return;
	}

	chart.destroy();
	chartInstances.delete(canvas);
}

/**
 * Creates chart scale options.
 *
 * @param {object} params Parameters.
 * @param {string} params.label Axis label.
 * @param {object} params.theme Chart colors.
 * @returns {object} Scale options.
 */
function createScaleOptions({ label, theme }) {
	return {
		grid: {
			color: theme.gridColor
		},
		ticks: {
			color: theme.textColor
		},
		title: {
			display: true,
			text: label,
			color: theme.textColor
		}
	};
}

/**
 * Gets chart colors from CSS variables.
 *
 * @returns {object} Chart colors.
 */
function getChartTheme() {
	const styles = window.getComputedStyle(document.documentElement);

	return {
		gridColor: styles.getPropertyValue("--color-border").trim(),
		pointBackgroundColor: styles.getPropertyValue("--color-focus-ring").trim(),
		pointBorderColor: styles.getPropertyValue("--color-primary").trim(),
		textColor: styles.getPropertyValue("--color-muted").trim()
	};
}

/**
 * Gets the chart dataset label.
 *
 * @param {object} params Parameters.
 * @param {object} params.fields Selected fields.
 * @returns {string} Chart label.
 */
function getChartLabel({ fields }) {
	if (fields.zField) {
		return `${toTitleCase(fields.xField)} / ${toTitleCase(fields.yField)} / ${toTitleCase(fields.zField)}`;
	}

	return `${toTitleCase(fields.xField)} / ${toTitleCase(fields.yField)}`;
}

/**
 * Creates a tooltip label.
 *
 * @param {object} context Chart.js tooltip context.
 * @returns {string} Tooltip label.
 */
function createTooltipLabel(context) {
	const point = context.raw;

	return `x ${point.x}, y ${point.y}`;
}

/**
 * Gets a point radius from a chart context.
 *
 * @param {object} context Chart.js context.
 * @returns {number} Point radius.
 */
function getPointRadius(context) {
	return context.raw?.r ?? defaultBubbleRadius;
}

/**
 * Gets a point hover radius from a chart context.
 *
 * @param {object} context Chart.js context.
 * @returns {number} Point hover radius.
 */
function getPointHoverRadius(context) {
	return getPointRadius(context) + 2;
}

/**
 * Gets finite numeric z values.
 *
 * @param {object} params Parameters.
 * @param {Array<object>} params.rows Dataset rows.
 * @param {string} params.zField Bubble-size field.
 * @returns {Array<number>} Numeric values.
 */
function getZValues({ rows, zField }) {
	const values = [];

	if (!zField) {
		return values;
	}

	for (let index = 0; index < rows.length; index += 1) {
		const value = getNumericValue(rows[index][zField]);

		if (Number.isFinite(value)) {
			values.push(value);
		}
	}

	return values;
}

/**
 * Gets a bubble radius scaled from the selected z dimension.
 *
 * @param {object} params Parameters.
 * @param {number} params.value Current value.
 * @param {Array<number>} params.values All z values.
 * @returns {number} Bubble radius.
 */
function getBubbleRadius({ value, values }) {
	if (!Number.isFinite(value) || values.length === 0) {
		return defaultBubbleRadius;
	}

	const { minValue, maxValue } = getValueRange({ values });

	if (minValue === maxValue) {
		return (minBubbleRadius + maxBubbleRadius) / 2;
	}

	return minBubbleRadius + ((value - minValue) / (maxValue - minValue)) * (maxBubbleRadius - minBubbleRadius);
}

/**
 * Gets empty state text for chart rendering.
 *
 * @param {object} params Parameters.
 * @param {boolean} params.hasChart Whether Chart.js is available.
 * @param {number} params.numericFieldCount Number of numeric fields.
 * @param {number} params.chartRowCount Number of plottable rows.
 * @returns {string} Empty state text.
 */
function getEmptyStateText({ hasChart, numericFieldCount, chartRowCount }) {
	if (!hasChart) {
		return "The chart library could not be loaded.";
	}

	if (numericFieldCount < 2) {
		return "This dataset does not include enough numeric fields to draw a graph.";
	}

	if (chartRowCount === 0) {
		return "No matching rows include numeric values for the selected graph fields.";
	}

	return "";
}

/**
 * Gets the range for numeric values.
 *
 * @param {object} params Parameters.
 * @param {Array<number>} params.values Numeric values.
 * @returns {object} Value range.
 */
function getValueRange({ values }) {
	let minValue = values[0];
	let maxValue = values[0];

	for (let index = 1; index < values.length; index += 1) {
		minValue = Math.min(minValue, values[index]);
		maxValue = Math.max(maxValue, values[index]);
	}

	return { minValue, maxValue };
}

/**
 * Gets a finite number from a value.
 *
 * @param {unknown} value Raw value.
 * @returns {number} Numeric value.
 */
function getNumericValue(value) {
	if (typeof value === "number") {
		return value;
	}

	if (typeof value !== "string" || !value.trim()) {
		return Number.NaN;
	}

	return Number(value);
}

/**
 * Converts a key to a display label.
 *
 * @param {string} value Raw value.
 * @returns {string} Label.
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
