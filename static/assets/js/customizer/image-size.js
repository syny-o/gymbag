'use strict';

/**
 * image-size.js
 *
 * Obousměrná synchronizace POSUVNÍKU „Velikost obrázku“ ⇄ scale obrázku #designImage.
 * - Slider #imageSize řídí dataset.scale (0.2–6) a hned přepočítá transform.
 * - Při resize úchytem (image-transform.js) se mění dataset.scale → slider se automaticky přepíše.
 * - Při vložení/odebrání obrázku se slider povolí/zakáže.
 */

(function initImageSizeControl() {
  const SELECTORS = { product: '#product', image: '#designImage', slider: '#imageSize' };
  const MIN_SCALE = 0.1;
  const MAX_SCALE = 2.0;

  const productEl = document.querySelector(SELECTORS.product);
  const sliderEl  = /** @type {HTMLInputElement|null} */ (document.querySelector(SELECTORS.slider));
  if (!productEl || !sliderEl) return;

  let imgEl = /** @type {HTMLImageElement|null} */ (document.querySelector(SELECTORS.image));
  let attrObserver = null;

  // --- Helpers -------------------------------------------------------

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  // Ověření a načtení aktuálního scale (preferujeme dataset.scale, fallback z transform)
  function getCurrentScale() {
    if (!imgEl) return 1;
    const ds = parseFloat(imgEl.dataset.scale || '1');
    if (isFinite(ds) && ds > 0) return ds;

    // fallback – parsovat matrix
    const tr = getComputedStyle(imgEl).transform;
    if (!tr || tr === 'none') return 1;
    if (tr.startsWith('matrix3d(')) {
      const n = tr.slice(9, -1).split(',').map(v => parseFloat(v.trim()));
      const sx = Math.hypot(n[0], n[1]);
      const sy = Math.hypot(n[4], n[5]);
      return (sx + sy) / 2 || 1;
    }
    if (tr.startsWith('matrix(')) {
      const n = tr.slice(7, -1).split(',').map(v => parseFloat(v.trim()));
      const sx = Math.hypot(n[0], n[1]);
      const sy = Math.hypot(n[2], n[3]);
      return (sx + sy) / 2 || 1;
    }
    return 1;
  }

  // Aplikace scale → aktualizuje dataset.scale i transform konzistentně s image-transform.js
  function applyScale(newScale) {
    if (!imgEl) return;
    const s = clamp(newScale, MIN_SCALE, MAX_SCALE);
    imgEl.dataset.scale = String(s);

    // Zachováme translate/rotate, jen přepíšeme scale:
    const x = parseFloat(imgEl.dataset.x || '0') || 0;
    const y = parseFloat(imgEl.dataset.y || '0') || 0;
    const r = parseFloat(imgEl.dataset.rot || '0') || 0;
    imgEl.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${r}deg) scale(${s})`;

    // Ať se rám/ostatní moduly přepočítají:
    window.dispatchEvent(new Event('resize'));
  }

  // Slider ←→ Image
  function syncSliderFromImage() {
    if (!imgEl) return;
    const s = getCurrentScale();
    const pct = Math.round(s * 100);
    if (String(sliderEl.value) !== String(pct)) {
      sliderEl.value = String(pct);
    }
  }

  function onSliderInput() {
    if (!imgEl) return;
    const pct = parseInt(sliderEl.value, 10);
    const s = clamp((pct || 100) / 100, MIN_SCALE, MAX_SCALE);
    applyScale(s);
  }

  // Aktivace / deaktivace ovladače
  function enableControls(enable) {
    sliderEl.disabled = !enable;
    if (enable) {
      syncSliderFromImage();
    } else {
      sliderEl.value = '100';
    }
  }

  // Sleduj změny na obrázku (dataset.scale / style) → update slideru
  function observeImage(el) {
    if (attrObserver) { attrObserver.disconnect(); attrObserver = null; }
    if (!el) return;
    attrObserver = new MutationObserver(() => {
      syncSliderFromImage();
    });
    attrObserver.observe(el, {
      attributes: true,
      attributeFilter: ['style', 'data-scale']
    });
    syncSliderFromImage();
  }

  // Reaguj na vložení/odebrání obrázku v #product
  const mo = new MutationObserver(() => {
    const found = /** @type {HTMLImageElement|null} */ (document.querySelector(SELECTORS.image));
    if (found && imgEl !== found) {
      imgEl = found;
      enableControls(true);
      observeImage(imgEl);
    } else if (!found) {
      imgEl = null;
      enableControls(false);
      if (attrObserver) { attrObserver.disconnect(); attrObserver = null; }
    }
  });
  mo.observe(productEl, { childList: true });

  // Po načtení – pokud už obrázek existuje
  if (imgEl) {
    enableControls(true);
    observeImage(imgEl);
  } else {
    enableControls(false);
  }

  // Bind slider
  sliderEl.addEventListener('input', onSliderInput);
  sliderEl.addEventListener('change', onSliderInput);
})();
