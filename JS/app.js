/* ============================================================
   MD RASEL PDF STUDIO — Main Application
   Features: PDF edit, draw, text, shapes, export, PNG convert,
             undo/redo, page management, local storage, shortcuts
   ============================================================ */

'use strict';

/* ── PDF.js Worker ───────────────────────────────────────────── */
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

/* ── State ───────────────────────────────────────────────────── */
const state = {
  pdfDoc: null,
  pdfBytes: null,
  currentPage: 1,
  totalPages: 0,
  zoom: 1.0,
  currentTool: 'select',
  fabricCanvas: null,
  history: [],            // per-page Fabric JSON history
  historyIndex: -1,
  pageStates: {},         // pageNum → fabric JSON
  pageRotations: {},      // pageNum → degrees (0/90/180/270)
  deletedPages: new Set(),
  convertPdfDoc: null,
  convertPages: [],
  isDrawing: false,
  sigCanvas: null,
  sigCtx: null,
  sigDrawing: false,
};

/* ── DOM refs ────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const pdfCanvas    = $('pdfCanvas');
const fabricEl     = $('fabricCanvas');
const uploadZone   = $('uploadZone');
const fileInput    = $('fileInput');
const editorWrap   = $('editorWorkspace');
const progressFill = $('progressFill');
const progressLbl  = $('progressLabel');
const uploadProg   = $('uploadProgress');
const uploadBtn    = $('uploadBtn');
const pageNum      = $('pageNum');
const pageTotal    = $('pageTotal');
const zoomLabel    = $('zoomLabel');
const thumbList    = $('thumbList');
const fileInfo     = $('fileInfo');
const topbarTitle  = $('topbarTitle');

/* ═══════════════════════════════════════════════════════════════
   SPLASH
═══════════════════════════════════════════════════════════════ */
(function runSplash() {
  const fill = document.querySelector('.splash-fill');
  const lbl  = document.querySelector('.splash-tagline');
  const msgs = ['Initializing workspace…', 'Loading PDF engine…', 'Preparing tools…', 'Almost ready…'];
  let pct = 0;
  const iv = setInterval(() => {
    pct += Math.random() * 22 + 5;
    if (pct > 100) pct = 100;
    fill.style.width = pct + '%';
    lbl.textContent = msgs[Math.min(Math.floor(pct / 26), msgs.length - 1)];
    if (pct >= 100) {
      clearInterval(iv);
      setTimeout(() => {
        document.getElementById('splash').classList.add('hidden');
        document.getElementById('app').style.opacity = '1';
        anime({ targets: '#app', opacity: [0, 1], duration: 600, easing: 'easeOutExpo' });
      }, 400);
    }
  }, 120);
})();

/* ═══════════════════════════════════════════════════════════════
   FABRIC CANVAS INIT
═══════════════════════════════════════════════════════════════ */
function initFabric(w, h) {
  if (state.fabricCanvas) {
    state.fabricCanvas.dispose();
  }
  fabricEl.width  = w;
  fabricEl.height = h;
  state.fabricCanvas = new fabric.Canvas('fabricCanvas', {
    width: w, height: h,
    selection: true,
    preserveObjectStacking: true,
  });
  state.fabricCanvas.on('object:added', savePageState);
  state.fabricCanvas.on('object:modified', savePageState);
  state.fabricCanvas.on('object:removed', savePageState);
  applyTool(state.currentTool);
}

/* ═══════════════════════════════════════════════════════════════
   PDF LOADING
═══════════════════════════════════════════════════════════════ */
async function loadPDF(file) {
  if (!file || file.type !== 'application/pdf') {
    toast('Please choose a valid PDF file.', 'error'); return;
  }
  uploadProg.style.display = 'block';
  animateProgress(progressFill, progressLbl, 0, 40, 'Reading file…');
  const arrayBuffer = await file.arrayBuffer();
  state.pdfBytes = new Uint8Array(arrayBuffer);

  animateProgress(progressFill, progressLbl, 40, 80, 'Parsing PDF…');
  state.pdfDoc = await pdfjsLib.getDocument({ data: state.pdfBytes }).promise;
  state.totalPages = state.pdfDoc.numPages;
  state.currentPage = 1;
  state.pageStates = {};
  state.pageRotations = {};
  state.deletedPages = new Set();

  animateProgress(progressFill, progressLbl, 80, 100, 'Rendering…');
  await renderPage(1);
  await buildThumbnails();

  uploadZone.style.display = 'none';
  editorWrap.style.display = 'flex';
  uploadProg.style.display = 'none';

  fileInfo.textContent = `${file.name} · ${(file.size / 1024).toFixed(0)} KB · ${state.totalPages} pages`;
  pageTotal.textContent = state.totalPages;

  saveToRecent(file.name, state.totalPages, file.size);
  toast(`Loaded "${file.name}" (${state.totalPages} pages)`, 'success');

  anime({ targets: '#editorWorkspace', opacity: [0, 1], translateY: [16, 0], duration: 500, easing: 'easeOutExpo' });
}

