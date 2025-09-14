'use strict';

/**
 * typography.js
 *
 * Ovládací panel pro:
 *  - Písmo (select#fontFamily)
 *  - Barvu (input#fontColor)
 *  - Velikost (range#fontSize)  ⇄  obousměrně se skutečnou velikostí (font-size × scale)
 *  - Styl: Tučné / Kurzíva / Uppercase (tlačítka)
 *
 * Po změně, která ovlivňuje rozměry (písmo, velikost, tučné/kurzíva/uppercase),
 * voláme window.dispatchEvent(new Event('resize')) → rám v resize.js se přepočítá.
 */
(function initTypography() {
  const SELECTORS = {
    product:    '#product',
    text:       '#designText',
    fontSelect: '#fontFamily',
    colorInput: '#fontColor',
    sizeRange:  '#fontSize',

    // Stylová tlačítka – podporujeme ID i data-style (pro robustnost)
    boldBtn:       '#styleBold, [data-style="bold"]',
    italicBtn:     '#styleItalic, [data-style="italic"]',
    uppercaseBtn:  '#styleUppercase, [data-style="uppercase"]',
  };

  // ---------- Helpers: DOM refs ----------
  function qs(sel) { return /** @type {HTMLElement|null} */(document.querySelector(sel)); }
  function getRefs() {
    return {
      product:    /** @type {HTMLElement|null} */      (qs(SELECTORS.product)),
      text:       /** @type {HTMLElement|null} */      (qs(SELECTORS.text)),
      fontSelect: /** @type {HTMLSelectElement|null} */(qs(SELECTORS.fontSelect)),
      colorInput: /** @type {HTMLInputElement|null} */ (qs(SELECTORS.colorInput)),
      sizeRange:  /** @type {HTMLInputElement|null} */ (qs(SELECTORS.sizeRange)),
      boldBtn:    /** @type {HTMLButtonElement|null} */(qs(SELECTORS.boldBtn)),
      italicBtn:  /** @type {HTMLButtonElement|null} */(qs(SELECTORS.italicBtn)),
      upperBtn:   /** @type {HTMLButtonElement|null} */(qs(SELECTORS.uppercaseBtn)),
    };
  }

  // ---------- Helpers: transform/scale & velikost ----------
  function getScaleFromTransform(el) {
    const tr = getComputedStyle(el).transform;
    if (!tr || tr === 'none') return 1;

    if (tr.startsWith('matrix3d(')) {
      const n = tr.slice(9, -1).split(',').map(v => parseFloat(v.trim()));
      const a = n[0], b = n[1], c = n[4], d = n[5];
      const sx = Math.hypot(a, b);
      const sy = Math.hypot(c, d);
      return (sx + sy) / 2 || 1;
    }
    if (tr.startsWith('matrix(')) {
      const n = tr.slice(7, -1).split(',').map(v => parseFloat(v.trim()));
      const a = n[0], b = n[1], c = n[2], d = n[3];
      const sx = Math.hypot(a, b);
      const sy = Math.hypot(c, d);
      return (sx + sy) / 2 || 1;
    }
    return 1;
  }

  // Efektivní velikost = font-size * scale (zaokrouhleno na px)
  function getEffectiveFontSizePx(el) {
    const fontPx = parseFloat(getComputedStyle(el).fontSize) || 0;
    const scale  = getScaleFromTransform(el);
    return Math.round(fontPx * scale);
  }

  // Nastaví efektivní velikost tak, že upraví base font-size s ohledem na aktuální scale
  function setEffectiveFontSizePx(el, desiredPx) {
    const scale = getScaleFromTransform(el) || 1;
    const base  = Math.max(1, desiredPx / scale); // ochrana proti 0/NaN
    el.style.fontSize = `${base}px`;
  }

  // ---------- Apply: font & color ----------
  function applyFont(textEl, fontSelect) {
    if (!textEl || !fontSelect) return;
    const value = fontSelect.value || 'Montserrat, system-ui, Arial';
    textEl.style.fontFamily = value;
    window.dispatchEvent(new Event('resize')); // písmo mění rozměry
  }

  function applyColor(textEl, colorInput) {
    if (!textEl || !colorInput) return;
    const value = colorInput.value || '#ffffff';
    textEl.style.color = value;
    // barva nemění rozměry
  }

  // ---------- Styl: tučné / kurzíva / uppercase ----------
  function setButtonPressed(btn, pressed) {
    if (!btn) return;
    btn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  }
  function isButtonPressed(btn) {
    return !!btn && btn.getAttribute('aria-pressed') === 'true';
  }
  function toggleButton(btn) {
    if (!btn) return false;
    const next = !isButtonPressed(btn);
    setButtonPressed(btn, next);
    return next;
  }

  function applyBold(textEl, on) {
    if (!textEl) return;
    textEl.style.fontWeight = on ? '800' : '400';
    window.dispatchEvent(new Event('resize')); // mění rozměry
  }
  function applyItalic(textEl, on) {
    if (!textEl) return;
    textEl.style.fontStyle = on ? 'italic' : 'normal';
    window.dispatchEvent(new Event('resize')); // mění rozměry
  }
  function applyUppercase(textEl, on) {
    if (!textEl) return;
    textEl.style.textTransform = on ? 'uppercase' : 'none';
    window.dispatchEvent(new Event('resize')); // může ovlivnit šířku
  }

  // ---------- Sync: range ⇄ text ----------
  function syncRangeFromText(textEl, sizeRange) {
    if (!textEl || !sizeRange) return;
    const eff = getEffectiveFontSizePx(textEl);
    if (String(sizeRange.value) !== String(eff)) {
      sizeRange.value = String(eff);
    }
  }

  function syncTextFromRange(textEl, sizeRange) {
    if (!textEl || !sizeRange) return;
    const desired = parseInt(sizeRange.value, 10) || 0;
    setEffectiveFontSizePx(textEl, desired);
    window.dispatchEvent(new Event('resize')); // změna rozměrů
  }

  // ---------- Observers & polling ----------
  let styleObserver = null;

  function attachStyleObserver(textEl, sizeRange) {
    if (styleObserver) {
      styleObserver.disconnect();
      styleObserver = null;
    }
    // Sleduj změny atributu style (transform, font-size, fontWeight, fontStyle, textTransform)
    styleObserver = new MutationObserver(() => {
      syncRangeFromText(textEl, sizeRange);
    });
    styleObserver.observe(textEl, { attributes: true, attributeFilter: ['style'] });
    // první srovnání
    syncRangeFromText(textEl, sizeRange);
  }

  // „Měkký“ polling při práci s úchyty .handle – hladší realtime update slideru
  let pollUntil = 0;
  function softPoll(textEl, sizeRange) {
    if (performance.now() < pollUntil) {
      syncRangeFromText(textEl, sizeRange);
      requestAnimationFrame(() => softPoll(textEl, sizeRange));
    }
  }

  function bindPointerPolling(productEl, textEl, sizeRange) {
    if (!productEl) return;
    window.addEventListener('pointerdown', (e) => {
      const t = /** @type {HTMLElement} */(e.target);
      if (t && t.classList && t.classList.contains('handle')) {
        pollUntil = performance.now() + 1200;
        requestAnimationFrame(() => softPoll(textEl, sizeRange));
      }
    });
  }

  // Sledujeme vznik/zmizení #designText v rámci #product
  function attachChildObserver(productEl, onTextReady) {
    if (!productEl) return;
    const childObs = new MutationObserver(() => {
      const textEl = qs(SELECTORS.text);
      if (textEl) onTextReady(textEl);
    });
    childObs.observe(productEl, { childList: true, subtree: false });

    // kdyby už existoval
    const existing = qs(SELECTORS.text);
    if (existing) onTextReady(existing);
  }

  // ---------- Vše svážeme dohromady ----------
  function bindAll() {
    const {
      product, text, fontSelect, colorInput, sizeRange,
      boldBtn, italicBtn, upperBtn
    } = getRefs();

    // Odemknout ovladače (kdyby byly v HTML disabled)
    if (fontSelect) fontSelect.disabled = false;
    if (colorInput) colorInput.disabled = false;
    if (sizeRange)  sizeRange.disabled  = false;
    if (boldBtn)    boldBtn.disabled    = false;
    if (italicBtn)  italicBtn.disabled  = false;
    if (upperBtn)   upperBtn.disabled   = false;

    // --- Změny ovladačů → aplikuj na text ---
    if (fontSelect) fontSelect.addEventListener('change', () => {
      const { text } = getRefs();
      if (text) applyFont(text, fontSelect);
    });
    if (colorInput) colorInput.addEventListener('input', () => {
      const { text } = getRefs();
      if (text) applyColor(text, colorInput);
    });
    if (sizeRange) {
      sizeRange.addEventListener('input', () => {
        const { text } = getRefs();
        if (text) syncTextFromRange(text, sizeRange);
      });
      sizeRange.addEventListener('change', () => {
        const { text } = getRefs();
        if (text) syncTextFromRange(text, sizeRange);
      });
    }

    // Stylová tlačítka
    if (boldBtn) boldBtn.addEventListener('click', () => {
      const { text } = getRefs();
      const on = toggleButton(boldBtn);
      if (text) applyBold(text, on);
    });
    if (italicBtn) italicBtn.addEventListener('click', () => {
      const { text } = getRefs();
      const on = toggleButton(italicBtn);
      if (text) applyItalic(text, on);
    });
    if (upperBtn) upperBtn.addEventListener('click', () => {
      const { text } = getRefs();
      const on = toggleButton(upperBtn);
      if (text) applyUppercase(text, on);
    });

    // --- Když se text objeví, nastav z UI a připoj pozorování ---
    attachChildObserver(product, (textEl) => {
      if (fontSelect) applyFont(textEl, fontSelect);
      if (colorInput) applyColor(textEl, colorInput);
      if (sizeRange)  syncTextFromRange(textEl, sizeRange);

      // inicializace stylů z tlačítek (výchozí aria-pressed="false")
      if (boldBtn)   applyBold(textEl,   isButtonPressed(boldBtn));
      if (italicBtn) applyItalic(textEl, isButtonPressed(italicBtn));
      if (upperBtn)  applyUppercase(textEl, isButtonPressed(upperBtn));

      if (sizeRange) attachStyleObserver(textEl, sizeRange);
      if (sizeRange) bindPointerPolling(product, textEl, sizeRange);
    });
  }

  // ---------- Start ----------
  function init() {
    // Po načtení DOM navážeme logiku. Pokud text ještě není, child observer si počká.
    bindAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
