/**
 * Loads application configuration.
 *
 * @async
 * @returns {Promise<object>} Application configuration.
 */
export async function loadConfig() {
	const response = await fetch("config/app-config.json?v=7");

	if (!response.ok) {
		throw new Error("Could not load app configuration.");
	}

	return response.json();
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
 * Gets the GitHub source URL for a dataset file.
 *
 * @param {object} params Parameters.
 * @param {object} params.config Application configuration.
 * @param {object} params.dataset Dataset summary.
 * @returns {string} GitHub source URL.
 */
export function getDatasetSourceUrl({ config, dataset }) {
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