async function renderPage(num) {
  const page = await state.pdfDoc.getPage(num);
  const rot  = state.pageRotations[num] || 0;
  const vp   = page.getViewport({ scale: state.zoom, rotation: rot });
  const ctx  = pdfCanvas.getContext('2d');

  pdfCanvas.width  = vp.width;
  pdfCanvas.height = vp.height;
  await page.render({ canvasContext: ctx, viewport: vp }).promise;

  initFabric(vp.width, vp.height);

  // Restore saved state for this page
  if (state.pageStates[num]) {
    await new Promise(res => state.fabricCanvas.loadFromJSON(state.pageStates[num], () => {
      state.fabricCanvas.renderAll(); res();
    }));
  }

  pageNum.textContent = num;
  updateThumbActive(num);
}

/* ═══════════════════════════════════════════════════════════════
   THUMBNAILS
═══════════════════════════════════════════════════════════════ */
async function buildThumbnails() {
  thumbList.innerHTML = '';
  for (let i = 1; i <= state.totalPages; i++) {
    if (state.deletedPages.has(i)) continue;
    const wrap = document.createElement('div');
    wrap.className = 'thumb-item' + (i === state.currentPage ? ' active' : '');
    wrap.dataset.page = i;

    const c = document.createElement('canvas');
    const page = await state.pdfDoc.getPage(i);
    const rot  = state.pageRotations[i] || 0;
    const vp   = page.getViewport({ scale: 0.25, rotation: rot });
    c.width = vp.width; c.height = vp.height;
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;

    const num = document.createElement('span');
    num.className = 'thumb-num'; num.textContent = i;

    wrap.appendChild(c); wrap.appendChild(num);
    wrap.addEventListener('click', () => switchPage(i));
    thumbList.appendChild(wrap);
  }
}

function updateThumbActive(num) {
  document.querySelectorAll('.thumb-item').forEach(el => {
    el.classList.toggle('active', +el.dataset.page === num);
  });
}

async function switchPage(num) {
  savePageState();
  state.currentPage = num;
  await renderPage(num);
}

/* ═══════════════════════════════════════════════════════════════
   PAGE STATE (UNDO/REDO)
═══════════════════════════════════════════════════════════════ */
function savePageState() {
  if (!state.fabricCanvas) return;
  const json = JSON.stringify(state.fabricCanvas.toJSON());
  state.pageStates[state.currentPage] = json;

  // undo history
  const h = state.history;
  if (state.historyIndex < h.length - 1) h.splice(state.historyIndex + 1);
  h.push({ page: state.currentPage, json });
  if (h.length > 60) h.shift();
  state.historyIndex = h.length - 1;
}

function undo() {
  if (state.historyIndex < 1) return;
  state.historyIndex--;
  const entry = state.history[state.historyIndex];
  state.pageStates[entry.page] = entry.json;
  if (entry.page === state.currentPage) {
    state.fabricCanvas.loadFromJSON(entry.json, () => state.fabricCanvas.renderAll());
  }
}

function redo() {
  if (state.historyIndex >= state.history.length - 1) return;
  state.historyIndex++;
  const entry = state.history[state.historyIndex];
  state.pageStates[entry.page] = entry.json;
  if (entry.page === state.currentPage) {
    state.fabricCanvas.loadFromJSON(entry.json, () => state.fabricCanvas.renderAll());
  }
}

