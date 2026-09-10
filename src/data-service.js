import { getDatasetCdnUrl, getDatasetIndexUrl } from "./config.js";

/**
 * Loads the dataset index from local or remote configuration.
 *
 * @async
 * @param {object} params Parameters.
 * @param {object} params.config Application configuration.
 * @returns {Promise<Array<object>>} Dataset summaries.
 */
export async function loadDatasetIndex({ config }) {
	const indexUrl = getDatasetIndexUrl({ config });
	const response = await fetch(indexUrl, { cache: "no-cache" });

	if (!response.ok) {
		throw new Error("Could not load dataset index.");
	}

	const index = await response.json();

	if (!index.properties || !Array.isArray(index.data)) {
		throw new Error("Dataset index must include a data array.");
	}

	return normalizeDatasetPaths({
		config,
		datasets: index.data
	});
}

/**
 * Loads the full dataset for a summary entry.
 *
 * @async
 * @param {object} params Parameters.
 * @param {object} params.dataset Dataset summary.
 * @returns {Promise<object>} Full dataset.
 */
export async function loadDataset({ dataset }) {
	const response = await fetch(dataset.path, { cache: "no-cache" });

	if (!response.ok) {
		throw new Error(`Could not load ${dataset.name}.`);
	}

	const data = await response.json();

	if (!data.properties || !Array.isArray(data.data)) {
		throw new Error(`${dataset.name} must include properties and data.`);
	}

	return data;
}

/**
 * Replaces catalog metadata with loaded properties while retaining routing.
 *
 * @param {object} params Parameters.
 * @param {object} params.dataset Resolved catalog entry.
 * @param {object} params.data Loaded dataset with properties and rows.
 * @returns {object} Refreshed summary with its actual row count.
 */
export function getLoadedDatasetSummary({ dataset, data }) {
	return {
		...data.properties,
		id: dataset.id,
		path: dataset.path,
		originalPath: dataset.originalPath,
		format: data.properties.format ?? dataset.format,
		size: data.data.length
	};
}

/**
 * Finds a dataset by ID with a fallback to the first entry.
 *
 * @param {object} params Parameters.
 * @param {Array<object>} params.datasets Dataset summaries.
 * @param {string} params.datasetId Preferred dataset ID.
 * @returns {object | null} Matching dataset.
 */
export function findDatasetById({ datasets, datasetId }) {
	for (let index = 0; index < datasets.length; index += 1) {
		if (datasets[index].id === datasetId) {
			return datasets[index];
		}
	}

	return datasets[0] ?? null;
}

/**
 * Filters dataset summaries by free text.
 *
 * @param {object} params Parameters.
 * @param {Array<object>} params.datasets Dataset summaries.
 * @param {string} params.query Search query.
 * @returns {Array<object>} Filtered dataset summaries.
 */
export function filterDatasets({ datasets, query }) {
	const normalizedQuery = query.trim().toLowerCase();

	if (!normalizedQuery) {
		return datasets;
	}

	const filteredDatasets = [];

	for (let index = 0; index < datasets.length; index += 1) {
		const dataset = datasets[index];
		const searchableText = [
			dataset.name,
			dataset.description,
			dataset.shortDescription,
			dataset.longDescription,
			dataset.category,
			dataset.polity,
			...(dataset.tags ?? [])
		].join(" ").toLowerCase();

		if (searchableText.includes(normalizedQuery)) {
			filteredDatasets.push(dataset);
		}

	}

	return filteredDatasets;
}

/**
 * Filters rows by free text.
 *
 * @param {object} params Parameters.
 * @param {Array<object>} params.rows Dataset rows.
 * @param {string} params.query Search query.
 * @returns {Array<object>} Matching rows.
 */
export function filterRows({ rows, query }) {
	const normalizedQuery = query.trim().toLowerCase();

	if (!normalizedQuery) {
		return rows;
	}

	const filteredRows = [];

	for (let index = 0; index < rows.length; index += 1) {
		const row = rows[index];
		const searchableText = Object.values(row).join(" ").toLowerCase();

		if (searchableText.includes(normalizedQuery)) {
			filteredRows.push(row);
		}
	}

	return filteredRows;
}

/**
 * Collects fields across the complete dataset in first-seen order.
 *
 * @param {object} params Parameters.
 * @param {Array<Record<string, unknown>>} params.rows Dataset rows.
 * @returns {Array<string>} Available field keys.
 */
export function getRowFields({ rows }) {
	const fields = new Set();

	for (const row of rows) {
		for (const field of Object.keys(row)) {
			fields.add(field);
		}
	}

	return Array.from(fields);
}

/**
 * Resolves dataset paths for local or remote loading.
 *
 * @param {object} params Parameters.
 * @param {object} params.config Application configuration.
 * @param {Array<object>} params.datasets Dataset summaries.
 * @returns {Array<object>} Dataset summaries with resolved paths.
 */
function normalizeDatasetPaths({ config, datasets }) {
	const normalizedDatasets = [];

	for (let index = 0; index < datasets.length; index += 1) {
		const dataset = datasets[index];
		normalizedDatasets.push({
			...dataset,
			originalPath: dataset.path,
			path: getDatasetPath({
				config,
				path: dataset.path
			})
		});
	}

	return normalizedDatasets;
}

/**
 * Resolves one dataset path.
 *
 * @param {object} params Parameters.
 * @param {object} params.config Application configuration.
 * @param {string} params.path Dataset path.
 * @returns {string} Resolved dataset path.
 */
function getDatasetPath({ config, path }) {
	if (path.startsWith("http://") || path.startsWith("https://")) {
		return path;
	}

	if (config.dataMode === "remote") {
		return getDatasetCdnUrl({
			config,
			dataset: { path }
		});
	}

	return path;
}
