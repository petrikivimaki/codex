/**
 * Loads application defaults and merges optional local overrides.
 *
 * @async
 * @returns {Promise<object>} Application configuration.
 */
export async function loadConfig() {
	const [defaults, overrides] = await Promise.all([
		loadConfigFile({ path: "config/app-config.json" }),
		loadConfigFile({ path: "config/app-config.local.json", optional: true })
	]);

	return mergeConfig({ defaults, overrides });
}

/**
 * Reads a JSON configuration object, allowing only optional files to be missing.
 *
 * @async
 * @param {object} params Parameters.
 * @param {string} params.path Configuration URL relative to the app.
 * @param {boolean} [params.optional=false] Whether HTTP 404 means no overrides.
 * @returns {Promise<Record<string, unknown>>} Configuration values.
 */
async function loadConfigFile({ path, optional = false }) {
	let response;
	try {
		response = await fetch(path, { cache: "no-store" });
	} catch (cause) {
		throw new Error(`Could not load configuration ${path}: network request failed.`, { cause });
	}

	if (optional && response.status === 404) {
		return {};
	}

	if (!response.ok) {
		throw new Error(`Could not load configuration ${path}: HTTP ${response.status}.`);
	}

	let config;
	try {
		config = await response.json();
	} catch (cause) {
		throw new Error(`Could not parse configuration ${path}: expected valid JSON.`, { cause });
	}

	if (!isConfigObject(config)) {
		throw new Error(`Invalid configuration ${path}: expected a JSON object.`);
	}

	return config;
}

/**
 * Merges nested objects; arrays, null, and scalar overrides replace defaults.
 *
 * @param {object} params Parameters.
 * @param {Record<string, unknown>} params.defaults Default values.
 * @param {Record<string, unknown>} params.overrides Local values.
 * @returns {Record<string, unknown>} Merged configuration.
 */
function mergeConfig({ defaults, overrides }) {
	const entries = new Map(Object.entries(defaults));

	for (const [key, override] of Object.entries(overrides)) {
		const defaultValue = entries.get(key);
		const value = isConfigObject(defaultValue) && isConfigObject(override)
			? mergeConfig({ defaults: defaultValue, overrides: override })
			: override;
		entries.set(key, value);
	}

	return Object.fromEntries(entries);
}

/**
 * Identifies JSON objects eligible for recursive configuration merging.
 *
 * @param {unknown} value Parsed JSON value.
 * @returns {value is Record<string, unknown>} Whether the value is an object.
 */
function isConfigObject(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Gets the configured dataset index URL.
 *
 * @param {object} params Parameters.
 * @param {object} params.config Application configuration.
 * @returns {string} Dataset index URL.
 */
export function getDatasetIndexUrl({ config }) {
	return `${getProjectRootUrl({ config })}/${config.indexPath}`;
}

/**
 * Gets the GitHub repository URL.
 *
 * @param {object} params Parameters.
 * @param {object} params.config Application configuration.
 * @returns {string} GitHub repository URL.
 */
export function getRepositoryUrl({ config }) {
	const remote = config.remote;

	return `https://github.com/${remote.owner}/${remote.repo}`;
}

/**
 * Gets the GitHub data directory URL.
 *
 * @param {object} params Parameters.
 * @param {object} params.config Application configuration.
 * @returns {string} GitHub data directory URL.
 */
export function getRepositoryDataUrl({ config }) {
	const remote = config.remote;
	const dataPath = String(config.dataPath ?? "").replace(/^\/+|\/+$/g, "");
	const dataPathSegment = dataPath ? `/${dataPath}` : "";

	return `${getRepositoryUrl({ config })}/tree/${remote.branch}${dataPathSegment}`;
}

/**
 * Gets the configured project root URL.
 *
 * @param {object} params Parameters.
 * @param {object} params.config Application configuration.
 * @returns {string} Project root URL.
 */
export function getProjectRootUrl({ config }) {
	if (config.dataMode === "remote") {
		return getRemoteCdnBaseUrl({ config });
	}

	return ".";
}

/**
 * Gets the jsDelivr base URL for remote data.
 *
 * @param {object} params Parameters.
 * @param {object} params.config Application configuration.
 * @returns {string} Remote CDN base URL.
 */
export function getRemoteCdnBaseUrl({ config }) {
	const remote = config.remote;

	return `https://cdn.jsdelivr.net/gh/${remote.owner}/${remote.repo}@${remote.branch}`;
}

/**
 * Gets the local file or GitHub source URL for a dataset.
 *
 * @param {object} params Parameters.
 * @param {object} params.config Application configuration.
 * @param {object} params.dataset Dataset summary.
 * @returns {string} Dataset source URL.
 */
export function getDatasetSourceUrl({ config, dataset }) {
	if (config.dataMode === "local") {
		return getDatasetCdnUrl({ config, dataset });
	}

	const remote = config.remote;
	const path = getRepositoryDatasetPath({ config, dataset });

	return `https://github.com/${remote.owner}/${remote.repo}/blob/${remote.branch}/${path}`;
}

/**
 * Gets the jsDelivr URL for a dataset file.
 *
 * @param {object} params Parameters.
 * @param {object} params.config Application configuration.
 * @param {object} params.dataset Dataset summary.
 * @returns {string} jsDelivr file URL.
 */
export function getDatasetCdnUrl({ config, dataset }) {
	const path = getRepositoryDatasetPath({ config, dataset });

	return `${getProjectRootUrl({ config })}/${path}`;
}

/**
 * Gets the repository-relative dataset path.
 *
 * @param {object} params Parameters.
 * @param {object} params.config Application configuration.
 * @param {object} params.dataset Dataset summary.
 * @returns {string} Repository-relative dataset path.
 */
function getRepositoryDatasetPath({ config, dataset }) {
	const dataPath = String(config.dataPath ?? "").replace(/^\/+|\/+$/g, "");
	const path = String(dataset.originalPath ?? dataset.path).replace(/^\/+/, "");

	if (!dataPath || path.startsWith(`${dataPath}/`)) {
		return path;
	}

	return `${dataPath}/${path}`;
}
