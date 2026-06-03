import { getDatasetCdnUrl, getDatasetSourceUrl, getRepositoryDataUrl, loadConfig } from "./config.js?v=8";
import { getDefaultChartFields, renderChart } from "./chart-view.js?v=2";
import { filterDatasets, filterRows, findDatasetById, loadDataset, loadDatasetIndex } from "./data-service.js?v=6";
import { selectElement } from "./dom.js";
import { hasCoordinateRows, renderMap } from "./map-view.js";
import { renderMetadata, renderPeriodicTable, renderSuggestions, renderTable } from "./render.js?v=8";

const bookmarksStorageKey = "codex.bookmarkedDatasetIds";
const contentWidthStorageKey = "codex.contentWidth";
const themeStorageKey = "codex.theme";

const state = {
	config: null,
	datasets: [],
	activeDataset: null,
	activeData: null,
	expandedDatasetId: "",
	bookmarkedDatasetIds: new Set(),
	filteredRows: [],
	chartFields: {
		xField: "",
		yField: "",
		zField: ""
	}
};

const elements = {
	brandTitle: selectElement("#brand-title"),
	brandSubtitle: selectElement("#brand-subtitle"),
	searchInput: selectElement("#dataset-search"),
	searchCount: selectElement("#dataset-search-count"),
	suggestions: selectElement("#dataset-suggestions"),
	toggleSidebarButton: selectElement("#toggle-sidebar-button"),
	themeToggleButton: selectElement("#theme-toggle-button"),
	contentWidthToggleButton: selectElement("#content-width-toggle-button"),
	repositoryLink: selectElement("#repository-link"),
	activeCategory: selectElement("#active-dataset-category"),
	activeName: selectElement("#active-dataset-name"),
	datasetCount: selectElement("#dataset-count"),
	datasetUpdated: selectElement("#dataset-updated"),
	datasetSource: selectElement("#dataset-source"),
	sourceJsonLink: selectElement("#source-json-link"),
	downloadJsonLink: selectElement("#download-json-link"),
	bookmarkButton: selectElement("#bookmark-button"),
	copyDatasetLinkButton: selectElement("#copy-dataset-link-button"),
	metadataGrid: selectElement("#metadata-grid"),
	rowFilter: selectElement("#row-filter"),
	rowFilterCount: selectElement("#row-filter-count"),
	dataTable: selectElement("#data-table"),
	graphControls: selectElement("#graph-controls"),
	graphCanvas: selectElement("#graph-canvas"),
	graphEmptyState: selectElement("#graph-empty-state"),
	periodicTableSection: selectElement("#periodic-table-section"),
	periodicTable: selectElement("#periodic-table"),
	mapSection: selectElement("#map-section"),
	mapCanvas: selectElement("#map-canvas"),
	mapEmptyState: selectElement("#map-empty-state"),
	scrollTopButton: selectElement("#scroll-top-button")
};

/**
 * Starts the application.
 *
 * @async
 * @returns {Promise<void>}
 */
async function startApp() {
	bindEvents();

	try {
		state.config = await loadConfig();
		applyBranding({ config: state.config });
		applyInitialTheme({ config: state.config });
		applyInitialContentWidth();
		updateRepositoryLink({ config: state.config });
		loadBookmarkedDatasetIds();
		state.datasets = await loadDatasetIndex({ config: state.config });
		renderDatasetLists();

		const initialDataset = findDatasetById({
			datasets: state.datasets,
			datasetId: getInitialDatasetId({ config: state.config })
		});

		if (initialDataset) {
			await selectDataset({ dataset: initialDataset });
		}
	} catch (error) {
		showError({ message: error.message });
	}
}

/**
 * Applies configured brand text.
 *
 * @param {object} params Parameters.
 * @param {object} params.config Application configuration.
 * @returns {void}
 */
function applyBranding({ config }) {
	const brandTitle = config.brandTitle ?? "Codex";
	const brandSubtitle = config.brandSubtitle ?? config.title;

	document.title = config.title ?? brandTitle;
	elements.brandTitle.textContent = brandTitle;
	elements.brandSubtitle.textContent = brandSubtitle;
}

