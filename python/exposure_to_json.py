"""Turn the Earth Engine exposure CSV into the web map's exposure.json and a tidy state-level CSV."""
import csv, json, sys
from collections import defaultdict

src, out_json, out_csv = sys.argv[1], sys.argv[2], sys.argv[3]
FIELDS = ["land_flood_ha", "wetland_flood_ha", "pop_land", "pop_wetland",
          "bldg_land", "bldg_wetland", "road_km_land"]
by_lga, totals = defaultdict(list), defaultdict(lambda: defaultdict(float))
for r in csv.DictReader(open(src)):
    y = int(float(r["year"]))
    rec = {"lga": r["ADM2_NAME"], **{f: float(r[f] or 0) for f in FIELDS}}
    by_lga[y].append(rec)
    for f in FIELDS:
        totals[y][f] += rec[f]
for y in by_lga:
    by_lga[y].sort(key=lambda d: -d["land_flood_ha"])
rnd = lambda d: {k: (round(v, 1) if isinstance(v, float) else v) for k, v in d.items()}
data = {
    "note": "People: GHS-POP R2023A interpolated to each year. Buildings: Google Open Buildings Temporal "
            "(2024-25 use 2023). Roads: GRIP4, approximate. Counts are exposure inside detected flooding, not damage.",
    "totals": {y: rnd(dict(totals[y])) for y in sorted(totals)},
    "byLga": {y: [rnd(d) for d in by_lga[y]] for y in sorted(by_lga)},
}
json.dump(data, open(out_json, "w"), separators=(",", ":"))
with open(out_csv, "w", newline="") as fh:
    w = csv.writer(fh)
    w.writerow(["year"] + FIELDS)
    for y in sorted(totals):
        w.writerow([y] + [round(totals[y][f], 1) for f in FIELDS])
for y in sorted(totals):
    print(y, {k: round(v) for k, v in totals[y].items()})
