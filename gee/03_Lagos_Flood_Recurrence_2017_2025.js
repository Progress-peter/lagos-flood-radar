// =====================================================
// LAGOS FLOOD PROJECT
// 03 - MULTI-YEAR FLOOD EXTENT & RECURRENCE, 2017–2025  (v2, validated)
//
// For each year: dry-season (Jan–Mar) VH baseline vs. every
// rainy-season (Apr–Oct) acquisition on the same track.
// A pixel counts as flooded that year if it is flood-dark in
// >= 2 acquisitions. Sentinel-1A ONLY, so every year has the
// same 12-day sampling.
//
// v2 changes after land-cover validation (ESA WorldCover 2021):
//  - 35% of v1 detections were lagoon/creek surface that JRC
//    did not class as permanent water -> WorldCover water masked.
//  - Bare/sand-filled ground (reclamation, construction sites in
//    Eti-Osa, Ibeju-Lekki, Apapa) gave one-off false positives
//    -> WorldCover bare masked.
//  - Wetland/mangrove inundation is natural seasonal flooding and
//    is reported separately from flooding on land.
// 2026 excluded: only 8 S1A rainy-season scenes (vs 17–18).
// =====================================================

var YEARS = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
var PASS = 'ASCENDING', ORBIT = 1;
var SMOOTH_RADIUS_M = 50, DROP_DB = -3, WATER_VH_DB = -20;
var MIN_HITS = 2, MAX_SLOPE_DEG = 5, MIN_CLUSTER_PX = 8, STATS_SCALE = 20;

var lagos = ee.FeatureCollection('FAO/GAUL/2015/level1')
  .filter(ee.Filter.eq('ADM1_NAME', 'Lagos'));
var aoi = lagos.geometry();
var lgas = ee.FeatureCollection('FAO/GAUL/2015/level2')
  .filter(ee.Filter.eq('ADM1_NAME', 'Lagos'));
Map.centerObject(lagos, 10);

