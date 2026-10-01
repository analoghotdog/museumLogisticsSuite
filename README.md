# Collection Logistics Suite

Three single-file web apps for museum collection logistics, knitted together with a shared
data spine — the **clm/1 manifest**. 

```
suite.html - main hub
capackybara.html - pack objects into trays and crates. Get visulisations and download packing plans
stick-it-on-a-shelf.html - what boxes will fit on what shelves? What items into what boxes? Has presets for standard boxes etc
otter-fit.html - Quick check to see what items or crates will fit in a lift, or van etc.  
clm-core.js -  manifest adapter + engines (dims/fit/pack2d/export/store)
clm-library.js - shared library: boxes, presets, footprints, vehicles
build.js -standalone build → dist/ (engines inlined into each app)
dist/ - single-file copies for distribution
```

## Quick start

1. Keep the files in this folder together (CaPackyBara additionally looks for object
   images in a sibling `<import-file>_Media/` folder).
2. Open `suite.html` — it links to all three tools.
3. Each tool needs internet the first time (three.js / fonts / PapaParse / jsPDF load from
   CDNs); after that they work offline.
4. **Distribution:** run `node build.js` and ship the `dist/` folder — those copies inline
   `clm-core.js` + `clm-library.js`, so each file is standalone apart from the CDNs.



## The pipeline

| Stage | Tool | Takes in | Sends out |
|---|---|---|---|
| 1 · Pack | CaPackyBara | museum TSV / CSV of objects | manifest: **crates & trays** (external dims) + items |
| 2 · Store | Stick it on a Shelf | manifest (crates become units) or manual entry | manifest: **shelves/boxes** + placements |
| 3 · Move | Otter Fit | manifest (containers checked at unit level) or pasted list | manifest: **fit checks** (result, rotation, clearances, unit) |

Every tool has **Send to Suite** (exports a manifest + writes the browser hand-off slot) and
**Load Manifest** (imports one). When the tools run in the same browser, the receiving tool
shows a `📥` banner offering to load the manifest directly; file download/upload works
regardless (and is the reliable path for `file://` pages or different machines).

Round trips are fine: e.g. run a quick oversized-object pre-check in Otter Fit, load those
items into CaPackyBara to pack them, place the crates on shelves, then verify the move.

**Container-level checks (Phase 1):** when a manifest carries crates/boxes/trays, Otter Fit
checks *those* — the units that physically get moved — and marks them `📦 <id>` with
`unit: "container"`. Tick **“also check source items”** to check the individual objects listed
inside them too. The CSV report has a matching **Unit** column.

## Shared library (`clm-library.js`)

Single source of truth for data all three tools use. Each app loads it via
`<script src="clm-library.js">` and falls back to built-in copies if it's missing, so the
tools still work standalone — but edit this file to keep the suite in sync:

| Section | Used by | Contents |
|---|---|---|
| `standardBoxes` | Stick it on a Shelf | Box A–H catalogue for the “add items” picker |
| `shelfPresets` | Stick it on a Shelf | store/bay clearances (Hurunui, Waimakariri, …) |
| `boxPresets` | Stick it on a Shelf | boxes as placeable containers |
| `cratePresets` | Stick it on a Shelf | typical CaPackyBara crate output (external dims) |
| `trayFootprints` | CaPackyBara | internal tray footprints offered in the config panel |
| `typeHeights` | CaPackyBara | assumed object heights by nomenclature type |
| `vehicles` | Otter Fit | car/lift/vehicle presets incl. door sizes |

## clm/1 manifest format

```json
{
  "format": "clm/1",
  "project": "Taonga store move",
  "units": "mm",
  "exported": "2026-09-30T00:00:00.000Z",
  "source": { "app": "capackybara", "version": "1" },

  "items": [
    {
      "id": "A1234",
      "name": "Hei tiki B1",
      "type": "Hei tiki",
      "unit": "item",
      "dims": { "l": 120, "w": 80, "h": 20 },
      "dimsAssumed": false,
      "padding": { "pL": 124, "pW": 84, "pH": 50 },
      "image": "objects.tsv_Media/hei_tiki_b1.jpg",
      "notes": "optional",
      "placement": { "container": "Crate 3", "tray": "Crate 3 · Tray 2", "x": 0, "z": 0, "rot": 90 }
    }
  ],

  "containers": [
    { "id": "Crate 3", "kind": "crate", "l": 955, "w": 850, "h": 640,
      "external": true, "children": ["Crate 3 · Tray 1", "Crate 3 · Tray 2"],
      "meta": { "isOversized": false, "overMax": false } },
    { "id": "Car", "kind": "vehicle", "l": 4400, "w": 2100, "h": 2500,
      "external": true, "door": { "w": 1800, "h": 2400 } }
  ],

  "checks": [
    { "item": "Crate 3", "unit": "container", "against": "car", "result": "fit-rotated",
      "rotation": "roll onto side",
      "crossSection": [850, 640],
      "doorClearance": { "w": 950, "h": 1760 },
      "notes": "" }
  ]
}
```

### Notes

- **`dims`** are always the item's *as-entered* dimensions, in the source order. Packing
  orientation is a per-tool policy (CaPackyBara lays the two longest flat, Otter Fit tests
  all six orientations at fit time) — never silently re-sort dims in a manifest.
- **`containers[].l/w/h`** with `"external": true` are outer dims (side walls, base board,
  lid included). That is what must fit on a shelf or in a vehicle. `meta` may carry the
  internal dims (`footprintInternal`, `depthInternal`).
- **`kind`** is one of `tray | crate | box | shelf | vehicle`. `parent`/`children` link
  trays to crates. `door` only appears on `vehicle`.
- **`checks[].result`** values: `fit`, `fit-rotated`, `car-yes-door-no`, `no-fit`,
  `partial — …`, `no-data`.
- **`unit`** on items/checks is `container` for crates/boxes/trays being moved and `item`
  for the objects inside them (Otter Fit marks container rows `📦 <id>`).
- Unknown values are `null`/omitted — not zero.

