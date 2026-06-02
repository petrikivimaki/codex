/**
 * Selects one element.
 *
 * @param {string} selector CSS selector.
 * @param {ParentNode} parent Parent node.
 * @returns {Element} Selected element.
 */
export function selectElement(selector, parent = document) {
	const element = parent.querySelector(selector);

	if (!element) {
		throw new Error(`Missing element: ${selector}`);
	}

	return element;
}

/**
 * Removes all child nodes from an element.
 *
 * @param {Element} element Element to clear.
 * @returns {void}
 */
export function clearElement(element) {
	while (element.firstChild) {
		element.removeChild(element.firstChild);
	}
}

/**
 * Creates an element with attributes.
 *
 * @param {object} params Parameters.
 * @param {string} params.tag Tag name.
 * @param {Record<string, string>} [params.attributes] Attribute map.
 * @param {string} [params.text] Text content.
 * @returns {HTMLElement} Created element.
 */
export function createElement({ tag, attributes = {}, text = "" }) {
	const element = document.createElement(tag);
	const attributeEntries = Object.entries(attributes);

	for (let index = 0; index < attributeEntries.length; index += 1) {
		const [name, value] = attributeEntries[index];
		element.setAttribute(name, value);
	}

	if (text) {
		element.textContent = text;
	}

	return element;
}
