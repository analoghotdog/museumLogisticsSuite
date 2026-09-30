/* ============================================================
   CLM/1 — Collection Logistics Suite · SHARED LIBRARY
   ------------------------------------------------------------------
   Single source of truth for the standard data all three tools use:
   standard boxes, store/bay presets, tray footprints, typical crate
   sizes, object-type height defaults, vehicle presets.

   Loaded via <script src="clm-library.js"> by every suite app.
   If this file is missing, each app falls back to its built-in copy,
   so the tools still work standalone — but edit THIS file to keep the
   suite in sync.

   Dimensions are millimetres. Preset shape convention:
     shelf/box/crate preset: { name, l, d, h }   (l = width along the wall,
                                                   d = depth front-to-back,
                                                   h = clear/outer height)
     tray footprint:         { label, l, w }     (internal footprint)
     vehicle:                { name, d, w, h, doorW, doorH }
   ============================================================ */

window.CLM_LIBRARY = {

  version: '1',

  /* ---- standard collection boxes (height is external) ---- */
  standardBoxes: [
    { name: 'Box C',  l: 430, w: 280, h: 95  },
    { name: 'Box D',  l: 435, w: 285, h: 190 },
    { name: 'Box E',  l: 585, w: 435, h: 95  },
    { name: 'Box F',  l: 585, w: 435, h: 190 },
    { name: 'Box A1', l: 682, w: 427, h: 285 },
    { name: 'Box A',  l: 685, w: 427, h: 145 },
    { name: 'Box B',  l: 877, w: 432, h: 145 },
    { name: 'Box B1', l: 877, w: 432, h: 285 },
    { name: 'Box G',  l: 430, w: 280, h: 305 },
    { name: 'Box H',  l: 215, w: 280, h: 305 }
  ],

  /* ---- store / bay presets (shelf clearances) ---- */
  shelfPresets: [
    { name: 'Hurunui (Panel)',        l: 900,  d: 450, h: 320  },
    { name: 'Waimakariri (Longspan)', l: 1800, d: 500, h: 340  },
    { name: 'Textiles 1 (Longspan)',  l: 1800, d: 900, h: 300  },
    { name: 'Textiles 2 (Longspan)',  l: 1800, d: 700, h: 300  },
    { name: 'Otakaro (Panel)',        l: 900,  d: 300, h: 320  },
    { name: 'Geology (Longspan)',     l: 1060, d: 750, h: 500  },
    { name: 'Vertebrate (Longspan)',  l: 2190, d: 750, h: 375  },
    { name: 'Wet store (Panel)',      l: 900,  d: 250, h: 150  },
    { name: 'Pallet Racking short',   l: 2700, d: 900, h: 900  },
    { name: 'Pallet Racking tall',    l: 2700, d: 900, h: 1500 },
    { name: 'Pallet tub',             l: 920,  d:1115, h:620   }
  ],

  /* ---- box presets (same units, offered as placeable containers) ---- */
  boxPresets: [
    { name: 'Box C',  l: 430, d: 280, h: 95  },
    { name: 'Box D',  l: 435, d: 285, h: 190 },
    { name: 'Box E',  l: 585, d: 435, h: 95  },
    { name: 'Box F',  l: 585, d: 435, h: 190 },
    { name: 'Box A1', l: 682, d: 427, h: 285 },
    { name: 'Box A',  l: 685, d: 427, h: 145 },
    { name: 'Box B',  l: 877, d: 432, h: 145 },
    { name: 'Box B1', l: 877, d: 432, h: 285 },
    { name: 'Box G',  l: 430, d: 280, h: 305 },
    { name: 'Box H',  l: 215, d: 280, h: 305 }
  ],

  /* ---- typical CaPackyBara crate output (external dims) ----
     Derived with the app's default allowances:
       tray: footprint 895×790 internal + 18 mm side wall + 18 mm base + 0 lid
       crate: + 30 mm sides, 150 mm base board, 18 mm top, 12 mm interlayer
     Treat as starting points — regenerate exact dims from CaPackyBara. */
  cratePresets: [
    { name: 'ClipCrate tray 100 (ext)',   l: 931, d: 826, h: 118 },
    { name: 'ClipCrate tray 200 (ext)',   l: 931, d: 826, h: 218 },
    { name: 'ClipCrate 1×200 (ext)',      l: 991, d: 886, h: 386 },
    { name: 'ClipCrate 2×200 (ext)',      l: 991, d: 886, h: 616 },
    { name: 'ClipCrate 3×200 (ext)',      l: 991, d: 886, h: 846 }
  ],

  /* ---- tray internal footprints offered by CaPackyBara ---- */
  trayFootprints: [
    { label: 'ClipCrate',        l: 895, w: 790 },
    { label: 'Half ClipCrate',   l: 440, w: 790 },
    { label: 'Quarter ClipCrate', l: 440, w: 395 }
  ],

  /* ---- assumed object heights by nomenclature type (mm) ---- */
  typeHeights: {
    'pendant': 15,
    'hei tiki': 20,
    'hei-tiki': 20,
    'heitiki': 20,
    'tool': 50,
    'adze': 50,
    'chisel': 50,
    'mere': 60,
    'boulder': 150,
    'modern': 45,
    'raw': 100
  },

  /* ---- vehicle / lift presets for Otter Fit ----
     Editable starting points, not measurements of specific vehicles. */
  vehicles: [
    { name: 'Lift car (large)', d: 4400, w: 2100, h: 2500, doorW: 1800, doorH: 2400 },
    { name: 'Lift car (small)', d: 2500, w: 1600, h: 2200, doorW: 1100, doorH: 2100 },
    { name: 'Cage van',         d: 4200, w: 1800, h: 1900, doorW: 1300, doorH: 1800 }
    
  ]
};
