(function () {
  const DEFAULT_VIEWBOX = { width: 960, height: 600 };
  const DEFAULT_PADDING = 24;
  const DEFAULT_BOTTOM_INSET = 160;
  const REGION_ALASKA = 'alaska';
  const REGION_HAWAII = 'hawaii';
  const REGION_PUERTO_RICO = 'puertorico';

  const stateFilesData = window.STATE_RESOURCE_FILES || {};

  document.addEventListener('DOMContentLoaded', () => {
    const mapMount = document.querySelector('[data-role="state-map"]');
    const mapCanvas = mapMount ? mapMount.querySelector('[data-role="state-map-canvas"]') : null;
    const panelApi = createStateFilesPanel();
    if (!mapMount || !mapCanvas) return;

    if ('IntersectionObserver' in window) {
      let initialized = false;
      const observer = new IntersectionObserver(
        (entries) => {
          if (initialized || !entries[0].isIntersecting) return;
          initialized = true;
          observer.disconnect();
          initLeafletMap(mapMount, mapCanvas, panelApi, stateFilesData);
        },
        { rootMargin: '200px' }
      );
      observer.observe(mapMount);
    } else {
      initLeafletMap(mapMount, mapCanvas, panelApi, stateFilesData);
    }
  });

  async function initLeafletMap(mount, canvas, panelApi, filesData) {
    if (!window.L) {
      setMapError(mount, 'Leaflet failed to load.');
      return;
    }

    const geojsonSrc = mount.dataset.mapGeojson || './data/us-states.json';
    const markersSrc = mount.dataset.mapMarkers || '';

    const [geoJsonResult, markersData] = await Promise.all([
      loadGeoJsonSafe(geojsonSrc),
      markersSrc ? loadMarkersSafe(markersSrc) : Promise.resolve(null)
    ]);

    const baseFeatures = geoJsonResult ? geoJsonResult.features : null;

    if (!baseFeatures || !baseFeatures.length) {
      setMapError(mount, 'Unable to load the map right now.');
      return;
    }

    const viewBox = DEFAULT_VIEWBOX;
    const projectionContext = createProjectionContext(baseFeatures, viewBox);
    const baseProjection = projectFeatures(baseFeatures, projectionContext);

    const map = createLeafletMap(canvas, viewBox);
    const bounds = L.latLngBounds(
      [0, 0],
      [viewBox.height, viewBox.width]
    );
    map.fitBounds(bounds, { animate: false });
    map.setMaxBounds(bounds.pad(0.2));

    const stateLayer = createStateLayer(baseProjection.geojson, panelApi, filesData, viewBox.height);
    stateLayer.addTo(map);

    if (markersData && markersData.length) {
      const markerLayer = createMarkerLayer(markersData, projectionContext, viewBox.height);
      markerLayer.addTo(map);
    }

    initControls(mount, map, bounds);

    const stateMarkersIndex = buildStateMarkersIndexFromJson(markersData || []);
    initStateSearch(stateMarkersIndex);

    const loader = mount.querySelector('.us-map__loader');
    if (loader) loader.remove();
  }

  function createLeafletMap(canvas, viewBox) {
    const map = L.map(canvas, {
      crs: L.CRS.Simple,
      zoomControl: false,
      attributionControl: false,
      minZoom: -2,
      maxZoom: 4,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 60
    });
    map.setView([viewBox.height / 2, viewBox.width / 2], 0, { animate: false });
    return map;
  }

  function initControls(mount, map, bounds) {
    const zoomIn = mount.querySelector('[data-role="map-zoom-in"]');
    const zoomOut = mount.querySelector('[data-role="map-zoom-out"]');
    const zoomReset = mount.querySelector('[data-role="map-zoom-reset"]');

    if (zoomIn) {
      zoomIn.addEventListener('click', () => map.zoomIn());
    }
    if (zoomOut) {
      zoomOut.addEventListener('click', () => map.zoomOut());
    }
    if (zoomReset) {
      zoomReset.addEventListener('click', () => map.fitBounds(bounds));
    }
  }

  function createStateLayer(geojson, panelApi, filesData, viewBoxHeight) {
    const defaultStyle = {
      className: 'us-map__state',
      color: 'rgba(255, 255, 255, 0.25)',
      weight: 0.6,
      fillColor: 'rgba(255, 255, 255, 0.08)',
      fillOpacity: 0.5
    };
    const hoverStyle = {
      color: 'rgba(46, 165, 255, 0.85)',
      weight: 1,
      fillColor: 'rgba(46, 165, 255, 0.85)',
      fillOpacity: 0.85
    };

    let stateLayer = null;
    stateLayer = L.geoJSON(geojson, {
      coordsToLatLng: (c) => L.latLng(viewBoxHeight - c[1], c[0]),
      style: defaultStyle,
      onEachFeature: (feature, layer) => {
        const name = feature && feature.properties ? feature.properties.name : 'State';
        layer.on('mouseover', () => {
          layer.setStyle(hoverStyle);
          const element = layer.getElement();
          if (element) element.classList.add('is-hovered');
        });
        layer.on('mouseout', () => {
          if (stateLayer) {
            stateLayer.resetStyle(layer);
          }
          const element = layer.getElement();
          if (element) element.classList.remove('is-hovered');
        });
        layer.on('click', () => {
          if (name) {
            handleStateSelection(name, panelApi, filesData);
          }
        });
      }
    });

    return stateLayer;
  }

  function createMarkerLayer(markers, projectionContext, viewBoxHeight) {
    const layer = window.L.markerClusterGroup
      ? L.markerClusterGroup({
          maxClusterRadius: 40,
          disableClusteringAtZoom: 3,
          spiderfyOnMaxZoom: true,
          showCoverageOnHover: false
        })
      : L.layerGroup();

    const iconSize = 22;
    const iconCache = {};

    markers.forEach((marker) => {
      const region = inferRegionFromLatLon(marker.lng, marker.lat);
      const transform = projectionContext.regionTransforms[region];
      const projected = projectLatLng([marker.lng, marker.lat], projectionContext.project, transform);
      if (!projected) return;

      const latlng = L.latLng(viewBoxHeight - projected[1], projected[0]);

      const iconIdx = marker.i || 1;
      if (!iconCache[iconIdx]) {
        iconCache[iconIdx] = L.icon({
          iconUrl: `./data/images/icon-${iconIdx}.png`,
          iconSize: [iconSize, iconSize],
          iconAnchor: [iconSize / 2, iconSize / 2],
          className: 'us-map__marker'
        });
      }

      const leafletMarker = L.marker(latlng, { icon: iconCache[iconIdx] });
      leafletMarker.bindTooltip(marker.n, { sticky: true });
      leafletMarker.on('click', () => {
        window.open(
          `https://www.google.com/maps/search/?api=1&query=${marker.lat},${marker.lng}`,
          '_blank',
          'noopener noreferrer'
        );
      });

      layer.addLayer(leafletMarker);
    });

    return layer;
  }

  function projectFeatures(features, context) {
    const geojson = {
      type: 'FeatureCollection',
      features: []
    };
    const images = [];

    features.forEach((feature) => {
      if (!feature) return;
      if (feature.geometryType === 'image') {
        const image = projectImageOverlay(feature, context);
        if (image) images.push(image);
        return;
      }
      const projectedFeature = projectFeatureToGeoJson(feature, context);
      if (projectedFeature) {
        geojson.features.push(projectedFeature);
      }
    });

    return { geojson, images };
  }

  function projectFeatureToGeoJson(feature, context) {
    const region = inferRegion(feature);
    const transform = context.regionTransforms[region];
    const projectCoordinate = (coord) => projectLatLng(coord, context.project, transform);

    if (feature.geometryType === 'point') {
      const projected = projectCoordinate(feature.coordinates);
      if (!projected) return null;
      return {
        type: 'Feature',
        properties: {
          name: feature.name || 'Location',
          icon: feature.icon || null,
          lat: feature.coordinates[1],
          lng: feature.coordinates[0]
        },
        geometry: {
          type: 'Point',
          coordinates: projected
        }
      };
    }

    if (feature.geometryType === 'line') {
      const projectedLine = projectLineCoordinates(feature.coordinates, projectCoordinate);
      if (!projectedLine.length) return null;
      return {
        type: 'Feature',
        properties: {
          name: feature.name || 'Overlay'
        },
        geometry: {
          type: 'LineString',
          coordinates: projectedLine
        }
      };
    }

    const polygons = feature.isMulti ? feature.coordinates : [feature.coordinates];
    const projectedPolygon = projectPolygonCoordinates(polygons, projectCoordinate);
    if (!projectedPolygon.length) return null;
    const geometryType = feature.isMulti ? 'MultiPolygon' : 'Polygon';
    const coordinates = feature.isMulti ? projectedPolygon : projectedPolygon[0];

    return {
      type: 'Feature',
      properties: {
        name: feature.name || 'Area'
      },
      geometry: {
        type: geometryType,
        coordinates
      }
    };
  }

  function projectPolygonCoordinates(polygons, projectCoordinate) {
    if (!Array.isArray(polygons) || !polygons.length) return [];
    return polygons.map((polygon) =>
      polygon
        .filter((ring) => Array.isArray(ring) && ring.length)
        .map((ring) => ring.map(projectCoordinate).filter(Boolean))
        .filter((ring) => ring.length)
    ).filter((polygon) => polygon.length);
  }

  function projectLineCoordinates(line, projectCoordinate) {
    if (!Array.isArray(line)) return [];
    return line.map(projectCoordinate).filter(Boolean);
  }

  function projectLatLng(coord, project, transform) {
    if (!coord || coord.length < 2) return null;
    const point = project(coord[0], coord[1]);
    if (!transform) return point;
    return [
      point[0] * transform.scale + transform.translateX,
      point[1] * transform.scale + transform.translateY
    ];
  }

  function projectImageOverlay(feature, context) {
    if (!feature.bounds || !feature.href) return null;
    const region = inferRegion(feature);
    const transform = context.regionTransforms[region];
    const { west, east, north, south } = feature.bounds;
    const topLeft = projectLatLng([west, north], context.project, transform);
    const bottomRight = projectLatLng([east, south], context.project, transform);
    if (!topLeft || !bottomRight) return null;
    const bounds = [
      [Math.min(topLeft[1], bottomRight[1]), Math.min(topLeft[0], bottomRight[0])],
      [Math.max(topLeft[1], bottomRight[1]), Math.max(topLeft[0], bottomRight[0])]
    ];
    return { href: feature.href, bounds };
  }

  function createProjectionContext(features, viewBox) {
    const lower48 = features.filter((feature) => inferRegion(feature) === 'lower48');
    const bounds = getLatLonBounds(lower48.length ? lower48 : features);
    const padding = DEFAULT_PADDING;
    const bottomInset = DEFAULT_BOTTOM_INSET;

    const width = viewBox.width;
    const height = viewBox.height - bottomInset;
    const spanX = bounds.maxLon - bounds.minLon || 1;
    const spanY = bounds.maxLat - bounds.minLat || 1;
    const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY);
    const offsetX = padding + (width - padding * 2 - spanX * scale) / 2;
    const offsetY = padding + (height - padding * 2 - spanY * scale) / 2;

    const project = (lon, lat) => [
      offsetX + (lon - bounds.minLon) * scale,
      offsetY + (bounds.maxLat - lat) * scale
    ];

    const regionTransforms = computeRegionTransforms(features, project, viewBox);

    return { project, regionTransforms };
  }

  function computeRegionTransforms(features, project, viewBox) {
    const targets = getRegionTargets(viewBox);
    const transforms = {};

    [REGION_ALASKA, REGION_HAWAII, REGION_PUERTO_RICO].forEach((region) => {
      const regionFeatures = features.filter((feature) => inferRegion(feature) === region);
      if (!regionFeatures.length) return;
      const bounds = getProjectedBounds(regionFeatures, project);
      const target = targets[region];
      if (!bounds || !target) return;
      transforms[region] = computeTransform(bounds, target);
    });

    return transforms;
  }

  function getRegionTargets(viewBox) {
    return {
      [REGION_ALASKA]: {
        x: viewBox.width * 0.05,
        y: viewBox.height - 155,
        width: viewBox.width * 0.23,
        height: 135
      },
      [REGION_HAWAII]: {
        x: viewBox.width * 0.31,
        y: viewBox.height - 120,
        width: viewBox.width * 0.14,
        height: 85
      },
      [REGION_PUERTO_RICO]: {
        x: viewBox.width - 140,
        y: viewBox.height - 120,
        width: 95,
        height: 60
      }
    };
  }

  function computeTransform(bounds, target) {
    const scale = Math.min(target.width / bounds.width, target.height / bounds.height);
    const translateX = target.x + (target.width - bounds.width * scale) / 2 - bounds.minX * scale;
    const translateY = target.y + (target.height - bounds.height * scale) / 2 - bounds.minY * scale;
    return { scale, translateX, translateY };
  }

  function getLatLonBounds(features) {
    const bounds = {
      minLon: Infinity,
      minLat: Infinity,
      maxLon: -Infinity,
      maxLat: -Infinity
    };

    features.forEach((feature) => {
      if (feature.geometryType === 'point') {
        if (!feature.coordinates) return;
        const lon = feature.coordinates[0];
        const lat = feature.coordinates[1];
        bounds.minLon = Math.min(bounds.minLon, lon);
        bounds.maxLon = Math.max(bounds.maxLon, lon);
        bounds.minLat = Math.min(bounds.minLat, lat);
        bounds.maxLat = Math.max(bounds.maxLat, lat);
        return;
      }

      if (feature.geometryType === 'image' && feature.bounds) {
        const { west, east, north, south } = feature.bounds;
        bounds.minLon = Math.min(bounds.minLon, west, east);
        bounds.maxLon = Math.max(bounds.maxLon, west, east);
        bounds.minLat = Math.min(bounds.minLat, north, south);
        bounds.maxLat = Math.max(bounds.maxLat, north, south);
        return;
      }

      walkCoordinates(feature.coordinates, (lon, lat) => {
        bounds.minLon = Math.min(bounds.minLon, lon);
        bounds.maxLon = Math.max(bounds.maxLon, lon);
        bounds.minLat = Math.min(bounds.minLat, lat);
        bounds.maxLat = Math.max(bounds.maxLat, lat);
      });
    });

    if (!Number.isFinite(bounds.minLon)) {
      return { minLon: -125, maxLon: -66, minLat: 24, maxLat: 50 };
    }

    return bounds;
  }

  function getProjectedBounds(features, project) {
    const bounds = {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity
    };

    features.forEach((feature) => {
      if (feature.geometryType === 'point') {
        const point = projectLatLng(feature.coordinates, project, null);
        if (!point) return;
        bounds.minX = Math.min(bounds.minX, point[0]);
        bounds.maxX = Math.max(bounds.maxX, point[0]);
        bounds.minY = Math.min(bounds.minY, point[1]);
        bounds.maxY = Math.max(bounds.maxY, point[1]);
        return;
      }

      if (feature.geometryType === 'image' && feature.bounds) {
        const { west, east, north, south } = feature.bounds;
        const topLeft = projectLatLng([west, north], project, null);
        const bottomRight = projectLatLng([east, south], project, null);
        if (!topLeft || !bottomRight) return;
        bounds.minX = Math.min(bounds.minX, topLeft[0], bottomRight[0]);
        bounds.maxX = Math.max(bounds.maxX, topLeft[0], bottomRight[0]);
        bounds.minY = Math.min(bounds.minY, topLeft[1], bottomRight[1]);
        bounds.maxY = Math.max(bounds.maxY, topLeft[1], bottomRight[1]);
        return;
      }

      walkCoordinates(feature.coordinates, (lon, lat) => {
        const point = projectLatLng([lon, lat], project, null);
        if (!point) return;
        bounds.minX = Math.min(bounds.minX, point[0]);
        bounds.maxX = Math.max(bounds.maxX, point[0]);
        bounds.minY = Math.min(bounds.minY, point[1]);
        bounds.maxY = Math.max(bounds.maxY, point[1]);
      });
    });

    if (!Number.isFinite(bounds.minX)) return null;
    return {
      minX: bounds.minX,
      minY: bounds.minY,
      maxX: bounds.maxX,
      maxY: bounds.maxY,
      width: bounds.maxX - bounds.minX || 1,
      height: bounds.maxY - bounds.minY || 1
    };
  }

  function walkCoordinates(polygons, callback) {
    if (!polygons) return;
    if (!Array.isArray(polygons)) return;

    if (typeof polygons[0] === 'number') {
      if (polygons.length >= 2) {
        callback(polygons[0], polygons[1]);
      }
      return;
    }

    if (Array.isArray(polygons[0]) && typeof polygons[0][0] === 'number') {
      polygons.forEach((coord) => {
        if (!coord || coord.length < 2) return;
        callback(coord[0], coord[1]);
      });
      return;
    }

    polygons.forEach((rings) => {
      if (!rings) return;
      rings.forEach((ring) => {
        if (!ring) return;
        ring.forEach((coord) => {
          if (!coord || coord.length < 2) return;
          callback(coord[0], coord[1]);
        });
      });
    });
  }

  function inferRegion(feature) {
    if (!feature) return 'lower48';
    if (feature.region) return feature.region;
    const nameRegion = inferRegionFromName(feature.name);
    if (nameRegion) return nameRegion;
    if (feature.bounds) {
      return inferRegionFromBounds(feature.bounds);
    }
    if (feature.geometryType === 'point' && feature.coordinates) {
      return inferRegionFromLatLon(feature.coordinates[0], feature.coordinates[1]);
    }
    return inferRegionFromCoordinates(feature.coordinates);
  }

  function inferRegionFromName(name) {
    if (!name) return null;
    const normalized = name.toLowerCase();
    if (normalized.includes('alaska')) return REGION_ALASKA;
    if (normalized.includes('hawaii')) return REGION_HAWAII;
    if (normalized.includes('puerto rico') || normalized.includes('pr')) return REGION_PUERTO_RICO;
    return null;
  }

  function inferRegionFromBounds(bounds) {
    const centerLon = (bounds.west + bounds.east) / 2;
    const centerLat = (bounds.north + bounds.south) / 2;
    return inferRegionFromLatLon(centerLon, centerLat);
  }

  function inferRegionFromCoordinates(polygons) {
    let count = 0;
    let totalLon = 0;
    let totalLat = 0;
    walkCoordinates(polygons, (lon, lat) => {
      totalLon += lon;
      totalLat += lat;
      count += 1;
    });
    if (!count) return 'lower48';
    return inferRegionFromLatLon(totalLon / count, totalLat / count);
  }

  function inferRegionFromLatLon(lon, lat) {
    if (lat > 50 && lon < -125) return REGION_ALASKA;
    if (lat < 25 && lon < -154 && lon > -162) return REGION_HAWAII;
    if (lat < 22 && lon > -75 && lon < -60) return REGION_PUERTO_RICO;
    return 'lower48';
  }

  function loadGeoJsonSafe(src) {
    return fetch(src)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Unable to load GeoJSON from ${src}`);
        }
        return response.json();
      })
      .then((data) => ({ features: geoJsonToFeatures(data), raw: data }))
      .catch((error) => {
        console.warn('GeoJSON map data failed to load', error);
        return null;
      });
  }

  function loadMarkersSafe(src) {
    return fetch(src)
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to load markers from ${src}`);
        return response.json();
      })
      .then((data) => data.markers || [])
      .catch((error) => {
        console.warn('Marker data failed to load', error);
        return null;
      });
  }

  function geoJsonToFeatures(geojson) {
    if (!geojson || !Array.isArray(geojson.features)) return null;
    return geojson.features
      .map((feature) => {
        if (!feature || !feature.geometry) return null;
        const name = (feature.properties && feature.properties.name) || feature.id || 'State';
        const geometry = feature.geometry;
        if (geometry.type === 'Polygon') {
          return {
            name,
            geometryType: 'polygon',
            isMulti: false,
            coordinates: geometry.coordinates,
            region: inferRegionFromName(name)
          };
        }
        if (geometry.type === 'MultiPolygon') {
          return {
            name,
            geometryType: 'polygon',
            isMulti: true,
            coordinates: geometry.coordinates,
            region: inferRegionFromName(name)
          };
        }
        return null;
      })
      .filter(Boolean);
  }

  function buildStateMarkersIndexFromJson(markers) {
    const index = {};
    markers.forEach((m) => {
      if (!m.s) return;
      if (!index[m.s]) index[m.s] = [];
      index[m.s].push({ name: m.n, lat: m.lat, lng: m.lng });
    });
    return index;
  }

  function stateNameToKey(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function handleStateSelection(stateName, panelApi, filesData) {
    if (!panelApi || !stateName) return;
    const key = stateNameToKey(stateName);
    const files = filesData[key] || [];
    panelApi.show(stateName, files);
  }

  function createStateFilesPanel() {
    const panel = document.querySelector('[data-role="state-files-panel"]');
    if (!panel) return null;
    const nameEl = panel.querySelector('[data-role="state-files-name"]');
    const statusEl = panel.querySelector('[data-role="state-files-status"]');
    const emptyEl = panel.querySelector('[data-role="state-files-empty"]');
    const formEl = panel.querySelector('[data-role="state-files-form"]');
    const selectEl = panel.querySelector('[data-role="state-file-select"]');
    const buttonEl = panel.querySelector('[data-role="state-file-open"]');
    const anchor = createHiddenAnchor();

    if (buttonEl && selectEl) {
      buttonEl.addEventListener('click', () => {
        const value = selectEl.value;
        if (!value) return;
        anchor.href = value;
        anchor.click();
      });
      selectEl.addEventListener('change', () => {
        buttonEl.disabled = !selectEl.value;
      });
    }

    return {
      show(stateName, files) {
        panel.classList.remove('hidden');
        if (nameEl) {
          nameEl.textContent = `${stateName} resources`;
        }
        if (statusEl) {
          statusEl.textContent = files.length
            ? `Choose from ${files.length} available file${files.length === 1 ? '' : 's'}.`
            : 'No files uploaded yet for this state.';
        }
        if (!files.length) {
          if (emptyEl) emptyEl.classList.remove('hidden');
          if (formEl) formEl.classList.add('hidden');
          if (buttonEl) buttonEl.disabled = true;
          return;
        }
        if (emptyEl) emptyEl.classList.add('hidden');
        if (formEl) formEl.classList.remove('hidden');
        if (selectEl) {
          selectEl.innerHTML = files
            .map((file) => `<option value="${file.path}">${file.name}</option>`)
            .join('');
        }
        if (buttonEl) {
          buttonEl.disabled = false;
        }
      }
    };
  }

  function createHiddenAnchor() {
    const anchor = document.createElement('a');
    anchor.style.display = 'none';
    anchor.setAttribute('target', '_blank');
    anchor.setAttribute('rel', 'noopener');
    document.body.appendChild(anchor);
    return anchor;
  }

  function initStateSearch(stateMarkersIndex) {
    const panel = document.querySelector('[data-role="state-search-panel"]');
    if (!panel) return;
    const selectEl = panel.querySelector('[data-role="state-search-select"]');
    const resultsList = panel.querySelector('[data-role="state-search-results"]');
    if (!selectEl || !resultsList) return;

    const states = Object.keys(stateMarkersIndex).sort();
    states.forEach((state) => {
      const option = document.createElement('option');
      option.value = state;
      const count = stateMarkersIndex[state].length;
      option.textContent = `${state} (${count} location${count === 1 ? '' : 's'})`;
      selectEl.appendChild(option);
    });

    selectEl.addEventListener('change', () => {
      const selectedState = selectEl.value;
      resultsList.innerHTML = '';
      if (!selectedState) return;
      const markers = (stateMarkersIndex[selectedState] || [])
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name));
      markers.forEach((marker) => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = `https://www.google.com/maps/search/?api=1&query=${marker.lat},${marker.lng}`;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = marker.name;
        li.appendChild(a);
        resultsList.appendChild(li);
      });
    });
  }

  function setMapError(mount, message) {
    const loader = mount.querySelector('.us-map__loader');
    if (loader) {
      loader.textContent = message;
      loader.classList.add('us-map__error');
      return;
    }
    mount.innerHTML = `<p class="us-map__error">${message}</p>`;
  }
})();
