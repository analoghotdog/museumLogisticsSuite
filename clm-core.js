/* ============================================================
   CLM/1 — Collection Logistics Suite · SHARED CORE
   ------------------------------------------------------------------
   The shared engine extracted in Phase 2, extended in Phase 3:
     CLM       — the clm/1 manifest adapter (make/parse/download/handoff)
     CLM_CORE  — the engines all tools build on:
                   dims     — parsing, orientation enumeration, formatting
                   fit      — car stowage + door passage checks
                   pack2d   — free-rect 2D packer (trays / flat areas)
                   cratepack— padding → grouping → trays → crates pipeline
                              (incl. tray inventory limits)
                   export   — CSV/TSV/JSON download helpers
                   store    — safe localStorage JSON helpers

   Loaded via <script src="clm-core.js"> before each app's own script.
   The per-app wrappers in the tools are one-liners onto these functions —
   edit behaviour here and every tool follows.

   Extracted from the apps (identical logic):
     orientations/checkItem/parse/dimStr       — otter-fit.html
     numOrNull/parseDimsCell/shelf2D/
     mergeFreeRects/trayUtil                   — capackybara.html
     parseTrayInventory/applyPadding/snapDepth/
     process/groupKey/groupItems/packTrays/
     consolidate/crateHeight/buildCrates/
     validatePlacements                        — capackybara.html (tray inventory edition)
     num                                       — stick-it-on-a-shelf.html
   ============================================================ */