/* ═══════════════════════════════════════════════════════════════
   TOOLS
═══════════════════════════════════════════════════════════════ */
function applyTool(tool) {
  const fc = state.fabricCanvas;
  if (!fc) return;
  fc.isDrawingMode = false;
  fc.selection = true;

  switch (tool) {
    case 'select':
      break;
    case 'brush':
    case 'highlight':
      fc.isDrawingMode = true;
      fc.freeDrawingBrush.color = tool === 'highlight'
        ? hexToRgba($('colorPicker').value, 0.35)
        : $('colorPicker').value;
      fc.freeDrawingBrush.width = +$('brushSize').value;
      break;
    case 'text':
      fc.isDrawingMode = false;
      fc.once('mouse:down', e => {
        const p = e.pointer;
        const t = new fabric.IText('Click to edit', {
          left: p.x, top: p.y,
          fontFamily: 'Syne, sans-serif',
          fontSize: 20,
          fill: $('colorPicker').value,
          editable: true,
        });
        fc.add(t); fc.setActiveObject(t); t.enterEditing();
        state.currentTool = 'select';
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('[data-tool="select"]').classList.add('active');
        applyTool('select');
      });
      break;
    case 'rect':
      addShape('rect'); break;
    case 'circle':
      addShape('circle'); break;
    case 'arrow':
      addArrow(); break;
  }
}

function addShape(type) {
  const fc = state.fabricCanvas;
  fc.isDrawingMode = false;
  let isDown = false, origX, origY, shape;
  fc.once('mouse:down', opt => {
    const p = opt.absolutePointer || opt.pointer;
    origX = p.x; origY = p.y; isDown = true;
    if (type === 'rect') {
      shape = new fabric.Rect({
        left: origX, top: origY, width: 0, height: 0,
        fill: 'transparent',
        stroke: $('colorPicker').value,
        strokeWidth: +$('brushSize').value,
      });
    } else {
      shape = new fabric.Ellipse({
        left: origX, top: origY, rx: 0, ry: 0,
        fill: 'transparent',
        stroke: $('colorPicker').value,
        strokeWidth: +$('brushSize').value,
      });
    }
    fc.add(shape);
  });
  const onMove = opt => {
    if (!isDown) return;
    const p = opt.absolutePointer || opt.pointer;
    const w = Math.abs(p.x - origX), h = Math.abs(p.y - origY);
    if (type === 'rect') {
      shape.set({ left: Math.min(p.x, origX), top: Math.min(p.y, origY), width: w, height: h });
    } else {
      shape.set({ rx: w / 2, ry: h / 2, left: Math.min(p.x, origX), top: Math.min(p.y, origY) });
    }
    fc.renderAll();
  };
  const onUp = () => {
    isDown = false;
    fc.off('mouse:move', onMove); fc.off('mouse:up', onUp);
    applyTool('select'); savePageState();
  };
  fc.on('mouse:move', onMove);
  fc.on('mouse:up', onUp);
}

