// =====================================================
// LAGOS FLOOD PROJECT
// 01 - STUDY AREA + SENTINEL-1 / CHIRPS DATA INVENTORY
// Purpose: find which S1 tracks cover Lagos, on which dates,
// and line them up against rainfall so pre/post pairs are
// chosen from evidence, not guessed.
// =====================================================

// ---------- 0. Settings ----------
var START = '2022-08-01';   // widen to catch a clean pre-flood baseline
var END   = '2022-11-30';

// ---------- 1. Study area ----------
var lagos = ee.FeatureCollection('FAO/GAUL/2015/level1')
  .filter(ee.Filter.eq('ADM1_NAME', 'Lagos'));
var aoi = lagos.geometry();
var aoiArea = aoi.area(100);

Map.centerObject(lagos, 9);
print('Lagos State area (km²):', aoiArea.divide(1e6));

// ---------- 2. Sentinel-1 GRD (IW, dual-pol) ----------
var s1 = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterBounds(aoi)
  .filterDate(START, END)
  .filter(ee.Filter.eq('instrumentMode', 'IW'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'));

print('Total Sentinel-1 scenes:', s1.size());

// ---------- 3. Per-scene inventory table ----------
// Change detection must compare images from the SAME track
// (pass + relative orbit), otherwise geometry differences
// look like "flooding".
var inventory = ee.FeatureCollection(s1.map(function (img) {
  var coverPct = img.geometry()
    .intersection(aoi, 100)
    .area(100)
    .divide(aoiArea)
    .multiply(100);
  var pass = ee.String(img.get('orbitProperties_pass'));
  var relOrbit = ee.Number(img.get('relativeOrbitNumber_start'));
  return ee.Feature(null, {
    date: img.date().format('YYYY-MM-dd'),
    time_utc: img.date().format('HH:mm'),
    platform: ee.String('S1').cat(ee.String(img.get('platform_number'))),
    pass: pass,
    rel_orbit: relOrbit,
    track: pass.cat('_').cat(relOrbit.format('%d')),
    aoi_cover_pct: coverPct,
    scene_id: img.get('system:index')
  });
})).sort('date');

print('Scene inventory (date / platform / track / % of Lagos covered):', inventory);
print('Scenes per track:', inventory.aggregate_histogram('track'));
print('Scenes per platform:', inventory.aggregate_histogram('platform'));

// ---------- 4. CHIRPS daily rainfall over Lagos ----------
// Coarse (~5.5 km) — context for timing only, not neighbourhood-scale cause.
var chirps = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
  .filterDate(START, END)
  .select('precipitation');

print(
  ui.Chart.image.series({
    imageCollection: chirps,
    region: aoi,
    reducer: ee.Reducer.mean(),
    scale: 5566
  }).setOptions({
    title: 'CHIRPS daily rainfall, Lagos State mean (mm)',
    vAxis: {title: 'mm/day'},
    hAxis: {title: 'Date'},
    lineWidth: 1,
    pointSize: 2
  })
);

// ---------- 5. Context layers ----------
var gsw = ee.Image('JRC/GSW1_4/GlobalSurfaceWater').select('occurrence');
Map.addLayer(
  gsw.clip(aoi).updateMask(gsw.gt(0)),
  {min: 0, max: 100, palette: ['ffffff', '9ecae1', '08306b']},
  'JRC water occurrence 1984–2021 (%)',
  false
);

Map.addLayer(
  s1.select('VV').median().clip(aoi),
  {min: -25, max: 0},
  'S1 VV median (window)'
);

Map.addLayer(
  ee.Image().paint(lagos, 0, 2),
  {palette: 'red'},
  'Lagos State boundary'
);

// ---------- 6. Save the inventory for the README ----------
Export.table.toDrive({
  collection: inventory,
  description: 'lagos_s1_inventory_' + START + '_' + END,
  folder: 'LagosFlood_S1_Inventory',
  fileFormat: 'CSV',
  selectors: ['date', 'time_utc', 'platform', 'pass', 'rel_orbit',
              'track', 'aoi_cover_pct', 'scene_id']
});
