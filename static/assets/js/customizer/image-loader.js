'use strict';

/**
 * image-loader.js
 *
 * Vloží JEDEN překryvný obrázek na plátno přes input#productFile:
 *  - vycentrovaný na #product,
 *  - udržuje průhlednost PNG,
 *  - opakovaný výběr souboru obrázek nahradí (nevrství).
 *
 * Nezasahuje do stávající logiky textu (typography.js).
 * Pokud máš vlastní drag/resize rám, můžeš ho později napojit i na tento element.
 */
(function initOverlayImageLoader() {
  // --- Refs ----------------------------------------------------------
  /** @type {HTMLElement|null} */
  const productElement   = document.querySelector('#product');
  /** @type {HTMLInputElement|null} */
  const productFileInput = document.querySelector('#productFile');

  if (!productElement || !productFileInput) return;

  // Budeme držet poslední vytvořený objectURL kvůli revoke
  let lastObjectURL = null;

  /**
   * Vrátí existující overlay <img id="designImage">, nebo null.
   * @returns {HTMLImageElement|null}
   */
  function getOverlayImage() {
    return /** @type {HTMLImageElement|null} */ (document.getElementById('designImage'));
  }

  /**
   * Vytvoří (pokud není) overlay image a vrátí ho.
   * @returns {HTMLImageElement}
   */
  function ensureOverlayImage() {
    let img = getOverlayImage();
    if (img) return img;

    img = document.createElement('img');
    img.id = 'designImage';
    img.alt = 'Design obrázek';
    // Základní umístění a rozumné limity (bez zásahu do tvého CSS)
    img.style.position = 'absolute';
    img.style.left = '50%';
    img.style.top = '50%';
    img.style.transform = 'translate(-50%, -50%)'; // centrování
    img.style.maxWidth = '90%';
    img.style.maxHeight = '90%';
    img.style.width = '20%';     // výchozí šířka (můžeš upravit)
    img.style.height = 'auto';
    img.style.zIndex = '4';      // text může být nad (např. zIndex 5), podklad produktu zůstává pod
    img.style.pointerEvents = 'auto'; // případné budoucí drag/resize

    productElement.appendChild(img);
    return img;
  }

  /**
   * Nastaví <img> src z objectURL a po načtení předchozí URL uvolní.
   * @param {HTMLImageElement} img
   * @param {string} objectURL
   */
  function setImageSrc(img, objectURL) {
    // Uvolníme starou URL až po načtení nové (ať nebliká)
    img.onload = () => {
      if (lastObjectURL && lastObjectURL !== objectURL) {
        URL.revokeObjectURL(lastObjectURL);
      }
      lastObjectURL = objectURL;
    };
    img.onerror = () => {
      // Při chybě zdroj uvolníme a obrazek skryjeme
      if (lastObjectURL && lastObjectURL !== objectURL) {
        URL.revokeObjectURL(lastObjectURL);
      }
      console.error('Obrázek se nepodařilo načíst.');
      img.style.display = 'none';
    };
    img.style.display = 'block';
    img.src = objectURL;
  }

  /**
   * Zpracuje vybraný soubor a zobrazí ho jako overlay obrázek.
   * @param {File} file
   */
  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const img = ensureOverlayImage();
    setImageSrc(img, url);
  }

  // --- Events --------------------------------------------------------
  productFileInput.addEventListener('change', () => {
    const file = productFileInput.files && productFileInput.files[0];
    if (file) handleFile(file);
  });

  // Volitelně: pokud chceš umožnit odstranění obrázku vyprázdněním inputu:
  // (Toto se spustí jen pokud input umožní "smazat" volbu; většina prohlížečů vrací files=null jen při změně)
  productFileInput.addEventListener('input', () => {
    const hasFile = !!(productFileInput.files && productFileInput.files[0]);
    if (!hasFile) {
      const img = getOverlayImage();
      if (img) img.remove();
      if (lastObjectURL) {
        URL.revokeObjectURL(lastObjectURL);
        lastObjectURL = null;
      }
    }
  });

  // Úklid při odchodu ze stránky
  window.addEventListener('beforeunload', () => {
    if (lastObjectURL) URL.revokeObjectURL(lastObjectURL);
  });
})();