function addArrow() {
  const fc = state.fabricCanvas;
  let isDown = false, origX, origY, line, arrowHead;
  fc.once('mouse:down', opt => {
    const p = opt.absolutePointer || opt.pointer;
    origX = p.x; origY = p.y; isDown = true;
    line = new fabric.Line([origX, origY, origX, origY], {
      stroke: $('colorPicker').value,
      strokeWidth: +$('brushSize').value,
      selectable: false,
    });
    fc.add(line);
  });
  const onMove = opt => {
    if (!isDown) return;
    const p = opt.absolutePointer || opt.pointer;
    line.set({ x2: p.x, y2: p.y }); fc.renderAll();
  };
  const onUp = opt => {
    isDown = false;
    fc.off('mouse:move', onMove); fc.off('mouse:up', onUp);
    const p = opt.absolutePointer || opt.pointer;
    const angle = Math.atan2(p.y - origY, p.x - origX) * 180 / Math.PI;
    const tri = new fabric.Triangle({
      left: p.x, top: p.y,
      width: 14, height: 14,
      fill: $('colorPicker').value,
      angle: angle + 90,
      originX: 'center', originY: 'center',
    });
    fc.add(tri);
    const group = new fabric.Group([line, tri]); fc.remove(line, tri); fc.add(group);
    applyTool('select'); savePageState();
  };
  fc.on('mouse:move', onMove); fc.on('mouse:up', onUp);
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ═══════════════════════════════════════════════════════════════
   SIGNATURE
═══════════════════════════════════════════════════════════════ */
function openSignatureModal() {
  $('sigModal').style.display = 'flex';
  const sc = $('sigCanvas');
  state.sigCtx = sc.getContext('2d');
  state.sigCtx.clearRect(0, 0, sc.width, sc.height);
  state.sigCtx.strokeStyle = '#1a1a2e';
  state.sigCtx.lineWidth = 2.5;
  state.sigCtx.lineCap = 'round';
  state.sigDrawing = false;

  sc.onmousedown = e => { state.sigDrawing = true; state.sigCtx.beginPath(); state.sigCtx.moveTo(...sigPos(e, sc)); };
  sc.onmousemove = e => { if (!state.sigDrawing) return; state.sigCtx.lineTo(...sigPos(e, sc)); state.sigCtx.stroke(); };
  sc.onmouseup = sc.onmouseleave = () => { state.sigDrawing = false; };
  sc.ontouchstart = e => { e.preventDefault(); state.sigDrawing = true; state.sigCtx.beginPath(); state.sigCtx.moveTo(...sigPos(e.touches[0], sc)); };
  sc.ontouchmove  = e => { e.preventDefault(); if (!state.sigDrawing) return; state.sigCtx.lineTo(...sigPos(e.touches[0], sc)); state.sigCtx.stroke(); };
  sc.ontouchend   = () => { state.sigDrawing = false; };
}

function sigPos(e, canvas) {
  const r = canvas.getBoundingClientRect();
  return [(e.clientX - r.left) * (canvas.width / r.width), (e.clientY - r.top) * (canvas.height / r.height)];
}

function applySig() {
  const sc = $('sigCanvas');
  const dataURL = sc.toDataURL();
  fabric.Image.fromURL(dataURL, img => {
    img.scaleToWidth(200);
    img.set({ left: 50, top: 50 });
    state.fabricCanvas.add(img);
    closeModal('sigModal');
    savePageState();
  });
}

/* ═══════════════════════════════════════════════════════════════
   IMAGE INSERTION
═══════════════════════════════════════════════════════════════ */
function insertImage(file) {
  const reader = new FileReader();
  reader.onload = e => {
    fabric.Image.fromURL(e.target.result, img => {
      img.scaleToWidth(Math.min(200, pdfCanvas.width * 0.4));
      img.set({ left: 60, top: 60 });
      state.fabricCanvas.add(img);
      savePageState();
    });
  };
  reader.readAsDataURL(file);
}

/* ═══════════════════════════════════════════════════════════════
   ZOOM & PAGE NAV
═══════════════════════════════════════════════════════════════ */
function setZoom(z) {
  state.zoom = Math.max(0.3, Math.min(3, z));
  zoomLabel.textContent = Math.round(state.zoom * 100) + '%';
  renderPage(state.currentPage);
}

function getNextPage() {
  let n = state.currentPage + 1;
  while (n <= state.totalPages && state.deletedPages.has(n)) n++;
  return n <= state.totalPages ? n : null;
}
function getPrevPage() {
  let n = state.currentPage - 1;
  while (n >= 1 && state.deletedPages.has(n)) n--;
  return n >= 1 ? n : null;
}

/* ═══════════════════════════════════════════════════════════════
   EXPORT PDF
═══════════════════════════════════════════════════════════════ */
async function exportPDF() {
  savePageState();
  toast('Preparing export…', 'info');
  const { PDFDocument, rgb } = PDFLib;
  const srcDoc = await PDFDocument.load(state.pdfBytes);
  const outDoc = await PDFDocument.create();

  const pages = srcDoc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const pNum = i + 1;
    if (state.deletedPages.has(pNum)) continue;

    const [copiedPage] = await outDoc.copyPages(srcDoc, [i]);
    outDoc.addPage(copiedPage);

    if (state.pageStates[pNum]) {
      // Render Fabric annotations to a PNG and embed
      const fabricJSON = state.pageStates[pNum];
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width  = pdfCanvas.width;
      tmpCanvas.height = pdfCanvas.height;
      const tmpFab = new fabric.StaticCanvas(tmpCanvas);
      await new Promise(res => tmpFab.loadFromJSON(fabricJSON, () => { tmpFab.renderAll(); res(); }));
      const pngDataUrl = tmpCanvas.toDataURL('image/png');
      const pngBytes   = base64ToUint8(pngDataUrl.split(',')[1]);
      const pngImage   = await outDoc.embedPng(pngBytes);
      const pg = outDoc.getPages()[outDoc.getPageCount() - 1];
      pg.drawImage(pngImage, { x: 0, y: 0, width: pg.getWidth(), height: pg.getHeight() });
    }
  }

  const bytes = await outDoc.save();
  saveAs(new Blob([bytes], { type: 'application/pdf' }), 'rasel-studio-export.pdf');
  $('exportModal').style.display = 'flex';
}

