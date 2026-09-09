import { createElement } from "./dom.js";

/**
 * Appends optional dataset notes and sources in the expanded overview.
 *
 * @param {object} params Parameters.
 * @param {HTMLElement} params.container Metadata container.
 * @param {unknown} params.notes Dataset-level notes.
 * @param {unknown} params.sources Dataset-level source objects.
 * @returns {void}
 */
export function appendDatasetAnnotations({ container, notes, sources }) {
	const notesList = createElement({ tag: "ul", attributes: { class: "metadata-list metadata-notes" } });
	const sourcesList = createElement({ tag: "ul", attributes: { class: "metadata-list metadata-sources" } });

	if (Array.isArray(notes)) {
		for (const note of notes) {
			if (typeof note === "string" && note.trim()) {
				notesList.append(createElement({ tag: "li", text: note.trim() }));
			}
		}
	}

	if (Array.isArray(sources)) {
		for (const source of sources) {
			const item = createSourceItem(source);
			if (item) {
				sourcesList.append(item);
			}
		}
	}

	appendMetadataList({ container, title: "Notes", list: notesList });
	appendMetadataList({ container, title: "Sources", list: sourcesList });
}

/**
 * Adds a labeled metadata section only when its list has entries.
 *
 * @param {object} params Parameters.
 * @param {HTMLElement} params.container Metadata container.
 * @param {string} params.title Section heading.
 * @param {HTMLElement} params.list Populated list.
 * @returns {void}
 */
function appendMetadataList({ container, title, list }) {
	if (list.childElementCount === 0) {
		return;
	}
	const section = createElement({
		tag: "section",
		attributes: { class: "metadata-section", "aria-label": title }
	});
	section.append(createElement({ tag: "h3", text: title }), list);
	container.append(section);
}

/**
 * Renders a source with a named HTTP(S) link or a plain-text fallback.
 *
 * @param {unknown} source Source object with optional name and URL strings.
 * @returns {HTMLElement|null} List item, or null for an unusable entry.
 */
function createSourceItem(source) {
	if (!source || typeof source !== "object" || Array.isArray(source)) {
		return null;
	}
	const name = typeof source.name === "string" ? source.name.trim() : "";
	const url = typeof source.url === "string" ? source.url.trim() : "";
	const label = name || url;

	if (!label) {
		return null;
	}
	const item = createElement({ tag: "li" });
	const href = getSourceHref(url);

	if (!href) {
		item.textContent = label;
		return item;
	}
	const link = createElement({
		tag: "a",
		attributes: {
			class: "metadata-source-link",
			href,
			target: "_blank",
			rel: "noopener noreferrer",
			"aria-label": `${label} (opens in a new tab)`
		},
		text: label
	});
	link.append(createElement({
		tag: "i",
		attributes: { class: "fa-solid fa-arrow-up-right-from-square", "aria-hidden": "true" }
	}));
	item.append(link);
	return item;
}

/**
 * Accepts only absolute HTTP(S) source URLs.
 *
 * @param {string} value Authored URL.
 * @returns {string} Safe link destination, or an empty string.
 */
function getSourceHref(value) {
	try {
		const url = new URL(value);
		return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
	} catch {
		return "";
	}
}
