/* CaPackyBara application controller. */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const esc = value => (window.CLM && CLM.esc) ? CLM.esc(value) : String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state = { raw: [], processed: [], trays: [], crates: [], images: new Map(), mediaBase: '', running: false };

  function number(id, fallback = 0) {
    const value = parseFloat($(id)?.value);
    return Number.isFinite(value) ? value : fallback;
  }

  function status(message, error = false) {
    const node = $('status-bar');
    if (node) { node.textContent = message; node.className = `text-xs font-sans tracking-wide ${error ? 'text-clay' : 'text-muted'}`; }
  }

  function imageFor(item) {
    return state.images.get(String(item.id || item.name || '').toLowerCase()) || item.image || '';
  }

  function parseRows(text) {
    const parsed = window.PapaParse ? Papa.parse(text, { header: true, skipEmptyLines: true }).data : [];
    if (!parsed.length) return CLM_CORE.dims.parseItems(text).map((item, index) => ({ ...item, id: index + 1, type: item.type || 'Uncategorised' }));
    return parsed.map((row, index) => {
      const pick = (...keys) => { for (const key of keys) if (row[key] != null && String(row[key]).trim()) return String(row[key]).trim(); return ''; };
      const dims = pick('Dimensions', 'dimensions', 'Size', 'size').split(/[x×,;]/).map(Number);
      const n = key => Number(pick(key, key.toLowerCase(), key.replace('_mm', '')));
      return {
        ...row,
        id: pick('id', 'ID', 'Object ID', 'Object number') || index + 1,
        name: pick('name', 'Name', 'Object short summary', 'Object') || `Item ${index + 1}`,
        type: pick('type', 'Type', 'Nomenclature Classification Category') || 'Uncategorised',
        length_mm: n('length_mm') || dims[0] || 0,
        width_mm: n('width_mm') || dims[1] || 0,
        height_mm: n('height_mm') || dims[2] || 0,
        image: pick('image', 'Image', 'image_url', 'Image URL')
      };
    });
  }

  function cfg() {
    const depths = CLM_CORE.cratepack.parseTrayInventory($('tray-depths')?.value || '').inventory;
    const trayDepths = Object.keys(depths).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    const footprints = [...document.querySelectorAll('#fp-list .fp-row')].map(row => ({
      l: parseFloat(row.querySelector('[data-dim="l"]')?.value),
      w: parseFloat(row.querySelector('[data-dim="w"]')?.value)
    })).filter(fp => fp.l > 0 && fp.w > 0);
    return {
      missingDim: number('missing-dim', 50),
      padStrategy: document.querySelector('input[name="pad-strategy"]:checked')?.value || 'proportional',
      minPad: number('min-pad', 15), padFactor: number('pad-factor', 20), maxPad: number('max-pad', 50),
      flatPad: number('flat-pad', 25), depthPad: number('depth-pad', 20), lidClearance: number('lid-clearance', 10),
      trayDepths: trayDepths.length ? trayDepths : [50, 100, 150, 200, 250], footprints: footprints.length ? footprints : [{ l: 895, w: 790 }],
      heightDefaults: window.CLM_LIBRARY?.typeHeights || {}, fallbackHeight: number('fallback-height', 50),
      createOvrCrates: $('create-ovr-crates')?.checked !== false,
      allow: { sides: number('allow-sides', 30), inter: number('allow-inter', 12), base: number('allow-base', 150), top: number('allow-top', 18) },
      trayStruct: { sideWall: number('tray-side-wall', 18), base: number('tray-base', 18), lid: number('tray-lid', 0) },
      maxCrate: { l: number('max-crate-l'), w: number('max-crate-w'), h: number('max-crate-h') },
      minUtil: number('min-util', 60), maxDepthVar: number('max-depth-var', 50), crossType: $('cross-type')?.value === 'yes',
      groupingStrategy: $('grouping-strategy')?.value || 'type-depth'
    };
  }

  function initFootprints() {
    const list = $('fp-list'); if (!list) return;
    const values = window.CLM_LIBRARY?.trayFootprints || [{ l: 895, w: 790 }];
    list.innerHTML = values.map(fp => `<div class="fp-row"><input data-dim="l" type="number" value="${fp.l}" aria-label="Tray length"><span>×</span><input data-dim="w" type="number" value="${fp.w}" aria-label="Tray width"><button type="button" class="btn-sec fp-remove">×</button></div>`).join('');
    list.querySelectorAll('.fp-remove').forEach(button => button.addEventListener('click', () => button.parentElement.remove()));
    $('btn-add-fp')?.addEventListener('click', () => { const row = document.createElement('div'); row.className = 'fp-row'; row.innerHTML = '<input data-dim="l" type="number" value="895"><span>×</span><input data-dim="w" type="number" value="790"><button type="button" class="btn-sec fp-remove">×</button>'; row.querySelector('.fp-remove').onclick = () => row.remove(); list.appendChild(row); });
  }

  function renderTrays() {
    const list = $('trays-list'); if (!list) return;
    const scale = 0.45;
    list.innerHTML = state.trays.map(tray => {
      const width = Math.max(180, Math.round(tray.fp.l * scale));
      const height = Math.max(160, Math.round(tray.fp.w * scale));
      const items = tray.items.map((item, index) => {
        const x = (item.px || 0) * scale, y = (item.pz || 0) * scale;
        const w = Math.max(12, (item.pl || item.pL || 20) * scale), h = Math.max(12, (item.pw || item.pW || 20) * scale);
        const image = imageFor(item);
        return `<div class="tray-item" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px" title="${esc(item.name)}"><span class="tray-num">${index + 1}</span>${image ? `<div class="img-wrap"><img src="${esc(image)}" alt="${esc(item.name)}"></div>` : ''}</div>`;
      }).join('');
      const legend = tray.items.map((item, index) => `<div class="legend-entry"><span class="legend-num">${index + 1}</span><div><div class="legend-name">${esc(item.name || item.id)}</div><div class="legend-dims">${esc(item.type || '')} · ${item.length_mm || '?'} × ${item.width_mm || '?'} × ${item.height_mm || '?'} mm</div></div></div>`).join('');
      return `<article class="tray-block"><div class="tray-head"><div class="tray-title">Tray ${esc(tray.id)}</div><div class="tray-sub">${esc(tray.type || '')} · ${tray.fp.l} × ${tray.fp.w} mm · ${Math.round((tray.util || 0) * 100)}% used</div></div><div class="tray-body"><div class="tray-diagram-wrap"><div class="tray-diagram" style="width:${width}px;height:${height}px">${items}</div></div><div class="tray-legend">${legend}</div></div></article>`;
    }).join('');
    $('trays-content')?.classList.toggle('hidden', !state.trays.length);
    $('trays-placeholder')?.classList.toggle('hidden', !!state.trays.length);
    if ($('trays-meta')) $('trays-meta').textContent = `${state.trays.length} tray${state.trays.length === 1 ? '' : 's'} · ${state.trays.reduce((n, t) => n + t.items.length, 0)} items`;
  }

  function printMarkup() {
    const root = $('print-content'); if (!root) return;
    root.innerHTML = state.trays.map(tray => {
      const width = Math.min(260, Math.max(150, tray.fp.l / 4));
      const height = Math.min(190, Math.max(120, tray.fp.w / 4));
      const imageItems = tray.items.map((item, index) => `<div class="tray-item" style="left:${(item.px || 0) / tray.fp.l * width}px;top:${(item.pz || 0) / tray.fp.w * height}px;width:${(item.pl || item.pL) / tray.fp.l * width}px;height:${(item.pw || item.pW) / tray.fp.w * height}px"><span class="tray-num">${index + 1}</span>${imageFor(item) ? `<div class="img-wrap"><img src="${esc(imageFor(item))}" alt=""></div>` : ''}</div>`).join('');
      const rows = tray.items.map((item, index) => `<tr><td>${index + 1}</td><td>${esc(item.id || '')}</td><td>${esc(item.name || '')}</td><td>${esc(item.type || '')}</td><td>${item.length_mm || '?'} × ${item.width_mm || '?'} × ${item.height_mm || '?'}</td></tr>`).join('');
      return `<section class="print-tray-diagram-page"><h1>Tray ${esc(tray.id)}</h1><p>${esc(tray.type || '')} · ${tray.fp.l} × ${tray.fp.w} mm · depth ${tray.depth} mm</p><div class="tray-diagram" style="width:${width}mm;height:${height}mm">${imageItems}</div></section><section class="print-tray-items-page"><h1>Tray ${esc(tray.id)} — Items</h1><table style="width:100%;border-collapse:collapse"><thead><tr><th>#</th><th>ID</th><th>Name</th><th>Type</th><th>Dimensions (mm)</th></tr></thead><tbody>${rows}</tbody></table></section>`;
    }).join('');
  }

  function run() {
    if (!state.raw.length) { status('Load a CSV or TSV first', true); return; }
    const config = cfg();
    const processed = CLM_CORE.cratepack.process(state.raw, config);
    const groups = CLM_CORE.cratepack.groupItems(processed, config.groupingStrategy);
    const inventory = CLM_CORE.cratepack.parseTrayInventory($('tray-depths')?.value || '').inventory;
    let result = CLM_CORE.cratepack.packTrays(groups, config, inventory);
    result.trays = CLM_CORE.cratepack.consolidate(result.trays, config);
    const oversized = CLM_CORE.cratepack.makeOversizedCrates(result.unpacked, config);
    state.processed = processed; state.trays = result.trays; state.crates = CLM_CORE.cratepack.buildCrates(state.trays, config.allow, config.maxCrate, config.trayStruct).concat(oversized.crates);
    renderTrays(); printMarkup();
    $('btn-export')?.removeAttribute('disabled'); $('btn-clm-out')?.removeAttribute('disabled');
    $('empty-state')?.classList.add('hidden'); status(`Packed ${processed.length} items into ${state.trays.length} trays`);
  }

  function loadText(text) { state.raw = parseRows(text); status(`Loaded ${state.raw.length} items`); }

  $('csv-upload')?.addEventListener('change', event => { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => loadText(reader.result); reader.readAsText(file); });
  $('btn-run')?.addEventListener('click', run);
  $('btn-sample')?.addEventListener('click', () => loadText('id,name,type,length_mm,width_mm,height_mm\nA1,Sample object,artefact,120,80,20\nA2,Second object,artefact,160,90,30'));
  $('media-folder')?.addEventListener('change', event => Array.from(event.target.files).forEach(file => { const key = file.name.replace(/\.[^.]+$/, '').toLowerCase(); state.images.set(key, URL.createObjectURL(file)); }));
  $('btn-print-pdf')?.addEventListener('click', () => { if (!state.trays.length) return; printMarkup(); window.print(); });
  $('btn-export')?.addEventListener('click', () => { const rows = [['Tray', 'Item ID', 'Item', 'Type', 'Original dimensions', 'Padded dimensions']]; state.trays.forEach(t => t.items.forEach(i => rows.push([t.id, i.id, i.name, i.type, [i.length_mm, i.width_mm, i.height_mm].join(' x '), [i.pL, i.pW, i.pH].join(' x ')]))); CLM_CORE.export.downloadText('capackybara-results.csv', CLM_CORE.export.toCSV(rows), 'text/csv;charset=utf-8'); });
  $('btn-clm-out')?.addEventListener('click', () => { const items = state.processed.map(item => ({ id: item.id, name: item.name, type: item.type, unit: 'item', dims: { l: item.length_mm, w: item.width_mm, h: item.height_mm }, image: imageFor(item) || undefined })); const containers = state.trays.map(t => ({ id: `Tray ${t.id}`, kind: 'tray', l: t.fp.l, w: t.fp.w, h: t.depth, external: false, children: t.items.map(i => i.id) })); CLM.download(CLM.make('CaPackyBara packing plan', 'capackybara', items, containers, []), 'capackybara-manifest.json'); });
  document.querySelectorAll('.tab-btn').forEach(button => button.addEventListener('click', () => { document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === button)); document.querySelectorAll('[id^="tab-"]').forEach(tab => tab.classList.toggle('hidden', tab.id !== `tab-${button.dataset.tab}`)); }));
  initFootprints();
})();
