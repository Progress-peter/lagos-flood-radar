# Lagos Flood Radar: Nine Rainy Seasons of Satellite-Detected Flooding, 2017–2025

**Live Demo:** [lagos-flood-radar.vercel.app](https://lagos-flood-radar.vercel.app) · **Case study:** [progress-akpan-portfolio.vercel.app/projects/lagos-flood-radar](https://progress-akpan-portfolio.vercel.app/projects/lagos-flood-radar/)

## Overview

Flooding is a yearly event in Lagos, but the evidence for where it happens is mostly news photographs and single-event reports. This project builds a consistent nine-year record from Sentinel-1 synthetic aperture radar (SAR), which images the ground day or night and through cloud.

For every rainy season from 2017 to 2025, each April–October radar image is compared with the same year's dry-season baseline. Ground that turns radar-dark in at least two images is mapped as flooded. Permanent water, open lagoon and sand-filled reclamation sites are removed, and flooding of wetlands and mangroves is reported separately from flooding on land. The flooded areas are then overlaid on population, building and road data for each Local Government Area (LGA).

## Problem statement

Flood-risk planning in Lagos needs to know which places flood repeatedly, not just which flooded in one headline year. Optical satellites are blind in the rainy season because of cloud, and single-event radar maps depend heavily on the two dates chosen. A first test on the September–October 2022 floods found only 574–1,201 ha from individual image pairs, and almost nothing along the Ogun River in Kosofe, where flooding had been expected. The question became: across nine full rainy seasons, where does radar consistently detect inundation, how much of it is real flooding of land rather than lagoon surface or natural wetland, and who lives inside it?

## Objectives

1. Map satellite-detected flooding in Lagos State for every rainy season from 2017 to 2025 with one consistent method.
2. Separate flooding of land from natural wetland and mangrove inundation, and remove permanent water and false detections.
3. Identify where flooding recurs across years.
4. Estimate the people, buildings and roads inside flooded areas, by LGA and year, and publish the results as an interactive map.

## Study area

All of Lagos State, Nigeria: 20 LGAs and about 3,800 km² inside the FAO GAUL 2015 boundary, including Lagos Lagoon, Lekki Lagoon and Badagry Creek.

## Data & sources

| Dataset | Source | Date | Resolution | Format |
|---|---|---|---|---|
| Sentinel-1 GRD, VH polarisation | Copernicus / ESA (GEE `COPERNICUS/S1_GRD`) | 2017–2025 | 10 m pixels, analysed at 20 m | GEE image collection |
| Global Surface Water v1.4 | EC Joint Research Centre (`JRC/GSW1_4/GlobalSurfaceWater`) | 1984–2021 | 30 m | GEE image |
| ESA WorldCover v200 | European Space Agency (`ESA/WorldCover/v200`) | 2021 | 10 m | GEE image |
| SRTM DEM | NASA / USGS (`USGS/SRTMGL1_003`) | 2000 | 30 m | GEE image |
| CHIRPS daily rainfall | UCSB Climate Hazards Center (`UCSB-CHG/CHIRPS/DAILY`) | 2022 | ~5.5 km | GEE image collection |
| GHS-POP R2023A | EC Joint Research Centre (`JRC/GHSL/P2023A/GHS_POP`) | 2015, 2020, 2025 | 100 m | GEE image collection |
| Open Buildings 2.5D Temporal v1 | Google (`GOOGLE/Research/open-buildings-temporal/v1`) | 2016–2023 | ~4 m | GEE image collection |
| GRIP4 roads (Africa) | Meijer et al. 2018, GEE community catalog | 2018 | Vector | GEE feature collection |
| LGA boundaries | FAO GAUL 2015 (`FAO/GAUL/2015/level2`) | 2015 | Vector | GEE feature collection |

## Methodology

`Sentinel-1A VH, track 1 → daily mosaics + 50 m smoothing → Jan–Mar baseline → Apr–Oct change test → ≥2 hits per year → masks (water, bare, slope) → land vs wetland → exposure by LGA → Leaflet map`

1. **One track, one satellite.** Only Sentinel-1A on ascending relative orbit 1 is used. It is the only track covering all of Lagos, and Sentinel-1A has a constant 12-day revisit across the whole period. Adding Sentinel-1B (2017–2021) or Sentinel-1C (2025) would give those years more chances to detect flooding and break comparability.
2. **Baseline.** Images are merged by date, smoothed with a 50 m focal mean to reduce speckle, and the January–March median VH backscatter is each year's dry-season reference.
3. **Change test.** A 20 m cell is flood-dark in an April–October image when its VH backscatter drops by more than 3 dB from the baseline and falls below −20 dB.
4. **Yearly flood extent.** A cell counts as flooded in a year when it is flood-dark in at least two separate images (17–18 rainy-season images per year).
5. **Masks.** JRC permanent water (≥10 months a year), ESA WorldCover open water and bare ground, slopes above 5°, and clusters smaller than 8 cells are removed.
6. **Classification.** Remaining cells on WorldCover herbaceous wetland or mangrove are labelled wetland inundation; all others are flooding on land.
7. **Exposure.** Population density, yearly building counts and rasterised road length are summed inside each year's flooded cells, by LGA.

### Validation

Every cell flagged by the first version (24,138 ha across nine years) was checked against ESA WorldCover. 35% sat on open lagoon or creek water that the JRC mask had missed and 4% on bare or sand-filled ground (one-off detections at reclamation sites); both were removed. 28% sat on wetland or mangrove (kept, reported separately) and 33% on trees, grass, cropland or built-up land (kept as flooding on land). Full breakdown by LGA: [`results/validation_v1_landcover_check.csv`](results/validation_v1_landcover_check.csv).

## Results

| Year | Flooded land (ha) | Wetland / mangrove (ha) | LGAs with most flooded land (ha) |
|---|---:|---:|---|
| 2017 | 1,096 | 1,641 | Ibeju-Lekki 446 · Epe 388 · Badagry 141 |
| 2018 | 786 | 3,593 | Ibeju-Lekki 294 · Epe 231 · Badagry 145 |
| 2019 | 1,191 | 2,849 | Epe 423 · Ibeju-Lekki 410 · Badagry 243 |
| 2020 | 1,087 | 1,633 | Epe 378 · Ibeju-Lekki 372 · Badagry 212 |
| 2021 | 1,331 | 2,665 | Epe 670 · Ibeju-Lekki 396 · Badagry 136 |
| 2022 | 1,226 | 2,587 | Epe 623 · Ibeju-Lekki 412 · Badagry 82 |
| 2023 | 927 | 3,420 | Epe 418 · Ibeju-Lekki 326 · Badagry 116 |
| 2024 | 1,169 | 2,629 | Epe 622 · Ibeju-Lekki 400 · Badagry 55 |
| 2025 | 1,559 | 3,270 | Epe 711 · Ibeju-Lekki 657 · Badagry 69 |

| Year | People in flooded land | Buildings | Roads, km (approx.) |
|---|---:|---:|---:|
| 2017 | 913 | 85 | 1 |
| 2018 | 1,014 | 94 | 2 |
| 2019 | 1,751 | 159 | 3 |
| 2020 | 3,255 | 139 | 2 |
| 2021 | 1,953 | 153 | 2 |
| 2022 | 1,993 | 254 | 4 |
| 2023 | 365 | 276 | 2 |
| 2024 | 2,201 | 876 | 2 |
| 2025 | 2,942 | 1,363 | 2 |

- **The same three LGAs flood every year.** Epe, Ibeju-Lekki and Badagry hold most of the flooded land in all nine seasons, along the margins of Lekki Lagoon and Badagry Creek; Epe has the most in 7 of 9 years.
- **No steady upward trend.** Flooded land ranges from 786 ha (2018) to 1,559 ha (2025) and rises and falls with the season; nine years is too short to claim a trend.
- **Wetland flooding is the larger and more regular signal.** Most flooding on land is detected in only one or two of the nine years.
- **Exposure is low but concentrated.** Most detected flooding is in thinly populated lagoon margins. The jump in buildings in 2024–25 comes from a few small detections in dense neighbourhoods (Eti-Osa 2024, Lagos Mainland 2025) that need ground checking.
- **The 2022 Ogun River signal was not found** in the ascending-track image pairs (Kosofe under 1 ha).

Exposure figures are counts of people and assets located inside detected flooding, **not** reported damage. Area totals in the tables come from the 20 m Earth Engine analysis; exposure-run totals differ by 1–2% because they are summed on a projected grid.

## Limitations

- **Urban flash floods are under-counted.** Street flooding that drains within hours, and water between buildings, is mostly invisible to C-band SAR at a 12-day revisit; central Lagos looks drier than it is.
- **Thresholds are fixed, not locally calibrated.** The −3 dB and −20 dB thresholds are standard values and have not been tested against field-mapped flood extents in Lagos.
- **Land cover is a 2021 snapshot.** Sites cleared or sand-filled before or after 2021 may still produce false detections, especially in Ibeju-Lekki.
- **Exposure is approximate.** Population is a 100 m model interpolated between 2015, 2020 and 2025; buildings for 2024–25 use the 2023 layer; GRIP4 roads are coarse.
- **2026 is excluded.** Sentinel-1A had recorded only 8 rainy-season images by November 2026, against 17–18 in other years.

## Technologies

Google Earth Engine (JavaScript) · Sentinel-1 SAR · ESA WorldCover · JRC Global Surface Water · GHS-POP · Google Open Buildings Temporal · Python (GeoPandas, Rasterio, Pillow) · Leaflet 1.9.4 · HTML / CSS / JavaScript · Google Colab · Vercel

## Repository structure

```
gee/       Earth Engine scripts (run in order in the Code Editor)
  01_Lagos_Flood_Data_Inventory.js      Sentinel-1 track inventory + CHIRPS rainfall, 2022
  02_Lagos_Flood_Extent_2022.js         first test: 2022 before/after image pairs
  03_Lagos_Flood_Recurrence_2017_2025.js  main analysis (v2, validated): yearly extents, recurrence, exports
  04_Lagos_Flood_Exposure_2017_2025.js  population, buildings and roads inside flooded areas, by LGA
  05_Lagos_Flood_Context_Layers.js      LGA boundaries and permanent water for the web map
python/
  prep_web_layers.py     simplifies the yearly GeoJSONs and renders recurrence PNGs for the map
  exposure_to_json.py    turns the exposure CSV into the map's exposure.json and state totals
results/   annual statistics, exposure by LGA and year, state totals, validation breakdown (CSV)
web/       the Leaflet page (index.html); its data/ folder is generated, see below
```

## Reproducibility

1. **Earth Engine.** Open each script in `gee/` in the [Code Editor](https://code.earthengine.google.com/) and run it. Script 03 holds the main analysis; its Tasks tab exports nine yearly GeoJSONs (`lagos_flood_YYYY.geojson`, property `type`: 1 = land, 2 = wetland) and `lagos_flood_recurrence_2017_2025.tif` (bands `land_years`, `wetland_years`) to Google Drive. Script 04 exports `lagos_flood_exposure_by_lga_2017_2025.csv`; script 05 exports the LGA and water context layers.
2. **Python** (Python 3.10+, `pip install geopandas rasterio pillow`). Put the exports in `data/raw/`, then:
   ```bash
   python python/prep_web_layers.py data/raw web/data
   python python/exposure_to_json.py data/raw/lagos_flood_exposure_by_lga_2017_2025.csv web/data/exposure.json results/exposure_state_totals_2017_2025.csv
   ```
   Copy `lagos_lga_boundaries.geojson` and `lagos_permanent_water.geojson` to `web/data/lga.geojson` and `web/data/water.geojson`.
3. **Web map.** Serve `web/` with any static server (`python -m http.server -d web`). The generated `web/data/` folder (~8 MB) is not stored in this repository; the deployed copy is at the live demo.

No credentials or API keys are needed beyond an Earth Engine account.

---
© 2026 Progress Peter Akpan · [Portfolio](https://progress-akpan-portfolio.vercel.app) · Data remain under their original licences (Copernicus, ESA, JRC, Google Open Buildings CC BY 4.0, GRIP4, FAO GAUL).