/**
 * Updates the repository link.
 *
 * @param {object} params Parameters.
 * @param {object} params.config Application configuration.
 * @returns {void}
 */
function updateRepositoryLink({ config }) {
	elements.repositoryLink.href = getRepositoryDataUrl({ config });
}

/**
 * Binds app-wide events.
 *
 * @returns {void}
 */
function bindEvents() {
	elements.searchInput.addEventListener("input", handleSearchInput);
	elements.toggleSidebarButton.addEventListener("click", handleToggleSidebarClick);
	elements.themeToggleButton.addEventListener("click", handleThemeToggleClick);
	elements.contentWidthToggleButton.addEventListener("click", handleContentWidthToggleClick);
	elements.rowFilter.addEventListener("input", handleRowFilterInput);
	elements.graphControls.addEventListener("change", handleGraphControlsChange);
	elements.bookmarkButton.addEventListener("click", handleBookmarkClick);
	elements.copyDatasetLinkButton.addEventListener("click", handleCopyDatasetLinkClick);
	elements.scrollTopButton.addEventListener("click", handleScrollTopClick);
}

/**
 * Handles dataset search input.
 *
 * @returns {void}
 */
function handleSearchInput() {
	state.expandedDatasetId = "";
	renderDatasetLists();
}

/**
 * Handles sidebar toggle clicks.
 *
 * @returns {void}
 */
function handleToggleSidebarClick() {
	toggleSidebar();
}

/**
 * Handles theme toggle clicks.
 *
 * @returns {void}
 */
function handleThemeToggleClick() {
	const nextTheme = getCurrentTheme() === "dark" ? "light" : "dark";

	applyTheme({ theme: nextTheme });
	localStorage.setItem(themeStorageKey, nextTheme);
}

/**
 * Handles content width toggle clicks.
 *
 * @returns {void}
 */
function handleContentWidthToggleClick() {
	const nextContentWidth = getCurrentContentWidth() === "full" ? "centered" : "full";

	applyContentWidth({ contentWidth: nextContentWidth });
	localStorage.setItem(contentWidthStorageKey, nextContentWidth);
}

/**
 * Handles row filter input.
 *
 * @returns {void}
 */
function handleRowFilterInput() {
	renderFilteredRows();
}

/**
 * Handles graph control changes.
 *
 * @param {Event} event Change event.
 * @returns {void}
 */
function handleGraphControlsChange(event) {
	const target = event.target;

	if (!(target instanceof HTMLSelectElement)) {
		return;
	}

	state.chartFields = {
		...state.chartFields,
		[target.name]: target.value
	};
	renderActiveGraph();
}

/**
 * Handles bookmark button clicks.
 *
 * @returns {void}
 */
function handleBookmarkClick() {
	if (!state.activeDataset) {
		return;
	}

	toggleBookmark({ datasetId: state.activeDataset.id });
	updateBookmarkButton();
	renderDatasetLists();
}

/**
 * Handles copy dataset link button clicks.
 *
 * @async
 * @returns {Promise<void>}
 */
async function handleCopyDatasetLinkClick() {
	if (!state.activeDataset) {
		return;
	}

	await copyText({ text: getActiveDatasetPageUrl() });
	updateCopyDatasetLinkButton({ isCopied: true });
	window.setTimeout(resetCopyDatasetLinkButton, 1400);
}

/**
 * Handles scroll-to-top button clicks.
 *
 * @returns {void}
 */
function handleScrollTopClick() {
	window.scrollTo({
		top: 0,
		behavior: "smooth"
	});
}

/**
 * Renders sidebar dataset entries.
 *
 * @returns {void}
 */
function renderDatasetLists() {
	const matches = getSidebarDatasets({ query: elements.searchInput.value });

	updateDatasetSearchCount({ count: matches.length });

	renderSuggestions({
		container: elements.suggestions,
		datasets: matches,
		activeDatasetId: state.activeDataset?.id ?? "",
		expandedDatasetId: state.expandedDatasetId,
		onPreview: previewDataset,
		onSelect: selectDataset
	});
}

