// =====================================================
// LAGOS FLOOD PROJECT
// 04 - EXPOSURE OF PEOPLE, BUILDINGS AND ROADS, 2017–2025
//
// Flood extents are rebuilt with exactly the v2 method of script 03
// (same parameters), then overlaid on:
//  - Population: JRC GHS-POP R2023A (100 m), linearly interpolated
//    between the 2015 / 2020 / 2025 epochs to each study year.
//  - Buildings: Google Open Buildings 2.5D Temporal v1
//    (building_fractional_count), matched by year 2017–2023;
//    2024 and 2025 use the 2023 layer (latest available).
//  - Roads: GRIP4 Africa global roads (community catalog),
//    length approximated by rasterising to 10 m.
// EXPOSURE IS NOT DAMAGE: these are counts of people/assets located
// inside satellite-detected inundation, not reported losses.
// =====================================================

var YEARS = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
var PASS = 'ASCENDING', ORBIT = 1;
var SMOOTH_RADIUS_M = 50, DROP_DB = -3, WATER_VH_DB = -20;
var MIN_HITS = 2, MAX_SLOPE_DEG = 5, MIN_CLUSTER_PX = 8;
var CRS = 'EPSG:32631', SCALE = 20;

var lagos = ee.FeatureCollection('FAO/GAUL/2015/level1')
  .filter(ee.Filter.eq('ADM1_NAME', 'Lagos'));
var aoi = lagos.geometry();
var lgas = ee.FeatureCollection('FAO/GAUL/2015/level2')
  .filter(ee.Filter.eq('ADM1_NAME', 'Lagos')).select(['ADM2_NAME']);

