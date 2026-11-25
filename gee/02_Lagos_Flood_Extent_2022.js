// =====================================================
// LAGOS FLOOD PROJECT
// 02 - SENTINEL-1 FLOOD EXTENT, SEPT–OCT 2022
// Method: same-track change detection on VH backscatter
// (after vs. dry-season-ish baseline), with permanent water,
// steep terrain and speckle clusters removed.
// =====================================================

// ---------- 0. Study area ----------
var lagos = ee.FeatureCollection('FAO/GAUL/2015/level1')
  .filter(ee.Filter.eq('ADM1_NAME', 'Lagos'));
var aoi = lagos.geometry();
var lgas = ee.FeatureCollection('FAO/GAUL/2015/level2')
  .filter(ee.Filter.eq('ADM1_NAME', 'Lagos'));
Map.centerObject(lagos, 10);

// ---------- 1. Parameters ----------
var SMOOTH_RADIUS_M = 50;   // speckle filter (focal mean)
var DROP_DB = -3;           // VH must drop by more than 3 dB
var WATER_VH_DB = -20;      // and be water-dark after the event
var MAX_SLOPE_DEG = 5;      // floods do not sit on steep slopes
var MIN_CLUSTER_PX = 8;     // remove isolated speckle pixels
var STATS_SCALE = 20;       // S1 GRD effective resolution ~20 m

// Image pairs chosen from script 01 (same track, before vs. after)
var PAIRS = [
  {id: 'A1_0929', pass: 'ASCENDING',  orbit: 1,  pre: '2022-09-05', post: '2022-09-29'},
  {id: 'A1_1011', pass: 'ASCENDING',  orbit: 1,  pre: '2022-09-05', post: '2022-10-11'},
  {id: 'D95_1006', pass: 'DESCENDING', orbit: 95, pre: '2022-08-31', post: '2022-10-06'},
  {id: 'D95_1018', pass: 'DESCENDING', orbit: 95, pre: '2022-08-31', post: '2022-10-18'}
];

// ---------- 2. Inputs ----------
var s1 = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterBounds(aoi)
  .filter(ee.Filter.eq('instrumentMode', 'IW'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'));

var gsw = ee.Image('JRC/GSW1_4/GlobalSurfaceWater');
var permanentWater = gsw.select('seasonality').gte(10).unmask(0);
var slope = ee.Terrain.slope(ee.Image('USGS/SRTMGL1_003'));

function getScene(date, pass, orbit) {
  var d = ee.Date(date);
  return s1
    .filter(ee.Filter.eq('orbitProperties_pass', pass))
    .filter(ee.Filter.eq('relativeOrbitNumber_start', orbit))
    .filterDate(d, d.advance(1, 'day'))
    .mosaic()
    .select(['VV', 'VH'])
    .focal_mean(SMOOTH_RADIUS_M, 'circle', 'meters')
    .clip(aoi);
}

function floodExtent(p) {
  var before = getScene(p.pre, p.pass, p.orbit);
  var after = getScene(p.post, p.pass, p.orbit);
  var change = after.select('VH').subtract(before.select('VH'));
  var flood = change.lt(DROP_DB)
    .and(after.select('VH').lt(WATER_VH_DB))
    .and(permanentWater.not())
    .and(slope.lt(MAX_SLOPE_DEG));
  flood = flood.updateMask(flood);
  flood = flood.updateMask(flood.connectedPixelCount(MIN_CLUSTER_PX + 1).gte(MIN_CLUSTER_PX));
  return {flood: flood.rename('flood'), before: before, after: after, change: change};
}

// ---------- 3. Run all pairs ----------
var areaHa = ee.Image.pixelArea().divide(1e4);
var results = {};

PAIRS.forEach(function (p) {
  var r = floodExtent(p);

  var total = r.flood.multiply(areaHa).reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: aoi,
    scale: STATS_SCALE,
    maxPixels: 1e10,
    tileScale: 4
  }).get('flood');

  var byLga = r.flood.multiply(areaHa).reduceRegions({
    collection: lgas.select(['ADM2_NAME']),
    reducer: ee.Reducer.sum(),
    scale: STATS_SCALE,
    tileScale: 4
  }).filter(ee.Filter.gt('sum', 0))
    .sort('sum', false)
    .reduceColumns(ee.Reducer.toList(2), ['ADM2_NAME', 'sum'])
    .get('list');

  results[p.id] = ee.Dictionary({
    pre: p.pre, post: p.post, track: p.pass + '_' + p.orbit,
    flooded_ha: total, by_lga_ha: byLga
  });

  Map.addLayer(r.change, {min: -6, max: 6, palette: ['0000ff', 'ffffff', 'ff0000']},
    p.id + ' VH change (dB)', false);
  Map.addLayer(r.flood, {palette: ['00bfff']}, p.id + ' flood extent', p.id === 'A1_1011');
});

// ---------- 4. Context + output ----------
Map.addLayer(permanentWater.selfMask().clip(aoi), {palette: ['08306b']},
  'Permanent water (JRC, ≥10 months)', true);
Map.addLayer(ee.Image().paint(lgas, 0, 1), {palette: ['999999']}, 'LGA boundaries');
Map.addLayer(ee.Image().paint(lagos, 0, 2), {palette: ['ff0000']}, 'Lagos State');

ee.Dictionary(results).evaluate(function (r) {
  print('FLOOD_RESULTS_START' + JSON.stringify(r) + 'FLOOD_RESULTS_END');
});
print('Flood extent results (ha):', ee.Dictionary(results));
