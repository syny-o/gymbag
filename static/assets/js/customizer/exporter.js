'use strict';

/**
 * exporter.js
 *
 * - Tlačítko "Export PNG" vykreslí obsah #product (podklad, text, uživatelský obrázek) na <canvas>
 *   a stáhne obrázek jako PNG (retina-ready, respektuje rotace/scale/pozice).
 * - Současně vypíše do konzole parametry: barva tašky, text (barva, velikost, rotace, styl),
 *   a velikost obrázku (scale %). Pokud něco chybí (např. není nahraný obrázek), pole je vynecháno.
 */

(function initExporter() {
  const SELECTORS = {
    product: '#product',
    productImg: '#productImg',
    designText: '#designText',
    designImage: '#designImage',
    exportBtn: '#exportPNGBtn',
    swatches: '#colorSwatches .swatch.is-selected',
  };

  const productEl   = document.querySelector(SELECTORS.product);
  const productImg  = /** @type {HTMLImageElement|null} */ (document.querySelector(SELECTORS.productImg));
  const exportBtn   = /** @type {HTMLButtonElement|null} */ (document.querySelector(SELECTORS.exportBtn));

  if (!productEl || !exportBtn) return;

  // Povol tlačítko (uživatel může exportovat i s prázdným textem / bez vloženého obrázku)
  exportBtn.disabled = false;

  exportBtn.addEventListener('click', async () => {
    // Počkáme na načtení fontů (kvůli Canvas textu)
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (_) {}
    }

    const w = productEl.clientWidth;
    const h = productEl.clientHeight;
    if (!w || !h) return;

    // Retina plátno
    const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
    const canvas = document.createElement('canvas');
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr); // od teď kreslíme v CSS pixelech

    // Funkce pomocníci
    const getRectRelTo = (el, container) => {
      const er = el.getBoundingClientRect();
      const cr = container.getBoundingClientRect();
      return {
        left:  er.left - cr.left,
        top:   er.top  - cr.top,
        width: er.width,
        height:er.height,
      };
    };

    // 1) Podkladový obrázek tašky
    if (productImg && productImg.complete) {
      // Vykreslíme přesně do rozměru #product
      ctx.drawImage(productImg, 0, 0, w, h);
    } else {
      // fallback průhledné pozadí
      ctx.clearRect(0, 0, w, h);
    }

    // 2) Uživatelský obrázek (#designImage) + jeho transformace
    const designImage = /** @type {HTMLImageElement|null} */ (document.querySelector(SELECTORS.designImage));
    if (designImage && designImage.complete) {
      const rect = getRectRelTo(designImage, productEl);
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const rotDeg = parseFloat(designImage.dataset.rot || '0') || 0;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rotDeg * Math.PI / 180);
      // Kreslíme tak, aby výsledná velikost odpovídala bboxu v DOM:
      ctx.drawImage(designImage, -rect.width / 2, -rect.height / 2, rect.width, rect.height);
      ctx.restore();
    }

    // 3) Text (#designText) – respektuje font, barvu, rotaci, velikost
    const designText = /** @type {HTMLElement|null} */ (document.querySelector(SELECTORS.designText));
    if (designText && designText.style.display !== 'none' && designText.textContent?.trim()) {
      const text = designText.textContent.trim();

      // Pozice a rotace (rotace kolem středu)
      const rect = getRectRelTo(designText, productEl);
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const rotDeg = parseFloat(designText.dataset.rotateDeg || '0') || 0;

      // Vypočteme font z computed style
      const cs = window.getComputedStyle(designText);
      const fontSize  = parseFloat(cs.fontSize) || 16;
      const fontFamily= cs.fontFamily || 'Montserrat, system-ui, Arial';
      const fontStyle = (cs.fontStyle && cs.fontStyle !== 'normal') ? cs.fontStyle : '';
      const fontWeight= (cs.fontWeight && cs.fontWeight !== '400') ? cs.fontWeight : '';
      const color     = cs.color || '#000';
      const textTransform = cs.textTransform || 'none';

      // Aplikuj transformaci textu (uppercase atd.)
      const renderedText = (textTransform === 'uppercase') ? text.toUpperCase() : text;

      // Kreslení textu
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rotDeg * Math.PI / 180);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      // Sestav font shodně s CSS: [font-style] [font-weight] [font-size] [font-family]
      const parts = [fontStyle, fontWeight, `${Math.round(fontSize)}px`, fontFamily].filter(Boolean);
      ctx.font = parts.join(' ');
      ctx.fillText(renderedText, 0, 0);
      ctx.restore();
    }

    // 4) Stáhni PNG
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `customizer-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    // 5) Výpis parametrů do konzole
    logParameters();
  });

  // -----------------------------------------------------------
  // Výpis parametrů do konzole
  function logParameters() {
    const swatch = /** @type {HTMLElement|null} */ (document.querySelector(SELECTORS.swatches));

    const designText = /** @type {HTMLElement|null} */ (document.querySelector(SELECTORS.designText));
    const textParams = (() => {
      if (!designText || designText.style.display === 'none' || !designText.textContent?.trim()) return null;
      const cs = window.getComputedStyle(designText);
      const boldBtn = /** @type {HTMLButtonElement|null} */ (document.querySelector('#styleBold'));
      const italicBtn = /** @type {HTMLButtonElement|null} */ (document.querySelector('#styleItalic'));
      const upperBtn = /** @type {HTMLButtonElement|null} */ (document.querySelector('#styleUppercase'));
      const fontSizePx = Math.round(parseFloat(cs.fontSize) || 0);
      const rotationDeg = Math.round(parseFloat(designText.dataset.rotateDeg || '0') || 0);
      const color = cs.color || '#000';
      const family = cs.fontFamily || '';
      const bold = boldBtn ? (boldBtn.getAttribute('aria-pressed') === 'true') : (cs.fontWeight !== '400');
      const italic = italicBtn ? (italicBtn.getAttribute('aria-pressed') === 'true') : (cs.fontStyle !== 'normal');
      const uppercase = upperBtn ? (upperBtn.getAttribute('aria-pressed') === 'true') : (cs.textTransform === 'uppercase');

      return {
        value: designText.textContent.trim(),
        color,
        sizePx: fontSizePx,
        rotationDeg,
        style: { bold, italic, uppercase },
        fontFamily: family,
      };
    })();

    const designImage = /** @type {HTMLImageElement|null} */ (document.querySelector(SELECTORS.designImage));
    const imageParams = (() => {
      if (!designImage) return null;
      const scale = parseFloat(designImage.dataset.scale || '1') || 1;
      const rotationDeg = Math.round(parseFloat(designImage.dataset.rot || '0') || 0);
      return {
        sizePercent: Math.round(scale * 100), // 10–200 %
        rotationDeg,                          // pro informaci, i když nebyl výslovně požadován
      };
    })();

    const bagColor = swatch?.getAttribute('data-color') || null;

    const result = {
      bagColor, // barva tašky (swatch)
      text: textParams && {
        color: textParams.color,
        sizePx: textParams.sizePx,
        rotationDeg: textParams.rotationDeg,
        style: textParams.style,     // { bold, italic, uppercase }
        fontFamily: textParams.fontFamily,
        value: textParams.value,
      },
      image: imageParams && {
        sizePercent: imageParams.sizePercent, // velikost obrázku
        rotationDeg: imageParams.rotationDeg,
      }
    };

    // Hezký výpis
    console.log('——— Export params ———');
    if (result.bagColor) console.log('Taška · barva:', result.bagColor);
    if (result.text) {
      console.log('Text:', result.text.value);
      console.log('Text · barva:', result.text.color);
      console.log('Text · velikost (px):', result.text.sizePx);
      console.log('Text · rotace (°):', result.text.rotationDeg);
      console.log('Text · styl:', result.text.style);
      console.log('Text · font:', result.text.fontFamily);
    } else {
      console.log('Text: —');
    }
    if (result.image) {
      console.log('Obrázek · velikost (%):', result.image.sizePercent);
      console.log('Obrázek · rotace (°):', result.image.rotationDeg);
    } else {
      console.log('Obrázek: —');
    }
    console.log('———————————————');
  }
})();
