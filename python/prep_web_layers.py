"""Simplify yearly flood GeoJSONs and render recurrence PNG overlays for the Leaflet map."""
import json, sys
from pathlib import Path
import geopandas as gpd, numpy as np, rasterio
from PIL import Image

RAW = Path(sys.argv[1]); OUT = Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
TOL_DEG = 0.00012   # ~13 m at Lagos latitude, below the 20 m analysis grid
summary = {}
for y in range(2017, 2026):
    g = gpd.read_file(RAW / f"lagos_flood_{y}.geojson")
    utm = g.to_crs(32631)
    area_true = utm.groupby("type").geometry.apply(lambda s: s.area.sum() / 1e4)
    d = g.dissolve(by="type").reset_index()[["type", "geometry"]]
    d["geometry"] = d.geometry.simplify(TOL_DEG, preserve_topology=True)
    d["area_ha"] = d["type"].map(area_true).round(1)
    d["year"] = y
    d["label"] = d["type"].map({1: "Flooding on land", 2: "Wetland / mangrove inundation"})
    d.to_file(OUT / f"flood_{y}.geojson", driver="GeoJSON", COORDINATE_PRECISION=5)
    summary[y] = {int(k): round(float(v), 1) for k, v in area_true.items()}
    print(y, summary[y], round((OUT / f"flood_{y}.geojson").stat().st_size / 1e6, 2), "MB")

with rasterio.open(RAW / "lagos_flood_recurrence_2017_2025.tif") as src:
    b = src.bounds
    bounds = [[b.bottom, b.left], [b.top, b.right]]
    ramps = {
        1: ("recurrence_land.png", [(255,255,178),(254,204,92),(253,141,60),(240,59,32),(189,0,38)], 6),
        2: ("recurrence_wetland.png", [(199,233,192),(116,196,118),(35,139,69),(0,90,50),(0,68,27)], 9),
    }
    for band, (fname, cols, vmax) in ramps.items():
        a = src.read(band).astype(int)
        rgba = np.zeros(a.shape + (4,), np.uint8)
        for v in range(1, 10):
            idx = min(int((min(v, vmax) - 1) / max(vmax - 1, 1) * (len(cols) - 1) + 0.5), len(cols) - 1)
            m = a == v
            rgba[m, :3] = cols[idx]; rgba[m, 3] = 230
        Image.fromarray(rgba).save(OUT / fname, optimize=True)
        print(fname, {v: int((a == v).sum()) for v in range(1, 10)})
json.dump({"bounds": bounds, "area_check_ha": summary}, open(OUT / "meta.json", "w"), indent=1)
