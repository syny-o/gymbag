'use strict';

/**
 * Globální funkce pro povolení přetahování libovolného elementu uvnitř kontejneru.
 * Nepoužívá moduly, jen přidá funkci na window, aby ji mohl volat app.js.
 *
 * @param {HTMLElement} draggableElement  - prvek, se kterým chceme hýbat
 * @param {HTMLElement} containerElement  - kontejner (hranice pohybu)
 */
(function exposeEnableDrag(global) {
  function enableDragForElement(draggableElement, containerElement) {
    if (!draggableElement || !containerElement) return;

    let isDragging = false;
    let startPointerX = 0;
    let startPointerY = 0;
    let startLeft = 0;
    let startTop = 0;

    function toNumber(px) {
      return px ? parseFloat(px) : 0;
    }

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function onPointerDown(event) {
      // jen levé tlačítko myši nebo primární dotyk
      if (event.button !== undefined && event.button !== 0) return;

      isDragging = true;
      draggableElement.setPointerCapture?.(event.pointerId);

      startPointerX = event.clientX;
      startPointerY = event.clientY;

      // pokud left/top nejsou nastavené, dopočítáme je z aktuální pozice
      const elemRect = draggableElement.getBoundingClientRect();
      const contRect = containerElement.getBoundingClientRect();

      const currentLeft = toNumber(draggableElement.style.left) || (elemRect.left - contRect.left);
      const currentTop  = toNumber(draggableElement.style.top)  || (elemRect.top  - contRect.top);

      startLeft = currentLeft;
      startTop  = currentTop;

      // během přetahování nevybírej text
      document.body.style.userSelect = 'none';
      event.preventDefault();
    }

    function onPointerMove(event) {
      if (!isDragging) return;

      const dx = event.clientX - startPointerX;
      const dy = event.clientY - startPointerY;

      // nové souřadnice
      let nextLeft = startLeft + dx;
      let nextTop  = startTop  + dy;

      // hranice pohybu: uvnitř containeru
      const maxLeft = containerElement.clientWidth  - draggableElement.offsetWidth;
      const maxTop  = containerElement.clientHeight - draggableElement.offsetHeight;

      nextLeft = clamp(nextLeft, 0, Math.max(0, maxLeft));
      nextTop  = clamp(nextTop,  0, Math.max(0, maxTop));

      draggableElement.style.left = `${nextLeft}px`;
      draggableElement.style.top  = `${nextTop}px`;
    }

    function onPointerUp(event) {
      if (!isDragging) return;
      isDragging = false;
      draggableElement.releasePointerCapture?.(event.pointerId);
      document.body.style.userSelect = '';
    }

    // kurzor „grab“ pro lepší UX
    draggableElement.style.cursor = 'grab';
    draggableElement.style.touchAction = 'none'; // <— přidej tenhle řádek kvuli mobilu

    // nasadíme posluchače
    draggableElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    // možnost pozdějšího odstranění (kdyby se hodilo)
    return function destroy() {
      draggableElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      document.body.style.userSelect = '';
    };
  }

  // zveřejníme do globálu
  global.enableDragForElement = enableDragForElement;
})(window);
