/**
 * Initializes the 404 recovery link.
 *
 * @returns {void}
 */
function initializeNotFoundPage() {
	updateHomeLink();

	const recovery = getDatasetRecovery();

	if (!recovery) {
		return;
	}

	const link = document.querySelector("#dataset-hash-link");
	const label = document.querySelector("#dataset-hash-label");

	if (!link || !label) {
		return;
	}

	link.href = recovery.href;
	label.textContent = `Try #${recovery.datasetId}`;
	link.hidden = false;
}

/**
 * Gets a possible dataset hash recovery target from the missing path.
 *
 * @returns {{ datasetId: string, href: string } | null} Recovery target.
 */
function getDatasetRecovery() {
	const datasetId = getLastPathSegment();

	if (!datasetId || !isDatasetId(datasetId)) {
		return null;
	}

	return {
		datasetId,
		href: `${getAppBasePath()}#${encodeURIComponent(datasetId)}`
	};
}

/**
 * Updates the home link to the app root.
 *
 * @returns {void}
 */
function updateHomeLink() {
	const link = document.querySelector("#not-found-home-link");

	if (link) {
		link.href = getAppBasePath();
	}
}

/**
 * Gets the app base path for local and GitHub Pages routes.
 *
 * @returns {string} App base path.
 */
function getAppBasePath() {
	const segments = window.location.pathname.split("/").filter(Boolean);

	if (segments[0] === "codex") {
		return "/codex/";
	}

	return "/";
}

/**
 * Gets the final path segment.
 *
 * @returns {string} Final path segment.
 */
function getLastPathSegment() {
	const segments = window.location.pathname
		.split("/")
		.map(decodeURIComponent)
		.filter(Boolean);

	return segments[segments.length - 1] ?? "";
}

/**
 * Checks a possible dataset identifier.
 *
 * @param {string} value Possible dataset identifier.
 * @returns {boolean} Whether the value looks like a dataset identifier.
 */
function isDatasetId(value) {
	return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

initializeNotFoundPage();
