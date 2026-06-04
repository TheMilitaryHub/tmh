import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
KML_PATH = ROOT / 'data' / 'state-resources.kml'
GEOJSON_PATH = ROOT / 'data' / 'us-states.json'
OUTPUT_PATH = ROOT / 'data' / 'map-markers.json'


def build_style_index(text):
    index = {}
    for m in re.finditer(r'<Style\s+id="([^"]+)"[\s\S]*?</Style>', text):
        style_id = m.group(1)
        block = m.group(0)
        href_m = re.search(r'<href>([^<]+)</href>', block)
        if not href_m:
            continue
        icon_m = re.search(r'icon-(\d+)\.png', href_m.group(1))
        if not icon_m:
            continue
        index['#' + style_id] = int(icon_m.group(1))
    return index


def apply_style_maps(text, style_index):
    resolved = dict(style_index)
    for m in re.finditer(r'<StyleMap\s+id="([^"]+)"[\s\S]*?</StyleMap>', text):
        map_id = m.group(1)
        block = m.group(0)
        normal_m = re.search(
            r'<key>normal</key>\s*<styleUrl>([^<]+)</styleUrl>', block
        )
        if not normal_m:
            continue
        normal_url = normal_m.group(1).strip()
        if normal_url in style_index:
            resolved['#' + map_id] = style_index[normal_url]
    return resolved


def extract_placemarks(text, style_icon_map):
    results = []
    for m in re.finditer(r'<Placemark>([\s\S]*?)</Placemark>', text):
        block = m.group(1)
        if '<Point>' not in block:
            continue
        name_m = re.search(r'<name>([^<]*)</name>', block)
        name = name_m.group(1).strip() if name_m else 'Location'
        coord_m = re.search(
            r'<coordinates>\s*([-\d.]+),([-\d.]+)', block
        )
        if not coord_m:
            continue
        lng = float(coord_m.group(1))
        lat = float(coord_m.group(2))
        style_m = re.search(r'<styleUrl>([^<]+)</styleUrl>', block)
        style_url = style_m.group(1).strip() if style_m else None
        icon_idx = style_icon_map.get(style_url) if style_url else None
        results.append({'name': name, 'lat': lat, 'lng': lng, 'iconIdx': icon_idx})
    return results


def point_in_polygon(lon, lat, ring):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if ((yi > lat) != (yj > lat)) and (
            lon < (xj - xi) * (lat - yi) / (yj - yi) + xi
        ):
            inside = not inside
        j = i
    return inside


def find_state_for_point(lon, lat, geojson):
    for feature in geojson.get('features', []):
        if not feature or not feature.get('geometry'):
            continue
        name = feature.get('properties', {}).get('name')
        if not name:
            continue
        geo = feature['geometry']
        geo_type = geo['type']
        coords = geo['coordinates']
        if geo_type == 'Polygon':
            if point_in_polygon(lon, lat, coords[0]):
                return name
        elif geo_type == 'MultiPolygon':
            for polygon in coords:
                if point_in_polygon(lon, lat, polygon[0]):
                    return name
    return None


def main():
    kml_text = KML_PATH.read_text(encoding='utf-8')
    geojson = json.loads(GEOJSON_PATH.read_text(encoding='utf-8'))

    style_index = build_style_index(kml_text)
    style_icon_map = apply_style_maps(kml_text, style_index)
    placemarks = extract_placemarks(kml_text, style_icon_map)

    markers = []
    for pm in placemarks:
        state = find_state_for_point(pm['lng'], pm['lat'], geojson)
        markers.append({
            'n': pm['name'],
            'lat': pm['lat'],
            'lng': pm['lng'],
            'i': pm['iconIdx'],
            's': state,
        })

    OUTPUT_PATH.write_text(json.dumps({'markers': markers}), encoding='utf-8')

    null_count = sum(1 for m in markers if m['s'] is None)
    print(f"Written {len(markers)} markers to data/map-markers.json")
    if null_count:
        print(f"  ({null_count} markers have no state assignment — likely non-US locations)")


if __name__ == '__main__':
    main()
