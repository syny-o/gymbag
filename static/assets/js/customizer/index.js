import { initCanvases, setupView, makeSwitcher } from "./views.js";
import { bindBgImageSwatches } from "./bgImagesChange.js";

document.addEventListener("DOMContentLoaded", async () => {
  const stageEl = document.querySelector(".stage");

  // 1) Init dvou pláten
  const state = initCanvases();

  // 2) Pozadí a tiskové oblasti
  await setupView(state.canvasFront, {
    bgUrl: stageEl.dataset.frontBg,
    area: { x: 280, y: 200, w: 210, h: 230 },
  });
  await setupView(state.canvasSide, {
    bgUrl: stageEl.dataset.sideBg,
    area: { x: 180, y: 210, w: 410, h: 220 },
  });

  // 3) Přepínač
  const switchTo = makeSwitcher(state);
  document
    .querySelector('[data-view="front"]')
    .addEventListener("click", () => switchTo("front"));
  document
    .querySelector('[data-view="side"]')
    .addEventListener("click", () => switchTo("side"));

  // >>> napojení na přepínání podkladů podle barev
  bindBgImageSwatches(state, { stageEl, filePrefix: "bag", ext: "png" });

  // 4) Responsivita – uvnitř, aby viděla na `state`
  const BASE_W = 800,
    BASE_H = 500;
  const debounce = (fn, ms = 120) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };

  function resize() {
    const available = stageEl.clientWidth || BASE_W;
    const s = Math.min(1, available / BASE_W); // škálujeme dolů (kvůli ostrosti)
    const w = Math.round(BASE_W * s);
    const h = Math.round(BASE_H * s);

    [state.canvasFront, state.canvasSide].forEach((c) => {
      c.setDimensions({ width: w, height: h }); // reálná kreslící plocha
      c.setViewportTransform([s, 0, 0, s, 0, 0]); // zoom
      c.backgroundVpt = true; // zoomuje i pozadí
      c.requestRenderAll();
    });

    stageEl.style.height = h + "px"; // výška wrapperu
  }

  resize();
  window.addEventListener("resize", debounce(resize, 120));

  // 5) Pro ladění v konzoli
  window.customizer = { ...state, switchTo, resize };
});