function base64ToUint8(b64) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

/* ═══════════════════════════════════════════════════════════════
   PDF → PNG CONVERTER
═══════════════════════════════════════════════════════════════ */
async function loadConvertPDF(file) {
  if (!file || file.type !== 'application/pdf') { toast('Please choose a valid PDF.', 'error'); return; }
  const ab = await file.arrayBuffer();
  state.convertPdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
  $('convertZone').style.display = 'none';
  $('convertWorkspace').style.display = 'block';
  toast(`PDF loaded: ${state.convertPdfDoc.numPages} pages`, 'success');
}

async function startConversion() {
  const doc = state.convertPdfDoc;
  if (!doc) return;
  const mode  = document.querySelector('input[name="pages"]:checked').value;
  const scale = +$('qualitySlider').value;
  let pageNums = [];

  if (mode === 'all') {
    for (let i = 1; i <= doc.numPages; i++) pageNums.push(i);
  } else {
    pageNums = parsePageRange($('pageRange').value, doc.numPages);
    if (!pageNums.length) { toast('Invalid page range.', 'error'); return; }
  }

  $('convertProgress').style.display = 'block';
  $('convertResults').innerHTML = '';
  state.convertPages = [];

  for (let idx = 0; idx < pageNums.length; idx++) {
    const pn = pageNums[idx];
    const pct = Math.round(((idx + 1) / pageNums.length) * 100);
    $('convertProgressFill').style.width = pct + '%';
    $('convertProgressLabel').textContent = `Converting page ${pn} of ${doc.numPages}… (${pct}%)`;

    const page = await doc.getPage(pn);
    const vp   = page.getViewport({ scale });
    const cv   = document.createElement('canvas');
    cv.width = vp.width; cv.height = vp.height;
    await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
    const dataUrl = cv.toDataURL('image/png');
    state.convertPages.push({ page: pn, dataUrl });

    // Show preview tile
    const item  = document.createElement('div'); item.className = 'convert-item';
    const img   = document.createElement('img'); img.src = dataUrl;
    const lbl   = document.createElement('div'); lbl.className = 'convert-item-label';
    const span  = document.createElement('span'); span.textContent = `Page ${pn}`;
    const dlBtn = document.createElement('button');
    dlBtn.className = 'download-png'; dlBtn.title = 'Download PNG'; dlBtn.textContent = '⬇';
    dlBtn.addEventListener('click', () => {
      saveAs(dataURLtoBlob(dataUrl), `page-${pn}.png`);
    });
    lbl.appendChild(span); lbl.appendChild(dlBtn);
    item.appendChild(img); item.appendChild(lbl);
    $('convertResults').appendChild(item);
  }

  $('convertProgress').style.display = 'none';
  $('convertActions').style.display = 'flex';
  toast(`Converted ${pageNums.length} page(s) to PNG!`, 'success');
}

async function downloadAllAsZip() {
  if (!state.convertPages.length) return;
  toast('Creating ZIP…', 'info');
  const zip = new JSZip();
  state.convertPages.forEach(({ page, dataUrl }) => {
    const b64 = dataUrl.split(',')[1];
    zip.file(`page-${page}.png`, b64, { base64: true });
  });
  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, 'rasel-studio-pages.zip');
  toast('ZIP downloaded!', 'success');
}

function parsePageRange(str, max) {
  const nums = new Set();
  str.split(',').forEach(part => {
    part = part.trim();
    if (part.includes('-')) {
      const [a, b] = part.split('-').map(Number);
      for (let i = Math.max(1,a); i <= Math.min(max,b); i++) nums.add(i);
    } else {
      const n = parseInt(part);
      if (n >= 1 && n <= max) nums.add(n);
    }
  });
  return [...nums].sort((a, b) => a - b);
}

function dataURLtoBlob(dataUrl) {
  const arr = dataUrl.split(','), mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]); let n = bstr.length;
  const u8 = new Uint8Array(n);
  while (n--) u8[n] = bstr.charCodeAt(n);
  return new Blob([u8], { type: mime });
}

