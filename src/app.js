import { getDatasetCdnUrl, getDatasetSourceUrl, getRepositoryUrl, loadConfig } from "./config.js?v=6";
import { filterDatasets, filterRows, findDatasetById, loadDataset, loadDatasetIndex } from "./data-service.js?v=6";
import { selectElement } from "./dom.js";
import { hasCoordinateRows, renderMap } from "./map-view.js";
import { renderMetadata, renderSuggestions, renderTable } from "./render.js?v=5";

const bookmarksStorageKey = "codex.bookmarkedDatasetIds";
const themeStorageKey = "codex.theme";

const state = {
	config: null,
	datasets: [],
	activeDataset: null,
	activeData: null,
	expandedDatasetId: "",
	bookmarkedDatasetIds: new Set(),
	filteredRows: []
};

const elements = {
	brandTitle: selectElement("#brand-title"),
	brandSubtitle: selectElement("#brand-subtitle"),
	searchInput: selectElement("#dataset-search"),
	suggestions: selectElement("#dataset-suggestions"),
	toggleSidebarButton: selectElement("#toggle-sidebar-button"),
	themeToggleButton: selectElement("#theme-toggle-button"),
	repositoryLink: selectElement("#repository-link"),
	activeCategory: selectElement("#active-dataset-category"),
	activeName: selectElement("#active-dataset-name"),
	datasetCount: selectElement("#dataset-count"),
	datasetUpdated: selectElement("#dataset-updated"),
	datasetSource: selectElement("#dataset-source"),
	sourceJsonLink: selectElement("#source-json-link"),
	downloadJsonLink: selectElement("#download-json-link"),
	bookmarkButton: selectElement("#bookmark-button"),
	metadataGrid: selectElement("#metadata-grid"),
	rowFilter: selectElement("#row-filter"),
	rowFilterCount: selectElement("#row-filter-count"),
	dataTable: selectElement("#data-table"),
	mapSection: selectElement("#map-section"),
	mapCanvas: selectElement("#map-canvas"),
	mapEmptyState: selectElement("#map-empty-state")
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
	elements.repositoryLink.href = getRepositoryUrl({ config });
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
	elements.rowFilter.addEventListener("input", handleRowFilterInput);
	elements.bookmarkButton.addEventListener("click", handleBookmarkClick);
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
 * Handles row filter input.
 *
 * @returns {void}
 */
function handleRowFilterInput() {
	renderFilteredRows();
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
 * Renders sidebar dataset entries.
 *
 * @returns {void}
 */
function renderDatasetLists() {
	const matches = getSidebarDatasets({ query: elements.searchInput.value });

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