/**
 * Updates the dataset search count.
 *
 * @param {object} params Parameters.
 * @param {number} params.count Number of visible datasets.
 * @returns {void}
 */
function updateDatasetSearchCount({ count }) {
	elements.searchCount.textContent = String(count);
}

/**
 * Expands a dataset card for preview.
 *
 * @param {object} params Parameters.
 * @param {object} params.dataset Dataset summary.
 * @returns {void}
 */
function previewDataset({ dataset }) {
	state.expandedDatasetId = dataset.id;
	renderDatasetLists();
}

/**
 * Selects and renders a dataset.
 *
 * @async
 * @param {object} params Parameters.
 * @param {object} params.dataset Dataset summary.
 * @returns {Promise<void>}
 */
async function selectDataset({ dataset }) {
	state.activeDataset = dataset;
	state.activeData = await loadDataset({ dataset });
	state.expandedDatasetId = "";
	state.filteredRows = state.activeData.data;
	state.chartFields = getDefaultChartFields({ rows: state.activeData.data });
	elements.rowFilter.value = "";
	updateUrlHash({ datasetId: dataset.id });
	renderDatasetLists();
	renderActiveDataset();
	openSidebar();
}

/**
 * Renders the selected dataset.
 *
 * @returns {void}
 */
function renderActiveDataset() {
	const dataset = state.activeDataset;
	const data = state.activeData;
	const properties = data.properties;
	const rows = data.data;

	elements.activeCategory.textContent = dataset.category;
	elements.activeName.textContent = dataset.name;
	elements.datasetCount.textContent = `${rows.length} rows`;
	elements.datasetUpdated.textContent = `Updated ${properties.updated ?? dataset.updated}`;
	elements.datasetSource.textContent = properties.source ?? dataset.source ?? "Remote";
	elements.sourceJsonLink.href = getDatasetSourceUrl({ config: state.config, dataset });
	elements.downloadJsonLink.href = getDatasetCdnUrl({ config: state.config, dataset });
	elements.downloadJsonLink.download = `${dataset.id}.json`;
	updateBookmarkButton();
	resetCopyDatasetLinkButton();

	renderMetadata({
		container: elements.metadataGrid,
		dataset,
		data
	});
	renderFilteredRows();
	renderActiveMap({ rows });
}

/**
 * Renders filtered row output.
 *
 * @returns {void}
 */
function renderFilteredRows() {
	state.filteredRows = filterRows({
		rows: state.activeData?.data ?? [],
		query: elements.rowFilter.value
	});
	elements.rowFilterCount.textContent = `${state.filteredRows.length} matching rows`;
	renderTable({
		table: elements.dataTable,
		rows: state.filteredRows
	});
	renderActiveGraph();
	renderActivePeriodicTable({
		dataset: state.activeDataset,
		rows: state.activeData?.data ?? []
	});
}

/**
 * Renders the active graph.
 *
 * @returns {void}
 */
function renderActiveGraph() {
	renderChart({
		controls: elements.graphControls,
		canvas: elements.graphCanvas,
		emptyState: elements.graphEmptyState,
		rows: state.activeData?.data ?? [],
		fields: state.chartFields
	});
}

/**
 * Renders or hides the periodic table section.
 *
 * @param {object} params Parameters.
 * @param {object | null} params.dataset Dataset summary.
 * @param {Array<object>} params.rows Dataset rows.
 * @returns {void}
 */
function renderActivePeriodicTable({ dataset, rows }) {
	const isElementsDataset = dataset?.id === "elements";

	elements.periodicTableSection.hidden = !isElementsDataset;

	if (!isElementsDataset) {
		return;
	}

	renderPeriodicTable({
		container: elements.periodicTable,
		rows
	});
}

/**
 * Renders or hides the map section.
 *
 * @param {object} params Parameters.
 * @param {Array<object>} params.rows Dataset rows.
 * @returns {void}
 */
