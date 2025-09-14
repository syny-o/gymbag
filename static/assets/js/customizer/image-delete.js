'use strict';

/**
 * image-delete.js
 * Tlačítko „Smazat obrázek“:
 * - smaže #designImage
 * - odstraní rám (.frame[data-owner="image"])
 * - vynuluje #productFile
 * - vypne tlačítko, když obrázek není
 * - vyšle události pro přepočty UI
 */

(function initImageDelete() {
  const SELECTORS = {
    product: '#product',
    image:   '#designImage',
    deleteBtn: '#deleteImageBtn',
    file: '#productFile',
  };

  const productEl  = document.querySelector(SELECTORS.product);
  const deleteBtn  = /** @type {HTMLButtonElement|null} */ (document.querySelector(SELECTORS.deleteBtn));
  const fileInput  = /** @type {HTMLInputElement|null} */ (document.querySelector(SELECTORS.file));

  if (!productEl || !deleteBtn) return;

  const getImage = () => /** @type {HTMLImageElement|null} */ (document.querySelector(SELECTORS.image));

  function updateButtonState() {
    deleteBtn.disabled = !getImage();
  }

  function removeImage() {
    const img = getImage();
    if (!img) return;

    // 1) smaž samotný obrázek
    img.remove();

    // 2) ukliď rám obrázku (kdyby byl zobrazen)
    document.querySelectorAll('.frame').forEach(f => {
      if (/** @type {HTMLElement} */(f).dataset.owner === 'image') f.remove();
    });

    // 3) vynuluj file input (ať jde nahrát stejný soubor znovu)
    if (fileInput) fileInput.value = '';

    // 4) „prošťouchni“ UI – přepočty rámečků/sliderů apod.
    window.dispatchEvent(new CustomEvent('design:select', { detail: { kind: 'none' } }));
    window.dispatchEvent(new Event('resize'));

    // 5) log
    console.log('Obrázek byl smazán.');

    // 6) stav tlačítka
    updateButtonState();
  }

  deleteBtn.addEventListener('click', removeImage);

  // Sledování změn v #product (přidání/odebrání #designImage) → enable/disable tlačítka
  const mo = new MutationObserver(updateButtonState);
  mo.observe(productEl, { childList: true, subtree: true });

  // inicializace
  updateButtonState();
})();
