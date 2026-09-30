# Collection Logistics Suite

Three single-file web apps for museum collection logistics, knitted together with a shared
data spine — the **clm/1 manifest**. Built as *Phase 0* of the integration plan in
[`../suite-investigation.md`](../suite-investigation.md).

```
suite.html               ← hub: pipeline overview + manifest inspector
capackybara.html         ← 1 · Pack    (objects → padded trays → crates)
stick-it-on-a-shelf.html ← 2 · Store   (crates/boxes → shelves or into a box)
otter-fit.html           ← 3 · Move    (will it fit the car? and the door?)
clm-core.js              ← shared core: manifest adapter + engines (dims/fit/pack2d/export/store)
clm-library.js           ← shared library: boxes, presets, footprints, vehicles
build.js                 ← standalone build → dist/ (engines inlined into each app)
dist/                    ← single-file copies for distribution
```

## Quick start

1. Keep the files in this folder together (CaPackyBara additionally looks for object
   images in a sibling `<import-file>_Media/` folder).
2. Open `suite.html` — it links to all three tools.
3. Each tool needs internet the first time (three.js / fonts / PapaParse / jsPDF load from
   CDNs); after that they work offline.
4. **Distribution:** run `node build.js` and ship the `dist/` folder — those copies inline
   `clm-core.js` + `clm-library.js`, so each file is standalone apart from the CDNs.

## Architecture (Phase 2)

All tools build on two shared files and one three.js build:

| File | Contents | Used by |
|---|---|---|
| `clm-core.js` | **CLM** — clm/1 manifest adapter (make/parse/download/hand-off) | all |
| | **CLM_CORE.dims** — num/numOrNull/parseDimsCell/parseItems, `orientations` (6-case), `sortDesc`, `dimStr` | all |
| | **CLM_CORE.fit** — `checkItem` (car stowage + door passage, incl. partial dims & tilt hints) | otter-fit |
| | **CLM_CORE.pack2d** — `shelf2D` free-rect packer + `mergeFreeRects` + `trayUtil` | capackybara |
| | **CLM_CORE.export** — csvEsc/toCSV/toTSV/downloadText/downloadJSON | all |
| | **CLM_CORE.store** — safe localStorage JSON get/set/remove | shelf, suite |
| `clm-library.js` | standard boxes, store/box/crate presets, tray footprints, type heights, vehicles | all |

Each app keeps only its own UI, scene layout and packing policy on top — the engines are
one-line delegations onto `CLM_CORE`, so behaviour fixes land everywhere at once.

**three.js standardised:** every app loads the same build —
`three@0.160.0` ESM via one shared importmap (`unpkg`), with OrbitControls from
`three/addons/`. Otter Fit and Stick it on a Shelf were migrated from the old r128 global
builds; their viewers fall back gracefully (table/report features still work) if the CDN is
unreachable. The per-app 3D *scenes* stay bespoke on purpose — each tool's interaction
model (drag-repack, tray editing, orbit inspection) is genuinely different — but they now
share one library, and viewer primitives can move into the core incrementally.

**Boot note:** the apps are ES modules (needed for the shared three.js build). Top-level
await means a module can finish after `DOMContentLoaded`; the shelf app boots via a
`readyState` guard to handle that.

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

### Field notes

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

## What changed vs the original apps

Each app keeps its own UI and engine policy. The shared parts — manifest adapter, engines,
library — live in `clm-core.js` / `clm-library.js` and the apps delegate to them. Per app:

| App | Added |
|---|---|
| CaPackyBara | `Load Manifest (clm)` input · `Send to Suite (manifest)` export (crates/trays/items) · banner · library tray footprints + type-height defaults · packer runs on CLM_CORE.pack2d |
| Stick it on a Shelf | `Load Manifest` (crates/boxes become units) · `Send to Suite` (shelves/boxes + placements) · banner · library presets incl. crate sizes · plans/presets on CLM_CORE.store |
| Otter Fit | `Load Manifest` (container-level checks + vehicle/door dims) · `Send to…` (items + fit checks + vehicle) · `📦` unit marking + Unit column in CSV · vehicle presets · “also check source items” toggle · banner · fit checks on CLM_CORE.fit |

