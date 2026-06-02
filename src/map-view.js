let activeMap = null;
let activeRows = [];

/**
 * Determines whether rows include map coordinates.
 *
 * @param {object} params Parameters.
 * @param {Array<object>} params.rows Dataset rows.
 * @returns {boolean} Whether coordinates are present.
 */
export function hasCoordinateRows({ rows }) {
	for (let index = 0; index < rows.length; index += 1) {
		const row = rows[index];

		if (isCoordinate(row.latitude) && isCoordinate(row.longitude)) {
			return true;
		}
	}

	return false;
}

/**
 * Renders a MapLibre map when available.
 *
 * @param {object} params Parameters.
 * @param {HTMLElement} params.container Map container.
 * @param {HTMLElement} params.emptyState Empty state element.
 * @param {Array<object>} params.rows Dataset rows.
 * @returns {void}
 */
export function renderMap({ container, emptyState, rows }) {
	activeRows = rows;

	if (activeMap) {
		activeMap.remove();
		activeMap = null;
	}

	if (!hasCoordinateRows({ rows }) || !window.maplibregl) {
		container.hidden = true;
		emptyState.hidden = false;
		return;
	}

	container.hidden = false;
	emptyState.hidden = true;

	activeMap = new window.maplibregl.Map({
		container,
		style: getOpenStreetMapRasterStyle(),
		center: getMapCenter({ rows }),
		zoom: 3
	});

	activeMap.addControl(new window.maplibregl.NavigationControl({ showCompass: false }), "top-right");
	activeMap.on("load", handleMapLoad);
}

/**
 * Handles map load events.
 *
 * @returns {void}
 */
function handleMapLoad() {
	if (activeMap) {
		addMarkers({ map: activeMap, rows: activeRows });
	}
}

/**
 * Gets the OpenStreetMap raster style for MapLibre.
 *
 * @returns {object} MapLibre style object.
 */
function getOpenStreetMapRasterStyle() {
	return {
		version: 8,
		sources: {
			openStreetMap: {
				type: "raster",
				tiles: [
					"https://tile.openstreetmap.org/{z}/{x}/{y}.png"
				],
				tileSize: 256,
				attribution: "&copy; OpenStreetMap contributors"
			}
		},
		layers: [
			{
				id: "openStreetMap",
				type: "raster",
				source: "openStreetMap",
				minzoom: 0,
				maxzoom: 19
			}
		]
	};
}

/**
 * Adds row markers to the map.
 *
 * @param {object} params Parameters.
 * @param {object} params.map MapLibre map instance.
 * @param {Array<object>} params.rows Dataset rows.
 * @returns {void}
 */
function addMarkers({ map, rows }) {
	const bounds = new window.maplibregl.LngLatBounds();

	for (let index = 0; index < rows.length; index += 1) {
		const row = rows[index];

		if (!isCoordinate(row.latitude) || !isCoordinate(row.longitude)) {
			continue;
		}

		const markerElement = document.createElement("div");
		markerElement.className = "map-marker";
		markerElement.textContent = getMarkerLabel({ row });

		new window.maplibregl.Marker({ element: markerElement })
			.setLngLat([row.longitude, row.latitude])
			.setPopup(new window.maplibregl.Popup().setHTML(getPopupHtml({ row })))
			.addTo(map);

		bounds.extend([row.longitude, row.latitude]);
	}

	if (!bounds.isEmpty()) {
		map.fitBounds(bounds, { padding: 70, maxZoom: 6 });
	}
}

/**
 * Gets a readable marker label.
 *
 * @param {object} params Parameters.
 * @param {object} params.row Dataset row.
 * @returns {string} Marker label.
 */
function getMarkerLabel({ row }) {
	if (row.abbreviation) {
		return String(row.abbreviation).slice(0, 3);
	}

	if (row.number) {
		return String(row.number);
	}

	return String(row.name ?? "•").slice(0, 2);
}

/**
 * Gets map center from coordinate rows.
 *
 * @param {object} params Parameters.
 * @param {Array<object>} params.rows Dataset rows.
 * @returns {[number, number]} Center as longitude and latitude.
 */
function getMapCenter({ rows }) {
	let latitudeTotal = 0;
	let longitudeTotal = 0;
	let count = 0;

	for (let index = 0; index < rows.length; index += 1) {
		const row = rows[index];

		if (isCoordinate(row.latitude) && isCoordinate(row.longitude)) {
			latitudeTotal += row.latitude;
			longitudeTotal += row.longitude;
			count += 1;
		}
	}

	if (count === 0) {
		return [0, 20];
	}

	return [longitudeTotal / count, latitudeTotal / count];
}

/**
 * Builds safe popup HTML from row data.
 *
 * @param {object} params Parameters.
 * @param {object} params.row Dataset row.
 * @returns {string} Popup HTML.
 */
function getPopupHtml({ row }) {
	const title = escapeHtml(String(row.name ?? row.capital ?? "Dataset row"));
	const entries = Object.entries(row).slice(0, 5);
	const details = [];

	for (let index = 0; index < entries.length; index += 1) {
		const [key, value] = entries[index];
		details.push(`<div><strong>${escapeHtml(key)}</strong>: ${escapeHtml(String(value))}</div>`);
	}

	return `<strong>${title}</strong>${details.join("")}`;
}

/**
 * Checks a coordinate value.
 *
 * @param {unknown} value Coordinate value.
 * @returns {boolean} Whether the value is numeric.
 */
function isCoordinate(value) {
	return typeof value === "number" && Number.isFinite(value);
}

/**
 * Escapes HTML.
 *
 * @param {string} value Raw HTML-ish value.
 * @returns {string} Escaped text.
 */
function escapeHtml(value) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll("\"", "&quot;")
		.replaceAll("'", "&#039;");
}
