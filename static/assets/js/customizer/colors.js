'use strict';

/**
 * Přepínání variant tašky podle dvou pickerů:
 *  - barva těla (colorSwatches)      → data-color="black|red|green|blue|ping|grey"
 *  - barva popruhu (strapSwatches)   → data-strap="black|white"
 *
 * Soubory jsou pojmenované:
 *   gymbag_{color}.png                (popruh black)
 *   gymbag_{color}_white.png          (popruh white)
 *
 * HTML očekává:
 *   <div id="colorSwatches">  <button class="swatch" data-color="black">…</button> … </div>
 *   <div id="strapSwatches">  <button class="swatch" data-strap="black">…</button>
 *                              <button class="swatch" data-strap="white">…</button> </div>
 *   <img id="productImg" …>
 */

(function initColorsFeature() {
  // --- cesty k obrázkům (uprav si dle projektu) ---
  const IMG_BASE   = '../static/assets/img/customizer/';
  const IMG_PREFIX = 'gymbag_';
  const IMG_EXT    = '.png';

  // --- DOM odkazy ---
  const colorSwatches = document.getElementById('colorSwatches');
  const strapSwatches = document.getElementById('strapSwatches'); // může, ale nemusí existovat
  const productImg    = document.getElementById('productImg');

  if (!colorSwatches || !productImg) return; // bez těchto nemáme co dělat

  // --- výchozí hodnoty + podpora ARIA/selected tříd ---
  let currentColor = 'black';
  let currentStrap = 'black'; // default = žádný postfix

  // dostupné hodnoty (pro preload i validaci)
  const COLORS = ['black', 'red', 'green', 'blue', 'ping', 'grey'];
  const STRAPS = ['black', 'white'];

  // --- cache & preload kombinací ---
  const cache = new Map(); // klíč "color|strap" → Image

  function keyFor(color, strap) {
    return `${color}|${strap}`;
  }

  function urlFor(color, strap) {
    const postfix = (strap === 'white') ? '_white' : '';
    return `${IMG_BASE}${IMG_PREFIX}${color}${postfix}${IMG_EXT}`;
  }

  function preload(color, strap) {
    const k = keyFor(color, strap);
    if (cache.has(k)) return cache.get(k);
    const img = new Image();
    img.src = urlFor(color, strap);
    cache.set(k, img);
    return img;
  }

  // přednačti nejčastější kombinace (všechny barvy × oba popruhy)
  COLORS.forEach(c => STRAPS.forEach(s => preload(c, s)));

  // --- utility pro .is-selected + aria-selected v konkrétním kontejneru ---
  function markSelected(container, btn) {
    container.querySelectorAll('.swatch.is-selected').forEach(b => b.classList.remove('is-selected'));
    container.querySelectorAll('.swatch[aria-selected="true"]').forEach(b => b.setAttribute('aria-selected', 'false'));
    if (btn) {
      btn.classList.add('is-selected');
      btn.setAttribute('aria-selected', 'true');
    }
  }

  // --- vykreslení výsledku ---
  function applyVariant() {
    const src = urlFor(currentColor, currentStrap);
    productImg.src = src;
    // případně můžeme logovat:
    // console.debug('[colors] variant:', { color: currentColor, strap: currentStrap, src });
  }

  // --- obsluha kliků/kláves pro oba pickery ---
  function bindPicker(container, type /* 'color' | 'strap' */) {
    if (!container) return;

    function handle(btn) {
      if (!btn) return;
      const val = (type === 'color') ? btn.dataset.color : btn.dataset.strap;
      if (!val) return;
      if (type === 'color')   currentColor = val;
      if (type === 'strap')   currentStrap = val;
      markSelected(container, btn);
      applyVariant();
    }

    container.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.swatch');
      if (!btn || !container.contains(btn)) return;
      handle(btn);
    });

    container.addEventListener('keydown', (ev) => {
      const btn = ev.target.closest('.swatch');
      if (!btn || !container.contains(btn)) return;
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        handle(btn);
      }
    });

    // inicializace z .is-selected (nebo vezmi první)
    const initial = container.querySelector('.swatch.is-selected') || container.querySelector('.swatch');
    if (initial) handle(initial);
  }

  // --- start ---
  bindPicker(colorSwatches, 'color');
  // Pokud druhý picker neexistuje, držíme default 'black' (bez postfixu)
  bindPicker(strapSwatches, 'strap');

  // kdyby žádný strap nebyl označen (picker chybí), přece jen vykresli variantu
  applyVariant();
})();
