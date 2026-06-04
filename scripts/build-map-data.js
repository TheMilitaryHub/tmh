'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const KML_PATH = path.join(ROOT, 'data', 'state-resources.kml');
const GEOJSON_PATH = path.join(ROOT, 'data', 'us-states.json');
const OUTPUT_PATH = path.join(ROOT, 'data', 'map-markers.json');

const kmlText = fs.readFileSync(KML_PATH, 'utf8');
const geojson = JSON.parse(fs.readFileSync(GEOJSON_PATH, 'utf8'));

function buildStyleIndex(text) {
  const index = {};
  const re = /<Style\s+id="([^"]+)"[\s\S]*?<\/Style>/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const id = m[1];
    const block = m[0];
    const hrefMatch = block.match(/<href>([^<]+)<\/href>/);
    if (!hrefMatch) continue;
    const iconMatch = hrefMatch[1].match(/icon-(\d+)\.png/);
    if (!iconMatch) continue;
    index['#' + id] = parseInt(iconMatch[1], 10);
  }
  return index;
}

function applyStyleMaps(text, styleIndex) {
  const resolved = Object.assign({}, styleIndex);
  const re = /<StyleMap\s+id="([^"]+)"[\s\S]*?<\/StyleMap>/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const id = m[1];
    const block = m[0];
    const normalMatch = block.match(/<key>normal<\/key>\s*<styleUrl>([^<]+)<\/styleUrl>/);
    if (!normalMatch) continue;
    const normalUrl = normalMatch[1].trim();
    if (styleIndex[normalUrl] != null) {
      resolved['#' + id] = styleIndex[normalUrl];
    }
  }
  return resolved;
}

function extractPlacemarks(text, styleIconMap) {
  const results = [];
  const re = /<Placemark>([\s\S]*?)<\/Placemark>/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const block = m[1];
    const nameMatch = block.match(/<name>([^<]*)<\/name>/);
    const name = nameMatch ? nameMatch[1].trim() : 'Location';
    if (!block.includes('<Point>')) continue;
    const coordMatch = block.match(/<coordinates>\s*([-\d.]+),([-\d.]+)/);
    if (!coordMatch) continue;
    const lng = parseFloat(coordMatch[1]);
    const lat = parseFloat(coordMatch[2]);
    if (!isFinite(lng) || !isFinite(lat)) continue;
    const styleUrlMatch = block.match(/<styleUrl>([^<]+)<\/styleUrl>/);
    const styleUrl = styleUrlMatch ? styleUrlMatch[1].trim() : null;
    const iconIdx = styleUrl ? (styleIconMap[styleUrl] || null) : null;
    results.push({ name, lat, lng, iconIdx });
  }
  return results;
}

function pointInPolygon(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

function findStateForPoint(lon, lat, rawGeoJson) {
  if (!rawGeoJson || !Array.isArray(rawGeoJson.features)) return null;
  for (const feature of rawGeoJson.features) {
    if (!feature || !feature.geometry) continue;
    const name = feature.properties && feature.properties.name;
    if (!name) continue;
    const { type, coordinates } = feature.geometry;
    if (type === 'Polygon') {
      if (pointInPolygon(lon, lat, coordinates[0])) return name;
    } else if (type === 'MultiPolygon') {
      for (const polygon of coordinates) {
        if (pointInPolygon(lon, lat, polygon[0])) return name;
      }
    }
  }
  return null;
}

const styleIndex = buildStyleIndex(kmlText);
const styleIconMap = applyStyleMaps(kmlText, styleIndex);
const placemarks = extractPlacemarks(kmlText, styleIconMap);

const markers = placemarks.map((pm) => ({
  n: pm.name,
  lat: pm.lat,
  lng: pm.lng,
  i: pm.iconIdx,
  s: findStateForPoint(pm.lng, pm.lat, geojson)
}));

fs.writeFileSync(OUTPUT_PATH, JSON.stringify({ markers }));
console.log(`Written ${markers.length} markers to data/map-markers.json`);

const nullStateCount = markers.filter((m) => m.s === null).length;
if (nullStateCount > 0) {
  console.log(`  (${nullStateCount} markers have no state assignment — likely non-US locations)`);
}
