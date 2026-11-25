// LAGOS FLOOD PROJECT - 05 CONTEXT LAYERS FOR THE WEB MAP
// LGA boundaries and permanent water (JRC seasonality >= 10 months, plus ESA WorldCover water),
// simplified for web use. Basemap context only; not used in any statistic.
var lagos = ee.FeatureCollection('FAO/GAUL/2015/level1').filter(ee.Filter.eq('ADM1_NAME', 'Lagos'));
var aoi = lagos.geometry();
var lgas = ee.FeatureCollection('FAO/GAUL/2015/level2').filter(ee.Filter.eq('ADM1_NAME', 'Lagos'))
  .map(function (f) { return ee.Feature(f.geometry().simplify(60), {lga: f.get('ADM2_NAME')}); });
Export.table.toDrive({collection: lgas, description: 'lagos_lga_boundaries', folder: 'LagosFlood_Context_Layers', fileFormat: 'GeoJSON'});
var water = ee.Image('JRC/GSW1_4/GlobalSurfaceWater').select('seasonality').gte(10)
  .or(ee.Image('ESA/WorldCover/v200/2021').select('Map').eq(80)).selfMask().clip(aoi.buffer(3000));
var waterVec = water.reduceToVectors({geometry: aoi.buffer(3000), scale: 60, geometryType: 'polygon', eightConnected: true, maxPixels: 1e10, tileScale: 8})
  .filter(ee.Filter.gt('count', 30))
  .map(function (f) { return ee.Feature(f.geometry().simplify(60), {}); });
Export.table.toDrive({collection: waterVec, description: 'lagos_permanent_water', folder: 'LagosFlood_Context_Layers', fileFormat: 'GeoJSON'});
Map.centerObject(lagos, 10); Map.addLayer(water, {palette: ['08306b']}, 'water'); Map.addLayer(lgas, {color: 'red'}, 'LGAs');
