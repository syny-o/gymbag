// js/customizer/views.js
import { fromURL, setBgContain, ensureWrapOverlay, makePrintFrame, makeDesignLayer } from './helpers.js';

export function initCanvases() {
  const canvasFront = new fabric.Canvas('canvasFront', { preserveObjectStacking: true });
  const canvasSide  = new fabric.Canvas('canvasSide',  { preserveObjectStacking: true });

  const frontWrap = ensureWrapOverlay(canvasFront);
  const sideWrap  = ensureWrapOverlay(canvasSide);

  sideWrap.classList.add('is-hidden'); // start na "Předek"

  return {
    canvasFront,
    canvasSide,
    frontWrap,
    sideWrap,
    activeCanvas: canvasFront,
    active: 'front',
  };
}

export async function setupView(canvas, { bgUrl, area }) {
  const img = await fromURL(bgUrl, { crossOrigin: 'anonymous' });
  img.set({ selectable: false, evented: false });
  setBgContain(canvas, img);

  const frame = makePrintFrame(area);
  canvas.add(frame);

  const designLayer = makeDesignLayer(area);
  canvas.add(designLayer);

  canvas.designLayer = designLayer;
  canvas.printArea   = { ...area };
  canvas.requestRenderAll();
}

export function makeSwitcher(state) {
  return function switchTo(view) {
    if (view === state.active) return;

    state.canvasFront.discardActiveObject().requestRenderAll();
    state.canvasSide.discardActiveObject().requestRenderAll();

    if (view === 'front') {
      state.frontWrap.classList.remove('is-hidden');
      state.sideWrap.classList.add('is-hidden');
      state.activeCanvas = state.canvasFront;
    } else {
      state.sideWrap.classList.remove('is-hidden');
      state.frontWrap.classList.add('is-hidden');
      state.activeCanvas = state.canvasSide;
    }
    state.active = view;
    state.activeCanvas.requestRenderAll();
  };
}
