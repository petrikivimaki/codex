/**
 * Gets concise navigation text from a dataset index entry.
 *
 * @param {object} params Parameters.
 * @param {object} params.dataset Dataset summary.
 * @returns {string} Short description, falling back to the original description.
 */
export function getShortDescription({ dataset }) {
	return firstDescription([dataset.shortDescription, dataset.description]);
}

/**
 * Gets the content description, preferring metadata from the loaded dataset.
 *
 * @param {object} params Parameters.
 * @param {object} params.properties Loaded dataset metadata.
 * @param {object} params.dataset Dataset index entry.
 * @returns {string} Long description with original/short-description fallbacks.
 */
export function getLongDescription({ properties, dataset }) {
	return firstDescription([
		properties.longDescription,
		properties.description,
		properties.shortDescription,
		dataset.longDescription,
		dataset.description,
		dataset.shortDescription
	]);
}

/**
 * Selects the first nonblank string while retaining internal paragraph breaks.
 *
 * @param {Array<unknown>} values Description candidates in preference order.
 * @returns {string} Usable description or an empty string.
 */
function firstDescription(values) {
	for (const value of values) {
		if (typeof value === "string" && value.trim()) {
			return value.trim();
		}
	}
	return "";
}
