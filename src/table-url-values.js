import { createElement } from "./dom.js";

/**
 * Renders a complete HTTP(S) string as a link, retaining separate preview text.
 * Other values remain literal text; URLs embedded in prose are not extracted.
 *
 * @param {object} params Parameters.
 * @param {unknown} params.value Original value used to detect the destination.
 * @param {string} [params.text] Visible text, optionally shortened by the caller.
 * @returns {HTMLElement} Link or plain text span.
 */
export function createUrlValue({ value, text = String(value) }) {
	const href = getHttpUrl(value);
	if (!href) {
		return createElement({ tag: "span", text });
	}
	return createElement({
		tag: "a",
		attributes: {
			class: "table-value-link",
			href,
			target: "_blank",
			rel: "noopener noreferrer",
			title: href,
			"aria-label": `${href} (opens in a new tab)`
		},
		text
	});
}

/**
 * Recognizes absolute HTTP(S) URLs without repairing malformed source strings.
 *
 * @param {unknown} value Source JSON value.
 * @returns {string} Trimmed URL or an empty string.
 */
function getHttpUrl(value) {
	if (typeof value !== "string") {
		return "";
	}
	const candidate = value.trim();
	if (!/^https?:\/\/[^/?#]/i.test(candidate) || /[\s\u0000-\u001f\u007f\\]/u.test(candidate)) {
		return "";
	}
	try {
		const url = new URL(candidate);
		return (url.protocol === "http:" || url.protocol === "https:") && url.hostname ? candidate : "";
	} catch {
		return "";
	}
}
