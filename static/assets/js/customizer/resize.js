'use strict';

/**
 * Výběrový rámeček + JEDEN rohový resize (pravý-dolní) s ukotvením k levému-hornímu rohu.
 * - API: window.enableResizeForElement(textElement, containerElement)
 * - Single-selection: při výběru jiného objektu (image) rám textu kompletně odstraníme.
 */
(function exposeResize(global) {
  function enableResizeForElement(textElement, containerElement) {
    if (!textElement || !containerElement) return;

    let selectionFrame = null;
    let isResizing = false;

    // počáteční stav
    let startFontSize = 0;
    let startRect = { left: 0, top: 0, width: 0, height: 0 };
    let pivot = { x: 0, y: 0 };
    let initialDistance = 1;

    const MIN_SCALE = 0.3;
    const MAX_SCALE = 6;

    // --- selection bus ---
    function broadcastSelection(kind) {
      window.dispatchEvent(new CustomEvent('design:select', { detail: { kind } }));
    }
    window.addEventListener('design:select', (e) => {
      const kind = e?.detail?.kind;
      if (kind !== 'text') removeSelectionFrame(); // ← plné odstranění
    });

    // Helpers
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const contRect = () => containerElement.getBoundingClientRect();
    const elRect   = () => textElement.getBoundingClientRect();

    function drawSelectionFrame() {
      if (!selectionFrame) return;
      const er = elRect();
      const pr = contRect();
      const pad = 8;
      selectionFrame.style.position = 'absolute';
      selectionFrame.style.left   = (er.left - pr.left - pad) + 'px';
      selectionFrame.style.top    = (er.top  - pr.top  - pad) + 'px';
      selectionFrame.style.width  = (er.width  + pad * 2) + 'px';
      selectionFrame.style.height = (er.height + pad * 2) + 'px';
      selectionFrame.style.pointerEvents = 'none';
      selectionFrame.style.zIndex = '999';
    }

    function removeSelectionFrame() {
      if (selectionFrame) {
        selectionFrame.remove();
        selectionFrame = null;
      }
    }

    function createSelectionFrame() {
      removeSelectionFrame();

      const frame = document.createElement('div');
      frame.className = 'frame';
      frame.dataset.owner = 'text';

      // jediný úchyt: pravý-dolní (resize)
      const se = document.createElement('div');
      se.className = 'handle resize';
      se.dataset.corner = 'se';
      se.style.pointerEvents = 'auto';
      se.style.cursor = 'nwse-resize';
      se.style.touchAction = 'none';
      se.style.right  = '-12px';
      se.style.bottom = '-12px';
      se.title = 'Změnit velikost (táhni)';
      se.setAttribute('aria-label', 'Změnit velikost');
      se.addEventListener('pointerdown', onHandlePointerDown);

      frame.appendChild(se);
      containerElement.appendChild(frame);
      selectionFrame = frame;
      drawSelectionFrame();
    }

    function showSelection() {
      if (!selectionFrame) createSelectionFrame();
      drawSelectionFrame();
    }

    // sync při změnách
    let rafScheduled = false;
    function scheduleRedraw() {
      if (!selectionFrame) return;
      if (rafScheduled) return;
      rafScheduled = true;
      requestAnimationFrame(() => {
        drawSelectionFrame();
        rafScheduled = false;
      });
    }

    // --- Resize interakce ---
    function onHandlePointerDown(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.button !== undefined && ev.button !== 0) return;

      startFontSize = parseFloat(getComputedStyle(textElement).fontSize) || 16;

      const r  = elRect();
      const pr = contRect();
      startRect = { left: r.left - pr.left, top: r.top - pr.top, width: r.width, height: r.height };

      // pivot = levý-horní roh
      pivot = { x: startRect.left, y: startRect.top };

      const pivotScreen = { x: pr.left + pivot.x, y: pr.top + pivot.y };
      initialDistance = Math.hypot(ev.clientX - pivotScreen.x, ev.clientY - pivotScreen.y) || 1;

      isResizing = true;
      document.body.style.userSelect = 'none';
      document.documentElement.style.cursor = /** @type HTMLElement */(ev.currentTarget).style.cursor || 'nwse-resize';

      window.addEventListener('pointermove', onHandlePointerMove);
      window.addEventListener('pointerup', onHandlePointerUp, { once: true });
    }

    function onHandlePointerMove(ev) {
      if (!isResizing) return;

      const pr = contRect();
      const pivotScreen = { x: pr.left + pivot.x, y: pr.top + pivot.y };
      const dist  = Math.hypot(ev.clientX - pivotScreen.x, ev.clientY - pivotScreen.y);
      const scale = clamp(dist / initialDistance, MIN_SCALE, MAX_SCALE);

      const newWidth    = startRect.width  * scale;
      const newHeight   = startRect.height * scale;
      const newFontSize = startFontSize    * scale;

      let newLeft = pivot.x;
      let newTop  = pivot.y;

      const maxLeft = Math.max(0, containerElement.clientWidth  - newWidth);
      const maxTop  = Math.max(0, containerElement.clientHeight - newHeight);
      newLeft = clamp(newLeft, 0, maxLeft);
      newTop  = clamp(newTop,  0, maxTop);

      textElement.style.fontSize = `${newFontSize}px`;
      textElement.style.left = `${newLeft}px`;
      textElement.style.top  = `${newTop}px`;

      scheduleRedraw();
      window.dispatchEvent(new Event('resize')); // pro sync slideru apod.
    }

    function onHandlePointerUp() {
      isResizing = false;
      document.body.style.userSelect = '';
      document.documentElement.style.cursor = '';
      window.removeEventListener('pointermove', onHandlePointerMove);
      scheduleRedraw();
    }

    // --- Výběr/skrývání ---
    function onTextPointerDown() {
      showSelection();
      broadcastSelection('text'); // oznámíme „vybral jsem text“
    }
    function onGlobalPointerDown(ev) {
      const t = ev.target;
      if (t === textElement) return;
      if (selectionFrame && (selectionFrame === t || selectionFrame.contains(t))) return;
      removeSelectionFrame(); // ← plné odstranění při kliku mimo
    }

    // --- Bind / Unbind ---
    function bind() {
      textElement.addEventListener('pointerdown', onTextPointerDown);
      document.addEventListener('pointerdown', onGlobalPointerDown);
      window.addEventListener('resize', scheduleRedraw);
      window.addEventListener('pointermove', scheduleRedraw);
    }
    function unbind() {
      textElement.removeEventListener('pointerdown', onTextPointerDown);
      document.removeEventListener('pointerdown', onGlobalPointerDown);
      window.removeEventListener('resize', scheduleRedraw);
      window.removeEventListener('pointermove', scheduleRedraw);
      removeSelectionFrame();
    }

    bind();
    return { destroy: unbind };
  }

  global.enableResizeForElement = enableResizeForElement;
})(window);
