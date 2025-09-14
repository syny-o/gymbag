'use strict';

/**
 * image-snap.js
 * Magnetická vodítka pro OBRÁZEK (#designImage) s transform-based pozicí.
 * - snap k okrajům a středům KONTEJNERU (#product)
 * - funguje při DRAGU obrázku i jeho RÁMU (ignoruje .handle)
 * - poslouchá pointerdown v CAPTURE fázi (nevadí stopPropagation jinde)
 */
(function initImageSnap() {
  const SELECTORS = { product: '#product', image: '#designImage' };
  const productEl = document.querySelector(SELECTORS.product);
  if (!productEl) return;

  const CFG = { threshold: 8, showGuides: true };

  // --- Vodítka -------------------------------------------------------
  const guideV = document.createElement('div');
  const guideH = document.createElement('div');
  for (const g of [guideV, guideH]) {
    g.style.position = 'absolute';
    g.style.zIndex = '1000';
    g.style.pointerEvents = 'none';
    g.style.display = 'none';
    g.style.background = 'rgba(110,168,254,0.9)';
    g.style.boxShadow = '0 0 0 1px rgba(255,255,255,0.2)';
  }
  guideV.style.top = '0'; guideV.style.bottom = '0'; guideV.style.width = '2px';
  guideH.style.left = '0'; guideH.style.right = '0'; guideH.style.height = '2px';

  if (!productEl.style.position) productEl.style.position = 'relative';
  productEl.appendChild(guideV); productEl.appendChild(guideH);

  // --- Stav ----------------------------------------------------------
  /** @type {HTMLImageElement|null} */ let imageEl = null;
  let isActiveDrag = false;

  // --- Helpers -------------------------------------------------------
  const hideGuides = () => { guideV.style.display = 'none'; guideH.style.display = 'none'; };
  const showV = (x) => { if (CFG.showGuides) { guideV.style.left = x + 'px'; guideV.style.display = 'block'; } };
  const showH = (y) => { if (CFG.showGuides) { guideH.style.top  = y + 'px'; guideH.style.display = 'block'; } };
  const contRect = () => productEl.getBoundingClientRect();

  const getXY = () => ({
    x: parseFloat(imageEl?.dataset.x || '0') || 0,
    y: parseFloat(imageEl?.dataset.y || '0') || 0
  });
  const getScaleRot = () => ({
    s: parseFloat(imageEl?.dataset.scale || '1') || 1,
    r: parseFloat(imageEl?.dataset.rot   || '0') || 0
  });

  function applyTransform(nx, ny) {
    if (!imageEl) return;
    const { s, r } = getScaleRot();
    imageEl.dataset.x = String(nx);
    imageEl.dataset.y = String(ny);
    imageEl.style.transform = `translate(-50%, -50%) translate(${nx}px, ${ny}px) rotate(${r}deg) scale(${s})`;
    window.dispatchEvent(new Event('resize'));
  }

  function computeAndSnap() {
    if (!imageEl) return;

    const cr = contRect();
    const contW = productEl.clientWidth, contH = productEl.clientHeight;
    const rect = imageEl.getBoundingClientRect();

    // pozice vůči kontejneru
    const left = rect.left - cr.left, top = rect.top - cr.top;
    const width = rect.width, height = rect.height;
    const right = left + width, bottom = top + height;
    const midX = left + width/2, midY = top + height/2;

    const candX = [
      { pos: left,  target: 0,         guide: 0,         set: () => 0 },
      { pos: midX,  target: contW/2,   guide: contW/2,   set: () => contW/2 - width/2 },
      { pos: right, target: contW,     guide: contW,     set: () => contW - width },
    ];
    const candY = [
      { pos: top,   target: 0,         guide: 0,         set: () => 0 },
      { pos: midY,  target: contH/2,   guide: contH/2,   set: () => contH/2 - height/2 },
      { pos: bottom,target: contH,     guide: contH,     set: () => contH - height },
    ];

    let bestX = null, bestXd = Infinity;
    for (const c of candX) { const d = Math.abs(c.pos - c.target); if (d < bestXd && d <= CFG.threshold) { bestX = c; bestXd = d; } }
    let bestY = null, bestYd = Infinity;
    for (const c of candY) { const d = Math.abs(c.pos - c.target); if (d < bestYd && d <= CFG.threshold) { bestY = c; bestYd = d; } }

    let goalLeft = left, goalTop = top;
    if (bestX) { goalLeft = bestX.set(); showV(bestX.guide); } else { guideV.style.display = 'none'; }
    if (bestY) { goalTop  = bestY.set(); showH(bestY.guide); } else { guideH.style.display = 'none'; }

    goalLeft = Math.max(0, Math.min(goalLeft, Math.max(0, contW - width)));
    goalTop  = Math.max(0, Math.min(goalTop , Math.max(0, contH - height)));

    const { x: curX, y: curY } = getXY();
    const dx = goalLeft - left, dy = goalTop - top;
    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) applyTransform(curX + dx, curY + dy);
  }

  // Aktivace: když táhneme OBRÁZEK nebo JEHO RÁM (ne úchyty). CAPTURE fáze!
  function onPointerDownCapture(e) {
    const t = /** @type {HTMLElement} */(e.target);
    if (!imageEl) { isActiveDrag = false; return; }

    const isImage = t === imageEl;
    const frame = t.closest?.('.frame');
    const isImageFrame = !!(frame && (frame.getAttribute('data-owner') === 'image' || frame.dataset.owner === 'image'));
    const isHandle = t.classList?.contains('handle');

    isActiveDrag = (isImage || isImageFrame) && !isHandle;
  }
  function onPointerMove() { if (isActiveDrag) computeAndSnap(); }
  function onPointerUp()   { isActiveDrag = false; hideGuides(); }

  window.addEventListener('pointerdown', onPointerDownCapture, true); // ⟵ capture!
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('resize', hideGuides);

  // Sleduj vznik/zmizení obrázku
  const obs = new MutationObserver(() => {
    const img = /** @type {HTMLImageElement|null} */(document.querySelector(SELECTORS.image));
    imageEl = img || null;
    hideGuides();
  });
  obs.observe(productEl, { childList: true });

  const existing = /** @type {HTMLImageElement|null} */(document.querySelector(SELECTORS.image));
  if (existing) imageEl = existing;
})();