Files renamed from the originals: `index.html → stick-it-on-a-shelf.html`,
`otterFit.html → otter-fit.html`; `capackybara.html` keeps its name (its `_Media` convention
keys off the *import data file*, not the HTML, so renames are safe).

## Roadmap (from the investigation)

- **Phase 0 — done:** suite hub + manifest adapters + hand-off.
- **Phase 1 — done:** shared `clm-library.js` (boxes/presets/footprints/vehicles in one
  place), Otter Fit checks manifests at container level with `unit` marking and a Unit
  column in reports, vehicle presets.
- **Phase 2 — done:** shared `clm-core.js` engines (dims/fit/pack2d/export/store), one
  three.js build (0.160 ESM) across all tools, standalone `dist/` builds.
- **Phase 3 (optional):** fold CaPackyBara's packing into Stick it on a Shelf's mode toggle
  ("Objects into trays/crates"), keeping Otter Fit standalone.

## Hosting on GitHub Pages with local data (tools online, data local)

The tools can be published as a static site while the collection data (import TSV and
object images) never leaves your machine:

1. Push the tools to a repo and enable GitHub Pages (repo root, or publish `dist/`).
2. Add a **`.nojekyll`** file at the served root (included in this folder) so Pages serves
   everything verbatim.
3. Keep the import TSV and its `<import-file>_Media/` folder **out of the repo** — the
   `.gitignore` here blocks `*_Media/`, `*.tsv`, `*.csv`, `data/` and common image
   extensions by default so sensitive collection data can't be committed by accident.
   Un-ignore the sample data if you deliberately publish any.
4. Working with real data: open the hosted tool, use **Upload CSV / TSV** to load the
   import file from disk (multiple workstreams? just upload the one you want — each load
   replaces the previous), then **Images Folder (local)** in CaPackyBara and pick the
   `<import-file>_Media/` folder (or any folder of images).

Data-handling guarantees:

- Imports are read with `FileReader` in the browser; picked images become in-browser
  `blob:` object URLs. Nothing is fetched from a server or uploaded anywhere.
- Exports are `Blob` downloads; tool-to-tool hand-off is `localStorage` only.
- Image refs are matched against the picked folder by relative path first, then file
  name, so the folder may be named anything. Path-based loading next to the HTML file
  still works when images are deliberately published alongside the tools.
- Re-picking the folder revokes the previous object URLs.

Remaining network traffic is only the CDN libraries (three.js / PapaParse / jsPDF /
fonts / Tailwind) — requests carry no collection data. To eliminate those too, vendor
the libraries next to the HTML files and point the `<script src>` / importmap entries at
them; the apps work fully offline once vendored.

Local run without GitHub: serve the folder over HTTP (`python3 -m http.server`) and open
`http://localhost:8000/suite.html` — everything above works the same, and with vendored
libraries nothing leaves the machine at all. (`file://` is unreliable for these apps:
they are ES modules, and browsers block module loading over `file://`.)

## Known limits

- Hand-off via `localStorage` may be blocked on some `file://` browser configurations —
  use manifest files instead; everything works without it.
- The modular apps need `clm-core.js` + `clm-library.js` beside them; use `dist/` (built by
  `node build.js`) when you need self-contained single files.
- CaPackyBara imports manifest items as *objects to pack* (names/types/dims); it does not
  yet honour existing placements from a manifest.
- Shelf `Send to Suite` emits one manifest item per placed unit (coordinates included);
  quantity grouping is preserved via the plan file, not the manifest.
- `cratePresets` in the library are *typical* outputs with default allowances — regenerate
  exact dims from CaPackyBara for a specific packing run.
- The XLSM bulk-import companion for Stick it on a Shelf is unchanged and still optional.