// ---------- Flood extent (identical to script 03 v2) ----------
var s1 = ee.ImageCollection('COPERNICUS/S1_GRD').filterBounds(aoi)
  .filter(ee.Filter.eq('instrumentMode', 'IW'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
  .filter(ee.Filter.eq('orbitProperties_pass', PASS))
  .filter(ee.Filter.eq('relativeOrbitNumber_start', ORBIT))
  .filter(ee.Filter.eq('platform_number', 'A'))
  .select('VH');
var permanentWater = ee.Image('JRC/GSW1_4/GlobalSurfaceWater').select('seasonality').gte(10).unmask(0);
var wc = ee.Image('ESA/WorldCover/v200/2021').select('Map');
var excludeCover = wc.eq(80).or(wc.eq(60));
var wetlandCover = wc.eq(90).or(wc.eq(95));
var slope = ee.Terrain.slope(ee.Image('USGS/SRTMGL1_003'));

function dailyMosaics(col) {
  var days = col.aggregate_array('system:time_start')
    .map(function (t) { return ee.Date(t).format('YYYY-MM-dd'); }).distinct();
  return ee.ImageCollection(days.map(function (d) {
    var start = ee.Date(d);
    return col.filterDate(start, start.advance(1, 'day')).mosaic()
      .focal_mean(SMOOTH_RADIUS_M, 'circle', 'meters');
  }));
}
function floodType(y) {
  var dry = dailyMosaics(s1.filterDate(y + '-01-01', y + '-04-01')).median();
  var wet = dailyMosaics(s1.filterDate(y + '-04-01', y + '-11-01'));
  var hits = wet.map(function (img) {
    return img.subtract(dry).lt(DROP_DB).and(img.lt(WATER_VH_DB)).unmask(0);
  }).sum();
  var flood = hits.gte(MIN_HITS).and(permanentWater.not()).and(excludeCover.not())
    .and(slope.lt(MAX_SLOPE_DEG)).clip(aoi);
  flood = flood.updateMask(flood);
  flood = flood.updateMask(flood.connectedPixelCount(MIN_CLUSTER_PX + 1).gte(MIN_CLUSTER_PX));
  return flood.where(wetlandCover, 2).unmask(0).reproject(CRS, null, SCALE);  // 0 none, 1 land, 2 wetland
}

// ---------- Population (people per m², interpolated by year) ----------
var ghs = ee.ImageCollection('JRC/GHSL/P2023A/GHS_POP');
function ghsEpoch(y) {
  return ghs.filter(ee.Filter.calendarRange(y, y, 'year')).first().select('population_count');
}
function popDensity(y) {
  var lo = y < 2020 ? 2015 : 2020, hi = lo + 5, w = (y - lo) / 5;
  var pop = ghsEpoch(lo).multiply(1 - w).add(ghsEpoch(hi).multiply(w));
  var nativeArea = ee.Image.pixelArea().reproject(ghsEpoch(2020).projection());
  return pop.divide(nativeArea);   // people per m², resampled by the reducer
}

// ---------- Buildings (count per 20 m cell, by year) ----------
var obt = ee.ImageCollection('GOOGLE/Research/open-buildings-temporal/v1').filterBounds(aoi);
var obtProj = obt.first().select('building_fractional_count').projection();
function buildingCount(y) {
  var by = Math.min(y, 2023);
  return obt.filter(ee.Filter.calendarRange(by, by, 'year'))
    .select('building_fractional_count').mosaic()
    .setDefaultProjection(obtProj)
    .reduceResolution({reducer: ee.Reducer.sum().unweighted(), maxPixels: 65535})
    .reproject(CRS, null, SCALE)
    .unmask(0);
}

// ---------- Roads (approximate length, km per 10 m pixel) ----------
var roads = ee.FeatureCollection('projects/sat-io/open-datasets/GRIP4/Africa').filterBounds(aoi);
var roadKm = ee.Image(0).byte().paint(roads, 1).reproject(CRS, null, 10)
  .multiply(0.01)   // each 10 m road pixel ≈ 10 m = 0.01 km of road
  .reduceResolution({reducer: ee.Reducer.sum().unweighted(), maxPixels: 64})
  .reproject(CRS, null, SCALE);

// ---------- Run ----------
var areaM2 = ee.Image.pixelArea();
var perYear = YEARS.map(function (y) {
  var t = floodType(y);
  var land = t.eq(1), wet = t.eq(2);
  var dens = popDensity(y).reproject(CRS, null, SCALE).unmask(0);
  var people = dens.multiply(areaM2);
  var bld = buildingCount(y);
  var img = ee.Image.cat([
    areaM2.multiply(land).divide(1e4).rename('land_flood_ha'),
    areaM2.multiply(wet).divide(1e4).rename('wetland_flood_ha'),
    people.multiply(land).rename('pop_land'),
    people.multiply(wet).rename('pop_wetland'),
    bld.multiply(land).rename('bldg_land'),
    bld.multiply(wet).rename('bldg_wetland'),
    roadKm.multiply(land).rename('road_km_land')
  ]);
  return img.reduceRegions({
    collection: lgas, reducer: ee.Reducer.sum(), scale: SCALE, crs: CRS, tileScale: 16
  }).map(function (f) { return f.set('year', y); });
});
var table = ee.FeatureCollection(perYear).flatten();

Export.table.toDrive({
  collection: table,
  description: 'lagos_flood_exposure_by_lga_2017_2025',
  folder: 'Exposure_Population_Roads',
  fileFormat: 'CSV',
  selectors: ['year', 'ADM2_NAME', 'land_flood_ha', 'wetland_flood_ha',
              'pop_land', 'pop_wetland', 'bldg_land', 'bldg_wetland', 'road_km_land']
});

// Quick visual check
Map.centerObject(lagos, 10);
Map.addLayer(floodType(2022).selfMask(), {min: 1, max: 2, palette: ['00bfff', '2ca25f']}, 'Flood 2022');
Map.addLayer(buildingCount(2022).selfMask(), {min: 0, max: 5, palette: ['ffffcc', 'e31a1c']}, 'Buildings 2022 (count/20 m)', false);
Map.addLayer(ee.Image(0).byte().paint(roads, 1, 2).selfMask(), {palette: ['444444']}, 'GRIP4 roads', false);
print('GRIP4 road segments in Lagos:', roads.size());
print('Open Buildings temporal years:', obt.aggregate_array('system:time_start')
  .map(function (t) { return ee.Date(t).get('year'); }).distinct().sort());