function renderActiveMap({ rows }) {
	const hasMap = hasCoordinateRows({ rows });

	elements.mapSection.hidden = !hasMap;
	renderMap({
		container: elements.mapCanvas,
		emptyState: elements.mapEmptyState,
		rows
	});
	elements.mapEmptyState.hidden = true;
}

/**
 * Gets datasets for the sidebar.
 *
 * @param {object} params Parameters.
 * @param {string} params.query Search query.
 * @returns {Array<object>} Datasets for sidebar rendering.
 */
function getSidebarDatasets({ query }) {
	if (query.trim()) {
		return filterDatasets({
			datasets: state.datasets,
			query
		});
	}

	return getBookmarkedFirstDatasets({ datasets: state.datasets });
}

/**
 * Gets datasets with bookmarked entries first.
 *
 * @param {object} params Parameters.
 * @param {Array<object>} params.datasets Dataset summaries.
 * @returns {Array<object>} Ordered dataset summaries.
 */
function getBookmarkedFirstDatasets({ datasets }) {
	const bookmarkedDatasets = [];
	const otherDatasets = [];

	for (let index = 0; index < datasets.length; index += 1) {
		const dataset = datasets[index];

		if (state.bookmarkedDatasetIds.has(dataset.id)) {
			bookmarkedDatasets.push(dataset);
		} else {
			otherDatasets.push(dataset);
		}
	}

	return bookmarkedDatasets.concat(otherDatasets);
}

/**
 * Toggles a dataset bookmark.
 *
 * @param {object} params Parameters.
 * @param {string} params.datasetId Dataset ID.
 * @returns {void}
 */
function toggleBookmark({ datasetId }) {
	if (state.bookmarkedDatasetIds.has(datasetId)) {
		state.bookmarkedDatasetIds.delete(datasetId);
	} else {
		state.bookmarkedDatasetIds.add(datasetId);
	}

	saveBookmarkedDatasetIds();
}

/**
 * Updates the bookmark button state.
 *
 * @returns {void}
 */
function updateBookmarkButton() {
	const isBookmarked = state.activeDataset ? state.bookmarkedDatasetIds.has(state.activeDataset.id) : false;
	const icon = elements.bookmarkButton.querySelector("i");
	const label = isBookmarked ? "Remove bookmark" : "Bookmark dataset";

	elements.bookmarkButton.classList.toggle("is-active", isBookmarked);
	elements.bookmarkButton.setAttribute("aria-pressed", String(isBookmarked));
	elements.bookmarkButton.setAttribute("aria-label", label);
	elements.bookmarkButton.setAttribute("title", label);

	if (icon) {
		icon.className = isBookmarked ? "fa-solid fa-bookmark" : "fa-regular fa-bookmark";
	}
}

/**
 * Updates the copy dataset link button state.
 *
 * @param {object} params Parameters.
 * @param {boolean} params.isCopied Whether the link was copied.
 * @returns {void}
 */
function updateCopyDatasetLinkButton({ isCopied }) {
	const icon = elements.copyDatasetLinkButton.querySelector("i");
	const label = isCopied ? "Copied dataset link" : "Copy dataset link";

	elements.copyDatasetLinkButton.setAttribute("aria-label", label);
	elements.copyDatasetLinkButton.setAttribute("title", label);

	if (icon) {
		icon.className = isCopied ? "fa-solid fa-check" : "fa-solid fa-link";
	}
}

/**
 * Resets the copy dataset link button.
 *
 * @returns {void}
 */
function resetCopyDatasetLinkButton() {
	updateCopyDatasetLinkButton({ isCopied: false });
}

/**
 * Gets the active dataset page URL.
 *
 * @returns {string} Active dataset page URL.
 */
function getActiveDatasetPageUrl() {
	const siteUrl = getConfiguredSiteUrl();
	const datasetId = state.activeDataset?.id ?? "";

	return `${siteUrl}#${encodeURIComponent(datasetId)}`;
}