/* ═══════════════════════════════════════════════════════════════
   RECENT FILES (localStorage)
═══════════════════════════════════════════════════════════════ */
function saveToRecent(name, pages, size) {
  let recent = getRecent();
  recent = recent.filter(f => f.name !== name);
  recent.unshift({ name, pages, size, date: new Date().toLocaleDateString() });
  if (recent.length > 12) recent.pop();
  localStorage.setItem('rasel_recent', JSON.stringify(recent));
}

function getRecent() {
  try { return JSON.parse(localStorage.getItem('rasel_recent')) || []; }
  catch { return []; }
}

function renderRecent() {
  const list = getRecent();
  const el   = $('recentList');
  const empty = $('recentEmpty');
  el.innerHTML = '';
  if (!list.length) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  list.forEach(f => {
    const card = document.createElement('div'); card.className = 'recent-card';
    card.innerHTML = `
      <div class="recent-card-icon">📄</div>
      <div class="recent-card-name">${f.name}</div>
      <div class="recent-card-meta">${f.pages} pages · ${(f.size/1024).toFixed(0)} KB · ${f.date}</div>
    `;
    el.appendChild(card);
  });
}

/* ═══════════════════════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════════════════════ */
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  el.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  $('toastContainer').appendChild(el);
  setTimeout(() => { el.classList.add('hide'); setTimeout(() => el.remove(), 350); }, 3200);
}

/* ═══════════════════════════════════════════════════════════════
   PROGRESS HELPER
═══════════════════════════════════════════════════════════════ */
function animateProgress(fill, lbl, from, to, label) {
  fill.style.width = from + '%';
  lbl.textContent = label;
  let v = from;
  const iv = setInterval(() => {
    v += (to - v) * 0.2 + 0.5;
    if (v >= to) { v = to; clearInterval(iv); }
    fill.style.width = v + '%';
  }, 50);
}

/* ═══════════════════════════════════════════════════════════════
   MODAL
═══════════════════════════════════════════════════════════════ */
function closeModal(id) { $(id).style.display = 'none'; }
window.closeModal = closeModal;

/* ═══════════════════════════════════════════════════════════════
   VIEW SWITCHING
═══════════════════════════════════════════════════════════════ */
function switchView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  $(`view-${view}`).classList.add('active');
  document.querySelector(`[data-view="${view}"]`).classList.add('active');
  topbarTitle.textContent = { editor: 'PDF Editor', converter: 'PDF Converter', recent: 'Recent Files' }[view];
  if (view === 'recent') renderRecent();
}

/* ═══════════════════════════════════════════════════════════════
   EVENT LISTENERS
═══════════════════════════════════════════════════════════════ */

// File upload
uploadZone.addEventListener('click', e => { if (e.target === uploadBtn || e.target === uploadZone || e.target.tagName === 'H2' || e.target.tagName === 'P') fileInput.click(); });
uploadBtn.addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });
fileInput.addEventListener('change', e => { if (e.target.files[0]) loadPDF(e.target.files[0]); });

// Drag & drop
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault(); uploadZone.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) loadPDF(e.dataTransfer.files[0]);
});

// New file
$('newFileBtn').addEventListener('click', () => {
  editorWrap.style.display = 'none';
  uploadZone.style.display = 'block';
  fileInfo.textContent = 'No file loaded';
  state.pdfDoc = null; state.fabricCanvas = null;
});

// Tool buttons
document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
  btn.addEventListener('click', () => {
    state.currentTool = btn.dataset.tool;
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (state.currentTool === 'signature') {
      openSignatureModal(); return;
    }
    if (state.currentTool === 'image') {
      $('imgInput').click(); return;
    }
    applyTool(state.currentTool);
  });
});