var s1 = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterBounds(aoi)
  .filter(ee.Filter.eq('instrumentMode', 'IW'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
  .filter(ee.Filter.eq('orbitProperties_pass', PASS))
  .filter(ee.Filter.eq('relativeOrbitNumber_start', ORBIT))
  .filter(ee.Filter.eq('platform_number', 'A'))
  .select('VH');

var permanentWater = ee.Image('JRC/GSW1_4/GlobalSurfaceWater')
  .select('seasonality').gte(10).unmask(0);
var wc = ee.Image('ESA/WorldCover/v200/2021').select('Map');
var excludeCover = wc.eq(80).or(wc.eq(60));          // open water, bare/sand
var wetlandCover = wc.eq(90).or(wc.eq(95));          // herbaceous wetland, mangrove
var slope = ee.Terrain.slope(ee.Image('USGS/SRTMGL1_003'));
var areaHa = ee.Image.pixelArea().divide(1e4);

function dailyMosaics(col) {
  var days = col.aggregate_array('system:time_start')
    .map(function (t) { return ee.Date(t).format('YYYY-MM-dd'); })
    .distinct();
  return ee.ImageCollection(days.map(function (d) {
    var start = ee.Date(d);
    return col.filterDate(start, start.advance(1, 'day')).mosaic()
      .focal_mean(SMOOTH_RADIUS_M, 'circle', 'meters');
  }));
}

// Returns a 1-band image: 1 = flooding on land, 2 = wetland inundation
function yearFlood(y) {
  var dryCol = s1.filterDate(y + '-01-01', y + '-04-01');
  var wet = dailyMosaics(s1.filterDate(y + '-04-01', y + '-11-01'));
  var dry = dailyMosaics(dryCol).median();
  var hits = wet.map(function (img) {
    return img.subtract(dry).lt(DROP_DB).and(img.lt(WATER_VH_DB)).unmask(0);
  }).sum();
  var flood = hits.gte(MIN_HITS)
    .and(permanentWater.not())
    .and(excludeCover.not())
    .and(slope.lt(MAX_SLOPE_DEG))
    .clip(aoi);
  flood = flood.updateMask(flood);
  flood = flood.updateMask(flood.connectedPixelCount(MIN_CLUSTER_PX + 1).gte(MIN_CLUSTER_PX));
  return {
    type: flood.where(wetlandCover, 2).rename('type').toByte(),
    nDry: dryCol.size(),
    nWet: wet.size()
  };
}

// ---------- Run each year ----------
var typeByYear = {};
YEARS.forEach(function (y) {
  var r = yearFlood(y);
  typeByYear[y] = r.type;
  var land = r.type.eq(1).selfMask();

  var byType = areaHa.addBands(r.type).reduceRegion({
    reducer: ee.Reducer.sum().group({groupField: 1, groupName: 'type'}),
    geometry: aoi, scale: STATS_SCALE, maxPixels: 1e10, tileScale: 8
  }).get('groups');
  var landByLga = land.multiply(areaHa).reduceRegions({
    collection: lgas.select(['ADM2_NAME']), reducer: ee.Reducer.sum(),
    scale: STATS_SCALE, tileScale: 8
  }).filter(ee.Filter.gt('sum', 0)).sort('sum', false)
    .reduceColumns(ee.Reducer.toList(2), ['ADM2_NAME', 'sum']).get('list');

  ee.Dictionary({year: y, n_dry: r.nDry, n_wet: r.nWet,
                 by_type_ha: byType, land_by_lga_ha: landByLga})
    .evaluate(function (res, err) {
      print('YEAR_RESULT_START' + (err ? 'ERR ' + y + ':' + err : JSON.stringify(res)) + 'YEAR_RESULT_END');
    });

  Map.addLayer(r.type, {min: 1, max: 2, palette: ['00bfff', '2ca25f']},
    'Flood ' + y + ' (blue land / green wetland)', y === 2022);
});

// ---------- Recurrence: years flooded, per type ----------
function recurrenceOf(code) {
  return ee.ImageCollection(YEARS.map(function (y) {
    return typeByYear[y].eq(code).unmask(0);
  })).sum().toByte();
}
var landRecurrence = recurrenceOf(1).rename('land_years');
var wetlandRecurrence = recurrenceOf(2).rename('wetland_years');
var recPalette = ['ffffb2', 'fecc5c', 'fd8d3c', 'f03b20', 'bd0026'];
Map.addLayer(landRecurrence.selfMask(), {min: 1, max: 6, palette: recPalette},
  'Land flooding recurrence (years of 9)');
Map.addLayer(wetlandRecurrence.selfMask(), {min: 1, max: 9, palette: ['c7e9c0', '238b45']},
  'Wetland inundation recurrence (years of 9)', false);
Map.addLayer(ee.Image().paint(lgas, 0, 1), {palette: ['999999']}, 'LGA boundaries');

// ---------- Exports for the Leaflet map (start them in the Tasks tab) ----------
YEARS.forEach(function (y) {
  var vectors = typeByYear[y].reduceToVectors({
    geometry: aoi, scale: STATS_SCALE, geometryType: 'polygon',
    eightConnected: true, labelProperty: 'type', maxPixels: 1e10, tileScale: 8
  }).map(function (f) {
    return f.set({year: y, area_ha: f.geometry().area(1).divide(1e4)});
  });
  Export.table.toDrive({
    collection: vectors, description: 'lagos_flood_' + y,
    folder: 'LagosFlood_Yearly_Extent_GeoJSON', fileFormat: 'GeoJSON'
  });
});
Export.image.toDrive({
  image: landRecurrence.addBands(wetlandRecurrence),
  description: 'lagos_flood_recurrence_2017_2025',
  folder: 'LagosFlood_Recurrence_Raster', region: aoi, scale: STATS_SCALE,
  crs: 'EPSG:4326', maxPixels: 1e10
});
