// js/customizer/bgImagesChange.js
import { fromURL, setBgContain } from './helpers.js';


// Pomůcka: složí adresář (bez názvu souboru) z plné URL
function dirOf(url) {
  const i = url.lastIndexOf('/');
  return i >= 0 ? url.slice(0, i + 1) : '';
}

// načtení obrázků a bezpečné přenastavení pozadí (chráněné proti rychlému klikání)
export function bindBgImageSwatches(state, { stageEl, filePrefix = 'bag', ext = 'png' } = {}) {
  const frontInit = stageEl.dataset.frontBg;
  const sideInit  = stageEl.dataset.sideBg;

  const frontDir = dirOf(frontInit);
  const sideDir  = dirOf(sideInit);

  const colorWrap = document.getElementById('colorSwatches');
  const strapWrap = document.getElementById('strapSwatches');

  // startovní výběry (vezmi .is-selected, jinak první tlačítko)
  const pick = (wrap, attr) =>
    (wrap?.querySelector('.is-selected')?.getAttribute(attr)) ||
    (wrap?.querySelector(`[${attr}]`)?.getAttribute(attr)) || '';

  let bagColor   = pick(colorWrap, 'data-color');
  let strapColor = pick(strapWrap, 'data-strap');

  let lastReq = 0; // ochrana proti race condition

  async function updateBackgrounds() {
    const id = ++lastReq;

    const frontFile = `${filePrefix}_front_${strapColor}_${bagColor}.${ext}`;
    const sideFile  = `${filePrefix}_side_${strapColor}_${bagColor}.${ext}`;

    try {
      const [imgFront, imgSide] = await Promise.all([
        fromURL(frontDir + frontFile, { crossOrigin: 'anonymous' }),
        fromURL(sideDir  + sideFile,  { crossOrigin: 'anonymous' }),
      ]);
      if (id !== lastReq) return; // někdo klikl rychle znovu, zahodíme starý výsledek

      imgFront.set({ selectable: false, evented: false });
      imgSide.set({  selectable: false, evented: false });
      setBgContain(state.canvasFront, imgFront);
      setBgContain(state.canvasSide,  imgSide);
    } catch (e) {
      console.error('Nepodařilo se přepnout podklady:', e);
    }
  }

  function toggleSelected(container, btn) {
    container?.querySelectorAll('.is-selected')?.forEach(el => el.classList.remove('is-selected'));
    btn.classList.add('is-selected');
  }

  colorWrap?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-color]');
    if (!btn) return;
    bagColor = btn.getAttribute('data-color');
    toggleSelected(colorWrap, btn);
    updateBackgrounds();
  });

  strapWrap?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-strap]');
    if (!btn) return;
    strapColor = btn.getAttribute('data-strap');
    toggleSelected(strapWrap, btn);
    updateBackgrounds();
  });

  // inicializační sync (aby UI/obrázky souhlasily)
  updateBackgrounds();

  // volitelně vystavit do ladění
  state.colors = {
    get bag() { return bagColor; },
    get strap() { return strapColor; }
  };
}