$('imgInput').addEventListener('change', e => { if (e.target.files[0]) insertImage(e.target.files[0]); });
$('colorPicker').addEventListener('input', () => applyTool(state.currentTool));
$('brushSize').addEventListener('input', () => applyTool(state.currentTool));
$('undoBtn').addEventListener('click', undo);
$('redoBtn').addEventListener('click', redo);
$('deleteSelBtn').addEventListener('click', () => { state.fabricCanvas?.remove(state.fabricCanvas.getActiveObject()); savePageState(); });
$('clearBtn').addEventListener('click', () => { state.fabricCanvas?.clear(); savePageState(); });
$('zoomIn').addEventListener('click', () => setZoom(state.zoom + 0.15));
$('zoomOut').addEventListener('click', () => setZoom(state.zoom - 0.15));
$('rotateLeft').addEventListener('click', () => { state.fabricCanvas?.getActiveObject()?.rotate((state.fabricCanvas.getActiveObject().angle||0) - 90); state.fabricCanvas?.renderAll(); });
$('rotateRight').addEventListener('click', () => { state.fabricCanvas?.getActiveObject()?.rotate((state.fabricCanvas.getActiveObject().angle||0) + 90); state.fabricCanvas?.renderAll(); });
$('prevPage').addEventListener('click', () => { const p = getPrevPage(); if (p) switchPage(p); });
$('nextPage').addEventListener('click', () => { const n = getNextPage(); if (n) switchPage(n); });
$('deletePage').addEventListener('click', async () => {
  if (state.totalPages - state.deletedPages.size <= 1) { toast('Cannot delete the last page.', 'error'); return; }
  state.deletedPages.add(state.currentPage);
  const next = getNextPage() || getPrevPage();
  await buildThumbnails();
  if (next) switchPage(next);
  toast(`Page ${state.currentPage} deleted.`, 'info');
});
$('rotatePage').addEventListener('click', async () => {
  state.pageRotations[state.currentPage] = ((state.pageRotations[state.currentPage] || 0) + 90) % 360;
  await renderPage(state.currentPage);
  await buildThumbnails();
});
$('exportBtn').addEventListener('click', exportBtn_click);
async function exportBtn_click() { await exportPDF(); }

$('applySig').addEventListener('click', applySig);
$('clearSig').addEventListener('click', () => { const sc = $('sigCanvas'); state.sigCtx.clearRect(0,0,sc.width,sc.height); });

// Converter
$('convertUploadBtn').addEventListener('click', () => $('convertInput').click());
$('convertInput').addEventListener('change', e => { if (e.target.files[0]) loadConvertPDF(e.target.files[0]); });
$('convertZone').addEventListener('dragover', e => { e.preventDefault(); $('convertZone').classList.add('drag-over'); });
$('convertZone').addEventListener('dragleave', () => $('convertZone').classList.remove('drag-over'));
$('convertZone').addEventListener('drop', e => { e.preventDefault(); $('convertZone').classList.remove('drag-over'); if (e.dataTransfer.files[0]) loadConvertPDF(e.dataTransfer.files[0]); });
$('startConvertBtn').addEventListener('click', startConversion);
$('downloadAllPng').addEventListener('click', downloadAllAsZip);
$('clearConvert').addEventListener('click', () => { $('convertResults').innerHTML = ''; state.convertPages = []; $('convertActions').style.display = 'none'; $('convertZone').style.display = 'block'; $('convertWorkspace').style.display = 'none'; });

document.querySelectorAll('input[name="pages"]').forEach(r => {
  r.addEventListener('change', () => { $('pageSelectRow').style.display = r.value === 'selected' ? 'flex' : 'none'; });
});
$('qualitySlider').addEventListener('input', () => { $('qualityLabel').textContent = $('qualitySlider').value + 'x'; });

// Nav
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

// Sidebar mobile toggle
$('menuToggle').addEventListener('click', () => document.querySelector('.sidebar').classList.toggle('open'));

// Theme toggle
$('themeToggle').addEventListener('click', () => {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') !== 'light';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  $('themeToggle').textContent = isDark ? '🌞' : '🌙';
});

// Fullscreen
$('fullscreenBtn').addEventListener('click', () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
});

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  const focused = document.activeElement.tagName;
  if (focused === 'INPUT' || focused === 'TEXTAREA') return;
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
  if (e.key === 'Delete' && state.fabricCanvas) { state.fabricCanvas.remove(state.fabricCanvas.getActiveObject()); savePageState(); }
  if ((e.ctrlKey || e.metaKey) && e.key === '=') { e.preventDefault(); setZoom(state.zoom + 0.15); }
  if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); setZoom(state.zoom - 0.15); }
  if (e.key === 'f' || e.key === 'F') { document.documentElement.requestFullscreen?.(); }
  if (e.key === 'ArrowRight' && state.pdfDoc) { const n = getNextPage(); if (n) switchPage(n); }
  if (e.key === 'ArrowLeft'  && state.pdfDoc) { const p = getPrevPage(); if (p) switchPage(p); }
});

// Initial animation
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('app').style.opacity = '0';
});