/**
 * Gets the configured public site URL.
 *
 * @returns {string} Public site URL.
 */
function getConfiguredSiteUrl() {
	const siteUrl = String(state.config?.siteUrl ?? window.location.href).split("#")[0];

	return siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`;
}

/**
 * Copies text to the clipboard.
 *
 * @async
 * @param {object} params Parameters.
 * @param {string} params.text Text to copy.
 * @returns {Promise<void>}
 */
async function copyText({ text }) {
	if (navigator.clipboard) {
		try {
			await navigator.clipboard.writeText(text);
			return;
		} catch (error) {
			copyTextWithTextArea({ text });
			return;
		}
	}

	copyTextWithTextArea({ text });
}

/**
 * Copies text with a temporary textarea fallback.
 *
 * @param {object} params Parameters.
 * @param {string} params.text Text to copy.
 * @returns {void}
 */
function copyTextWithTextArea({ text }) {
	const textArea = document.createElement("textarea");
	textArea.value = text;
	textArea.setAttribute("readonly", "");
	textArea.className = "clipboard-fallback";
	document.body.appendChild(textArea);
	textArea.select();
	document.execCommand("copy");
	textArea.remove();
}

/**
 * Applies the initial theme.
 *
 * @param {object} params Parameters.
 * @param {object} params.config Application configuration.
 * @returns {void}
 */
function applyInitialTheme({ config }) {
	const savedTheme = localStorage.getItem(themeStorageKey);
	const theme = isTheme(savedTheme) ? savedTheme : getDefaultTheme({ config });

	applyTheme({ theme });
}

/**
 * Gets the configured default theme.
 *
 * @param {object} params Parameters.
 * @param {object} params.config Application configuration.
 * @returns {string} Theme name.
 */
function getDefaultTheme({ config }) {
	return isTheme(config.defaultTheme) ? config.defaultTheme : "light";
}

/**
 * Applies a theme to the document.
 *
 * @param {object} params Parameters.
 * @param {string} params.theme Theme name.
 * @returns {void}
 */
function applyTheme({ theme }) {
	document.documentElement.dataset.theme = theme;
	updateThemeToggle({ theme });

	if (state.activeData) {
		renderActiveGraph();
	}
}

/**
 * Updates the theme toggle button.
 *
 * @param {object} params Parameters.
 * @param {string} params.theme Theme name.
 * @returns {void}
 */
function updateThemeToggle({ theme }) {
	const icon = elements.themeToggleButton.querySelector("i");
	const nextTheme = theme === "dark" ? "light" : "dark";
	const label = `Switch to ${nextTheme} theme`;

	elements.themeToggleButton.setAttribute("aria-label", label);
	elements.themeToggleButton.setAttribute("title", label);

	if (icon) {
		icon.className = theme === "dark" ? "fa-solid fa-sun" : "fa-solid fa-moon";
	}
}

/**
 * Gets the current theme.
 *
 * @returns {string} Current theme.
 */
function getCurrentTheme() {
	return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/**
 * Checks a theme value.
 *
 * @param {unknown} value Theme value.
 * @returns {boolean} Whether the value is a supported theme.
 */
function isTheme(value) {
	return value === "light" || value === "dark";
}

/**
 * Applies the initial content width preference.
 *
 * @returns {void}
 */
function applyInitialContentWidth() {
	const savedContentWidth = localStorage.getItem(contentWidthStorageKey);
	const contentWidth = isContentWidth(savedContentWidth) ? savedContentWidth : "full";

	applyContentWidth({ contentWidth });
}

/**
 * Applies a content width mode.
 *
 * @param {object} params Parameters.
 * @param {string} params.contentWidth Content width mode.
 * @returns {void}
 */
function applyContentWidth({ contentWidth }) {
	document.body.classList.toggle("content-is-centered", contentWidth === "centered");
	updateContentWidthToggle({ contentWidth });
}

/**
 * Updates the content width toggle button.
 *
 * @param {object} params Parameters.
 * @param {string} params.contentWidth Content width mode.
 * @returns {void}
 */
function updateContentWidthToggle({ contentWidth }) {
	const icon = elements.contentWidthToggleButton.querySelector("i");
	const isCentered = contentWidth === "centered";
	const label = isCentered ? "Use full-width content" : "Use centered content";

	elements.contentWidthToggleButton.setAttribute("aria-pressed", String(isCentered));
	elements.contentWidthToggleButton.setAttribute("aria-label", label);
	elements.contentWidthToggleButton.setAttribute("title", label);

	if (icon) {
		icon.className = isCentered ? "fa-solid fa-up-right-and-down-left-from-center" : "fa-solid fa-down-left-and-up-right-to-center";
	}
}

/**
 * Gets the current content width mode.
 *
 * @returns {string} Current content width mode.
 */
function getCurrentContentWidth() {
	return document.body.classList.contains("content-is-centered") ? "centered" : "full";
}

/**
 * Checks a content width value.
 *
 * @param {unknown} value Content width value.
 * @returns {boolean} Whether the value is a supported content width.
 */
function isContentWidth(value) {
	return value === "full" || value === "centered";
}

/**
 * Toggles the sidebar visibility.
 *
 * @returns {void}
 */
function toggleSidebar() {
	const isCollapsed = document.body.classList.toggle("sidebar-is-collapsed");

	elements.toggleSidebarButton.setAttribute("aria-expanded", String(!isCollapsed));
	elements.toggleSidebarButton.setAttribute("aria-label", isCollapsed ? "Open dataset sidebar" : "Collapse dataset sidebar");
	elements.toggleSidebarButton.setAttribute("title", isCollapsed ? "Open dataset sidebar" : "Collapse dataset sidebar");
}

/**
 * Opens the sidebar.
 *
 * @returns {void}
 */
function openSidebar() {
	document.body.classList.remove("sidebar-is-collapsed");
	elements.toggleSidebarButton.setAttribute("aria-expanded", "true");
	elements.toggleSidebarButton.setAttribute("aria-label", "Collapse dataset sidebar");
	elements.toggleSidebarButton.setAttribute("title", "Collapse dataset sidebar");
}

/**
 * Loads bookmarked dataset IDs.
 *
 * @returns {void}
 */
function loadBookmarkedDatasetIds() {
	try {
		const storedValue = localStorage.getItem(bookmarksStorageKey);
		const datasetIds = storedValue ? JSON.parse(storedValue) : [];

		if (!Array.isArray(datasetIds)) {
			state.bookmarkedDatasetIds = new Set();
			return;
		}

		state.bookmarkedDatasetIds = new Set(datasetIds);
	} catch (error) {
		state.bookmarkedDatasetIds = new Set();
	}
}

/**
 * Saves bookmarked dataset IDs.
 *
 * @returns {void}
 */
function saveBookmarkedDatasetIds() {
	localStorage.setItem(bookmarksStorageKey, JSON.stringify(Array.from(state.bookmarkedDatasetIds)));
}

/**
 * Gets the initial dataset ID from URL or config.
 *
 * @param {object} params Parameters.
 * @param {object} params.config Application configuration.
 * @returns {string} Dataset ID.
 */
function getInitialDatasetId({ config }) {
	return window.location.hash.replace("#", "") || config.defaultDatasetId;
}

/**
 * Updates the URL hash.
 *
 * @param {object} params Parameters.
 * @param {string} params.datasetId Dataset ID.
 * @returns {void}
 */
function updateUrlHash({ datasetId }) {
	if (window.location.hash.replace("#", "") !== datasetId) {
		window.history.replaceState(null, "", `#${datasetId}`);
	}
}

/**
 * Shows a loading error in the primary shell.
 *
 * @param {object} params Parameters.
 * @param {string} params.message Error message.
 * @returns {void}
 */
function showError({ message }) {
	elements.activeCategory.textContent = "Error";
	elements.activeName.textContent = message;
	elements.datasetCount.textContent = "0 rows";
}

startApp();
