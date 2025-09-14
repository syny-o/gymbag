'use strict';

/**
 * Přepínání barev tašky (přes obrázky gymbag_{color}.png).
 * - Globální: žádné moduly; jen běží po načtení DOM.
 * - HTML: očekává #colorSwatches (s .swatch[data-color="..."]) a #productImg.
 */
(function initColorsFeature(){
  // Nastavení cest – uprav si podle svého umístění souborů
  const IMG_BASE   = '../static/assets/img/customizer/';     // složka s obrázky
  const IMG_PREFIX = 'gymbag_';       // prefix souboru
  const IMG_EXT    = '.png';          // přípona

  const swatchesContainer = document.getElementById('colorSwatches');
  const productImg = document.getElementById('productImg');

  if (!swatchesContainer || !productImg) return;

  // barvy (musí odpovídat názvům souborů po prefixu)
  const COLORS = ['black','red','green','blue','ping','grey'];

  // pro rychlejší přepínání si obrázky přednačteme
  const cache = new Map();
  function preload(color){
    const url = `${IMG_BASE}${IMG_PREFIX}${color}${IMG_EXT}`;
    if (cache.has(color)) return cache.get(color);
    const img = new Image();
    img.src = url;
    cache.set(color, img);
    return img;
  }
  COLORS.forEach(preload);

  function setSelected(buttonEl){
    // odeber označení všem
    swatchesContainer.querySelectorAll('.swatch.is-selected').forEach(b => b.classList.remove('is-selected'));
    // přidej aktivnímu
    buttonEl.classList.add('is-selected');
    // ARIA
    swatchesContainer.querySelectorAll('.swatch[aria-selected="true"]').forEach(b => b.setAttribute('aria-selected','false'));
    buttonEl.setAttribute('aria-selected','true');
  }

  function setProductColor(color, buttonEl){
    const url = `${IMG_BASE}${IMG_PREFIX}${color}${IMG_EXT}`;
    productImg.src = url;
    setSelected(buttonEl);
  }

  // delegace kliků
  swatchesContainer.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.swatch');
    if (!btn) return;

    const color = btn.dataset.color;
    if (!color) return;

    setProductColor(color, btn);
  });

  // podpora klávesnice (Enter/Space na fokusu swatche)
  swatchesContainer.addEventListener('keydown', (ev) => {
    const btn = ev.target.closest('.swatch');
    if (!btn) return;
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      const color = btn.dataset.color;
      if (!color) return;
      setProductColor(color, btn);
    }
  });

  // inicializace: najdi .is-selected a přepni na něj, ať je vše v sync
  const initial = swatchesContainer.querySelector('.swatch.is-selected') || swatchesContainer.querySelector('.swatch');
  if (initial) {
    const color = initial.dataset.color || 'black';
    setProductColor(color, initial);
  }
})();