const CLM = {
    FORMAT: 'clm/1',
    esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"]/g,
            c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    },
    make(project, sourceApp, items, containers, checks) {
        return {
            format: CLM.FORMAT,
            project: project || 'Untitled project',
            units: 'mm',
            exported: new Date().toISOString(),
            source: { app: sourceApp || 'unknown', version: '1' },
            items: items || [],
            containers: containers || [],
            checks: checks || []
        };
    },
    parse(text) {
        const d = JSON.parse(text);
        if (!d || d.format !== CLM.FORMAT || !Array.isArray(d.items)) {
            throw new Error('not a clm/1 manifest');
        }
        d.containers = Array.isArray(d.containers) ? d.containers : [];
        d.checks = Array.isArray(d.checks) ? d.checks : [];
        return d;
    },
    download(m, filename) {
        const blob = new Blob([JSON.stringify(m, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename || 'collection-manifest.json';
        a.click();
        URL.revokeObjectURL(a.href);
    },
    handoff(m) {
        try { localStorage.setItem('clm-handoff', JSON.stringify({ t: Date.now(), m })); } catch (e) {}
    },
    readHandoff() {
        try {
            const h = JSON.parse(localStorage.getItem('clm-handoff') || 'null');
            return h && h.m && h.m.format === CLM.FORMAT ? h.m : null;
        } catch (e) { return null; }
    },
    clearHandoff() {
        try { localStorage.removeItem('clm-handoff'); } catch (e) {}
    },
    offerBanner(myApp, onLoad) {
        let m = null;
        try { m = CLM.readHandoff(); } catch (e) {}
        if (!m || (m.source && m.source.app === myApp)) return;
        const div = document.createElement('div');
        div.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:99999;background:#1f2937;' +
            'color:#e5e7eb;border:1px solid #4b5563;border-radius:10px;padding:10px 14px;' +
            'font:13px/1.45 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35);' +
            'display:flex;gap:10px;align-items:center;max-width:460px';
        div.innerHTML = '<span>\uD83D\uDCE5 Manifest <b>\u201c' + CLM.esc(m.project) + '\u201d</b> from ' +
            CLM.esc((m.source && m.source.app) || 'the suite') + ' \u2014 ' + m.items.length + ' item(s), ' +
            m.containers.length + ' container(s)</span>';
        const mk = (label, primary) => {
            const b = document.createElement('button');
            b.textContent = label;
            b.style.cssText = 'cursor:pointer;border-radius:7px;padding:5px 11px;font:600 12px system-ui,sans-serif;' +
                (primary ? 'background:#38bdf8;border:1px solid #38bdf8;color:#082f49'
                         : 'background:transparent;border:1px solid #6b7280;color:#d1d5db');
            return b;
        };
        const load = mk('Load', true), dismiss = mk('Dismiss', false);
        load.onclick = () => { CLM.clearHandoff(); div.remove(); onLoad(m); };
        dismiss.onclick = () => { CLM.clearHandoff(); div.remove(); };
        div.appendChild(load);
        div.appendChild(dismiss);
        document.body.appendChild(div);
    }
};

/* ================================================================
   CLM_CORE — shared engines
   ================================================================ */
(function (root) {

root.CLM = CLM;

/* ---------- dims ---------- */
function numOrNull(x) {
        if (x === undefined || x === null) return null;
        const n = parseFloat(String(x).trim());
        return isFinite(n) && n > 0 ? n : null;
    }

function num(v, dflt) { const n = parseFloat(v); return isFinite(n) ? n : dflt; }

function parseDimsCell(s) {
        if (!s) return [null, null, null];

        const parts = String(s)
            .split(/[,;xX\u00d7]/)
            .map(t => numOrNull(t));

        return [parts[0] ?? null, parts[1] ?? null, parts[2] ?? null];
    }

function sortDesc(l, w, h) {
    return [Number(l), Number(w), Number(h)].sort((a, b) => b - a);
}

function orientForPacking(item) {
    return sortDesc(item.length_mm, item.width_mm, item.height_mm);
}

function orientations(l, w, h){
  return [
    { d:l, w:w, h:h, short:'none',
      desc:'No rotation — load as entered.' },
    { d:w, w:l, h:h, short:'turn 90° (upright)',
      desc:'Keep upright and turn 90° clockwise (viewed from above).' },
    { d:l, w:h, h:w, short:'roll onto side',
      desc:'Roll 90° onto its right side; length still faces the door.' },
    { d:h, w:l, h:w, short:'roll + turn 90°',
      desc:'Roll 90° onto its right side, then turn 90° clockwise (viewed from above).' },
    { d:w, w:h, h:l, short:'on end + turn 90°',
      desc:'Stand it on its end (pitch 90° so length points up), then turn 90° clockwise (viewed from above).' },
    { d:h, w:w, h:l, short:'stand on end',
      desc:'Stand it on its end (pitch 90° about the width axis, length pointing up); original height faces the door.' },
  ];
}

function parseItems(text){
  const out = [];
  text.split(/\r?\n/).forEach(line => {
    line = line.trim(); if (!line) return;
    if (/\t|;/.test(line)) line = line.replace(/(\d),(\d)/g, '$1$2');
    let parts = line.split(/\t|,|;/).map(s => s.trim()).filter(s => s !== '');
    if (parts.length < 1) parts = line.split(/\s+/);
    const nums = []; let k = parts.length;
    while (k > 0 && nums.length < 3){
      const v = Number(parts[k-1]);
      if (isFinite(v) && v > 0){ nums.unshift(v); k--; } else break;
    }
    const name = parts.slice(0, k).join(' ') || line.replace(/[,;\t]+$/,'');
    if (nums.length === 0){ out.push({ name, error:true }); return; }
    out.push({ name: name || 'Item ' + (out.length + 1),
               l: nums[0] || 0, w: nums[1] || 0, h: nums[2] || 0 });
  });
  return out;
}

function dimStr(it) {
    return [it.l, it.w, it.h].map(v => v > 0 ? v : '?').join(' x ');
}

/* ---------- fit (car stowage + door passage) ---------- */
function checkItem(it, lift, door){
  it.known = [it.l, it.w, it.h].filter(v => v > 0).length;
  it.best = null; it.carBest = null; it.diagNote = ''; it.doorNote = '';
  if (it.known === 3){
    const effW = Math.min(door.w, lift.w), effH = Math.min(door.h, lift.h);
    const opts = orientations(it.l, it.w, it.h).map(o => {
      const carOK  = o.d <= lift.d && o.w <= lift.w && o.h <= lift.h;
      const doorOK = o.w <= effW && o.h <= effH;
      return { ...o, carOK, doorOK, ok: carOK && doorOK };
    });
    it.best   = opts.find(f => f.ok) || null;
    it.carBest = opts.find(f => f.carOK) || null;
    if (it.best){
      it.status = it.best.short === 'none' ? 'fit' : 'rot';
      it.margin = { d:lift.d - it.best.d, w:lift.w - it.best.w, h:lift.h - it.best.h };
    } else if (it.carBest){
      it.status = 'door';
      const req = opts.filter(o => o.carOK).slice().sort((a,b) => a.w*a.h - b.w*b.h)[0];
      it.doorNote = 'Fits inside the car (' + it.carBest.short + ') but its smallest presentable cross-section, ' +
        req.w + ' × ' + req.h + ' mm, is larger than the ' + door.w + ' × ' + door.h + ' mm door.';
    } else {
      it.status = 'no';
      const dims = [it.l, it.w, it.h].sort((a,b) => b - a);
      const tiltLen = Math.sqrt(lift.d*lift.d + lift.h*lift.h);
      const tiltX   = Math.hypot(lift.w, lift.h);
      it.diagNote = (dims[0] <= tiltLen && dims[1] <= tiltX && dims[2] <= Math.min(lift.w, lift.h))
        ? 'Longest side (' + dims[0] + ' mm) is shorter than the car\'s diagonal — an angled/tilted load might work, check manually.'
        : '';
    }
  } else if (it.known === 1){
    it.status = 'part';
    const L = it.l;
    const floorDiag = Math.hypot(lift.d, lift.w);
    const bodyDiag  = Math.sqrt(lift.d**2 + lift.w**2 + lift.h**2);
    if (L <= lift.d) it.lineFit = { type:'depth', short:'line along depth',
      desc:'length fits lying along the depth', place:'line lies along the car depth, on the floor' };
    else if (L <= floorDiag) it.lineFit = { type:'floorDiag', short:'line on floor diagonal',
      desc:'length fits only lying diagonally on the floor', place:'line lies diagonally across the floor' };
    else if (L <= bodyDiag) it.lineFit = { type:'bodyDiag', short:'line on body diagonal',
      desc:'length fits only tilted corner-to-corner in 3D', place:'line tilted on the body diagonal' };
    else it.lineFit = { type:'none', short:'too long',
      desc:'length too long for the car in any direction', place:'shown sticking out along the depth' };
  } else if (it.known === 2){
    it.status = 'part';
    if (it.l <= lift.d && it.w <= lift.w)
      it.rectFit = { fits:true, rot:false, short:'as entered', desc:'footprint fits as entered (height unknown)' };
    else if (it.w <= lift.d && it.l <= lift.w)
      it.rectFit = { fits:true, rot:true, short:'turn 90°', desc:'footprint fits turned 90° (height unknown)' };
    else
      it.rectFit = { fits:false, rot:false, short:'no flat fit', desc:'footprint does not fit flat — may fit diagonally, check manually' };
  } else {
    it.status = 'no';
  }
}

/* ---------- pack2d (free-rect packer) ---------- */
function shelf2D(items, cL, cW) {
        if (!items.length || cL <= 0 || cW <= 0) {
            return { placed: [], notPlaced: [...items] };
        }

        const sorted = [...items].sort((a, b) => {
            const am = Math.max(a.pL, a.pW);
            const bm = Math.max(b.pL, b.pW);
            return bm - am || (b.pL * b.pW) - (a.pL * a.pW);
        });

        const placed = [];
        const notPlaced = [];
        let freeRects = [{ x: 0, z: 0, w: cL, d: cW }];

        for (const item of sorted) {
            let bestFit = null;
            let bestFitIndex = -1;
            let bestRotation = false;

            for (const [tl, tw, rot] of [[item.pL, item.pW, false], [item.pW, item.pL, true]]) {
                for (let fi = 0; fi < freeRects.length; fi++) {
                    const fr = freeRects[fi];

                    if (tl <= fr.w && tw <= fr.d) {
                        const waste = (fr.w * fr.d) - (tl * tw);

                        if (bestFit === null || waste < bestFit.waste) {
                            bestFit = {
                                x: fr.x,
                                z: fr.z,
                                l: tl,
                                w: tw,
                                waste,
                                fi
                            };
                            bestFitIndex = fi;
                            bestRotation = rot;
                        }
                    }
                }
            }

            if (bestFit) {
                placed.push({
                    ...item,
                    px: bestFit.x,
                    pz: bestFit.z,
                    pl: bestFit.l,
                    pw: bestFit.w,
                    rot: bestRotation
                });

                const used = freeRects.splice(bestFitIndex, 1)[0];
                const newFree = [];

                if (used.w - bestFit.l > 10) {
                    newFree.push({
                        x: used.x + bestFit.l,
                        z: used.z,
                        w: used.w - bestFit.l,
                        d: used.d
                    });
                }

                if (used.d - bestFit.w > 10) {
                    newFree.push({
                        x: used.x,
                        z: used.z + bestFit.w,
                        w: bestFit.l,
                        d: used.d - bestFit.w
                    });
                }

                freeRects = [...freeRects, ...newFree];
                freeRects = mergeFreeRects(freeRects);
            } else {
                notPlaced.push(item);
            }
        }

        return { placed, notPlaced };
    }

function mergeFreeRects(rects) {
        const merged = [];

        for (let i = 0; i < rects.length; i++) {
            let contained = false;

            for (let j = 0; j < rects.length; j++) {
                if (i === j) continue;

                const a = rects[i];
                const b = rects[j];

                if (
                    a.x >= b.x &&
                    a.z >= b.z &&
                    a.x + a.w <= b.x + b.w &&
                    a.z + a.d <= b.z + b.d
                ) {
                    contained = true;
                    break;
                }
            }

            if (!contained) merged.push(rects[i]);
        }

        return merged;
    }

function trayUtil(items, tL, tW, tD) {
        if (!items || !items.length || tL <= 0 || tW <= 0 || tD <= 0) return 0;

        return items.reduce((s, i) => {
            return s + (i.pl || i.pL) * (i.pw || i.pW) * (i.pH || 0);
        }, 0) / (tL * tW * tD);
    }

/* ---------- cratepack: padding → grouping → trays → crates ---------- */
function parseTrayInventory(inputStr) {
    const inventory = {};
    const parts = inputStr.split(',').map(s => s.trim()).filter(s => s);
    let hasLimits = false;

    parts.forEach(part => {
        if (part.includes(':')) {
            const [d, c] = part.split(':').map(s => parseInt(s.trim()));
            if (!isNaN(d) && !isNaN(c)) {
                inventory[d] = c;
                hasLimits = true;
            }
        } else {
            const d = parseInt(part);
            if (!isNaN(d)) {
                inventory[d] = Infinity; // Infinite supply if no count is given
            }
        }
    });

    return { inventory, hasLimits };
}

function applyPadding(item, cfg) {
        const [baseLength, baseWidth, uprightHeight] = orientForPacking(item);
        let pl, pw, ph;

        if (cfg.padStrategy === 'proportional') {
            const pL = Math.min(cfg.maxPad, Math.max(cfg.minPad, baseLength * cfg.padFactor / 100));
            const pW = Math.min(cfg.maxPad, Math.max(cfg.minPad, baseWidth * cfg.padFactor / 100));

            pl = baseLength + 2 * pL;
            pw = baseWidth + 2 * pW;
            ph = uprightHeight + cfg.depthPad + cfg.lidClearance;
        } else {
            pl = baseLength + 2 * cfg.flatPad;
            pw = baseWidth + 2 * cfg.flatPad;
            ph = uprightHeight + cfg.depthPad + cfg.lidClearance;
        }

        return {
            ...item,
            pL: Math.ceil(pl),
            pW: Math.ceil(pw),
            pH: Math.ceil(ph),
            bL: baseLength,
            bW: baseWidth
        };
    }

function snapDepth(h, depths) {
        for (const d of depths) {
            if (h <= d) return { depth: d, custom: false };
        }
        return { depth: Math.ceil(h / 50) * 50, custom: true };
    }

function process(raw, cfg) {
        return raw.map(item => {
            const it = { ...item };

            if (!it.length_mm || it.length_mm <= 0) {
                it.length_mm = cfg.missingDim;
                it.dimAssumed = true;
            }

            if (!it.width_mm || it.width_mm <= 0) {
                it.width_mm = cfg.missingDim;
                it.dimAssumed = true;
            }

            if (!it.height_mm || it.height_mm <= 0) {
                it.height_mm = cfg.heightDefaults[it.type] || cfg.fallbackHeight || 50;
            }

            const p = applyPadding(it, cfg);
            const s = snapDepth(p.pH, cfg.trayDepths);

            return {
                ...p,
                snapDepth: s.depth,
                isCustom: s.custom
            };
        });
    }

function groupKey(item, strategy) {
        return strategy === 'type-depth'
            ? `${item.type}__${item.snapDepth}`
            : `d__${item.snapDepth}`;
    }

function groupItems(items, strategy) {
        const g = {};

        for (const it of items) {
            const k = groupKey(it, strategy);
            if (!g[k]) {
                g[k] = {
                    key: k,
                    type: it.type,
                    depth: it.snapDepth,
                    items: []
                };
            }
            g[k].items.push(it);
        }

        return Object.values(g);
    }

function packTrays(groups, cfg, trayInventory) {
    const trays = [];
    const unpacked = [];
    let tid = 0;

    for (const grp of groups) {
        grp.items.sort((a, b) => (b.pL * b.pW) - (a.pL * a.pW));
        let rem = [...grp.items];

        // Get all depths >= group's required depth, sorted ascending
        const validDepths = cfg.trayDepths.filter(d => d >= grp.depth);

        for (const fp of cfg.footprints) {
            while (rem.length > 0) {
                // 1. Try to pack into the current footprint
                const res = shelf2D(rem, fp.l, fp.w);

                if (res.placed.length === 0) {
                    // Items are too large for this footprint entirely.
                    break;
                }

                // 2. Find the smallest available depth that fits the group's requirement
                let assignedDepth = null;
                for (const d of validDepths) {
                    if (trayInventory[d] > 0) {
                        assignedDepth = d;
                        break;
                    }
                }

                if (!assignedDepth) {
                    // We ran out of all valid trays. 
                    rem.forEach(item => item.unpackedReason = 'no_trays');
                    unpacked.push(...rem);
                    rem = [];
                    break;
                }

                // We have a tray! Consume it from the physical inventory.
                trayInventory[assignedDepth]--;

                tid++;
                trays.push({
                    id: tid,
                    fp: { l: fp.l, w: fp.w },
                    depth: assignedDepth, // Note: This might be larger than grp.depth if we spilled over
                    type: grp.type,
                    items: res.placed,
                    util: trayUtil(res.placed, fp.l, fp.w, assignedDepth)
                });

                rem = res.notPlaced;
            }

            if (rem.length === 0) break;
        }

        // If there are still items left after checking all footprints, they are physically oversized
        if (rem.length > 0) {
            rem.forEach(item => item.unpackedReason = 'oversized');
            unpacked.push(...rem);
        }
    }

    return { trays, unpacked };
}

function consolidate(trays, cfg) {
        if (trays.length <= 1) return trays;

        const res = [...trays];
        let changed = true;
        let iter = 0;

        while (changed && iter < 100) {
            changed = false;
            iter++;

            for (let i = 0; i < res.length && !changed; i++) {
                if (res[i].util * 100 >= cfg.minUtil) continue;

                for (let j = i + 1; j < res.length && !changed; j++) {
                    if (res[i].fp.l !== res[j].fp.l || res[i].fp.w !== res[j].fp.w) continue;
                    if (Math.abs(res[i].depth - res[j].depth) > cfg.maxDepthVar) continue;
                    if (!cfg.crossType && res[i].type !== res[j].type) continue;

                    const all = [...res[i].items, ...res[j].items].map(it => ({
                        ...it,
                        px: undefined,
                        pz: undefined,
                        pl: undefined,
                        pw: undefined,
                        rot: undefined
                    }));

                    const r2 = shelf2D(all, res[i].fp.l, res[i].fp.w);

                    if (!r2.notPlaced.length) {
                        res[i].items = r2.placed;
                        res[i].depth = Math.max(res[i].depth, res[j].depth);
                        res[i].util = trayUtil(r2.placed, res[i].fp.l, res[i].fp.w, res[i].depth);

                        if (cfg.crossType) {
                            res[i].type = res[i].type + '/' + res[j].type;
                        }

                        res.splice(j, 1);
                        changed = true;
                    }
                }
            }
        }

        res.forEach((t, i) => t.id = i + 1);
        return res;
    }

function crateHeight(trays, allow) {
        let h = allow.base + allow.top;

        trays.forEach((t, i) => {
            if (i > 0) h += allow.interlayer;
            h += t.extD; // Use external depth (internal + base + lid)
        });

        return h;
    }

function buildCrates(trays, allow, maxCrate, trayStruct) {
        if (!trays.length) return [];

        const groups = {};

        for (const t of trays) {
            // Calculate EXTERNAL tray dimensions
            const extTrayL = t.fp.l + (2 * trayStruct.sideWall);
            const extTrayW = t.fp.w + (2 * trayStruct.sideWall);
            const extTrayD = t.depth + trayStruct.base + trayStruct.lid;

            const k = extTrayL + 'x' + extTrayW;

            if (!groups[k]) {
                groups[k] = {
                    extFp: { l: extTrayL, w: extTrayW },
                    extDepth: extTrayD,
                    trays: []
                };
            }

            groups[k].trays.push({
                ...t,
                extL: extTrayL,
                extW: extTrayW,
                extD: extTrayD
            });
        }

        // Heavier trays toward the bottom of each crate
        for (const g of Object.values(groups)) {
            g.trays.sort((a, b) => {
                const massA = a.items.reduce((s, i) => s + (i.pl || i.pL) * (i.pw || i.pW) * (i.pH || 0), 0);
                const massB = b.items.reduce((s, i) => s + (i.pl || i.pL) * (i.pw || i.pW) * (i.pH || 0), 0);

                if (massB !== massA) return massB - massA;
                return b.extD - a.extD;
            });
        }

        const crates = [];
        let cid = 0;

        for (const g of Object.values(groups)) {
            let chunk = [];

            for (const tray of g.trays) {
                const test = [...chunk, tray];
                const testH = crateHeight(test, allow);

                if (maxCrate.h > 0 && testH > maxCrate.h && chunk.length > 0) {
                    cid++;
                    const h = crateHeight(chunk, allow);
                    const l = g.extFp.l + (2 * allow.sides);
                    const w = g.extFp.w + (2 * allow.sides);

                    crates.push({
                        id: cid,
                        ext: { l, w, h },
                        trays: chunk,
                        yBase: allow.base,
                        overMax: (maxCrate.h > 0 && h > maxCrate.h) || (maxCrate.l > 0 && l > maxCrate.l) || (maxCrate.w > 0 && w > maxCrate.w)
                    });

                    chunk = [tray];
                } else {
                    chunk.push(tray);
                }
            }

            if (chunk.length > 0) {
                cid++;
                const h = crateHeight(chunk, allow);
                const l = g.extFp.l + (2 * allow.sides);
                const w = g.extFp.w + (2 * allow.sides);

                crates.push({
                    id: cid,
                    ext: { l, w, h },
                    trays: chunk,
                    yBase: allow.base,
                    overMax: (maxCrate.h > 0 && h > maxCrate.h) || (maxCrate.l > 0 && l > maxCrate.l) || (maxCrate.w > 0 && w > maxCrate.w)
                });
            }
        }

        return crates;
    }

function validatePlacements(trays) {
        let v = 0;

        for (const tray of trays) {
            for (const it of tray.items) {
                if (it.px + it.pl > tray.fp.l + 0.01 || it.pz + it.pw > tray.fp.w + 0.01) {
                    v++;
                }
            }
        }

        return v;
    }

function makeOversizedCrates(items, cfg) {
    if (!cfg.createOvrCrates || !items.length) return { crates: [], unpacked: [...items] };

    const crates = [];
    let ovrIdx = 1;

    for (const item of items) {
        const extTrayL = item.pL + (2 * cfg.trayStruct.sideWall);
        const extTrayW = item.pW + (2 * cfg.trayStruct.sideWall);
        const extTrayD = item.pH + cfg.trayStruct.base + cfg.trayStruct.lid;

        const l = extTrayL + (2 * cfg.allow.sides);
        const w = extTrayW + (2 * cfg.allow.sides);
        const h = extTrayD + cfg.allow.base + cfg.allow.top;

        const synTray = {
            id: 'OVR-T' + ovrIdx,
            fp: { l: item.pL, w: item.pW },
            depth: item.pH,
            extL: extTrayL,
            extW: extTrayW,
            extD: extTrayD,
            type: item.type,
            items: [{
                ...item,
                px: 0,
                pz: 0,
                pl: item.pL,
                pw: item.pW,
                rot: false
            }],
            util: 1.0
        };

        crates.push({
            id: 'OVR-' + ovrIdx,
            ext: { l, w, h },
            trays: [synTray],
            yBase: cfg.allow.base,
            overMax:
                (cfg.maxCrate.h > 0 && h > cfg.maxCrate.h) ||
                (cfg.maxCrate.l > 0 && l > cfg.maxCrate.l) ||
                (cfg.maxCrate.w > 0 && w > cfg.maxCrate.w),
            isOversized: true
        });

        ovrIdx++;
    }

    return { crates, unpacked: [] };
}

/* ---------- export ---------- */
function csvEsc(v) {
    v = String(v);
    return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

function toCSV(rows) {
    return '\uFEFF' + rows.map(r => r.map(csvEsc).join(',')).join('\r\n');
}

function toTSV(rows) {
    return rows.map(r => r.join('\t')).join('\r\n');
}

function downloadText(filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}

function downloadJSON(filename, obj) {
    downloadText(filename, JSON.stringify(obj, null, 2), 'application/json');
}

/* ---------- store (safe localStorage JSON) ---------- */
function getLS(key, dflt) {
    try { return JSON.parse(localStorage.getItem(key)) ?? dflt; } catch (e) { return dflt; }
}

function setLS(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}

function removeLS(key) {
    try { localStorage.removeItem(key); } catch (e) {}
}

root.CLM_CORE = {
    dims: {
        numOrNull, num, parseDimsCell, sortDesc,
        orientations, parseItems, dimStr
    },
    fit: { checkItem },
    pack2d: { shelf2D, mergeFreeRects, trayUtil },
    cratepack: {
        parseTrayInventory, applyPadding, snapDepth, process,
        groupKey, groupItems, packTrays, consolidate,
        crateHeight, buildCrates, validatePlacements, makeOversizedCrates
    },
    export: { csvEsc, toCSV, toTSV, downloadText, downloadJSON },
    store: { getLS, setLS, removeLS }
};

})(typeof globalThis !== 'undefined' ? globalThis : this);
