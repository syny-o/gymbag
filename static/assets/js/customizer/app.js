'use strict';

/**
 * One-text customizer + drag (bez modulů)
 * - Vždy jeden text.
 * - Zobrazení/aktualizace při psaní do inputu.
 * - NOVĚ: text je vkládán a omezován do #designArea.
 */

/** @typedef {{ productElement: HTMLElement, designAreaElement: HTMLElement, textInputElement: HTMLInputElement }} Refs */
/** @typedef {{ textElement: HTMLElement | null, hasPlacedOnce: boolean }} State */

const SELECTORS = {
  productElement:   '#product',
  designAreaElement:'#designArea',
  textInputElement: '#presetText',
};

/** @type {Refs} */
const refs = { productElement: null, designAreaElement: null, textInputElement: null };
/** @type {State} */
const state = { textElement: null, hasPlacedOnce: false };

function captureDOMReferences() {
  refs.productElement    = /** @type {HTMLElement} */ (document.querySelector(SELECTORS.productElement));
  refs.designAreaElement = /** @type {HTMLElement} */ (document.querySelector(SELECTORS.designAreaElement));
  refs.textInputElement  = /** @type {HTMLInputElement} */ (document.querySelector(SELECTORS.textInputElement));
  if (!refs.productElement || !refs.designAreaElement || !refs.textInputElement) {
    throw new Error('Chybí #product nebo #designArea nebo #presetText.');
  }
}

function createTextElement() {
  const element = document.createElement('div');
  element.className = 'text-node';
  element.id = 'designText';
  element.style.position = 'absolute';
  element.style.display = 'none'; // dokud není co zobrazit
  element.style.left = '0px';     // výchozí
  element.style.top  = '0px';     // výchozí

  // VLOŽ do OBLASTI POTISKU
  refs.designAreaElement.appendChild(element);
  state.textElement = element;

  // Drag vůči designArea
  if (typeof window.enableDragForElement === 'function') {
    window.enableDragForElement(element, refs.designAreaElement);
  }
  // Rámeček + resize (pravý-dolní) vůči designArea
  if (typeof window.enableResizeForElement === 'function') {
    window.enableResizeForElement(element, refs.designAreaElement);
  }
  // Snap (okraje/středy designArea)
  if (typeof window.enableSnapForElement === 'function') {
    window.enableSnapForElement(element, refs.designAreaElement, { threshold: 10 });
  }
  // Rotate (horní knob) – nic nemění, ale polohuje se k textu
  if (typeof window.enableRotateForElement === 'function') {
    window.enableRotateForElement(element, refs.designAreaElement);
  }

  return element;
}

function getTextElement() { return state.textElement ?? createTextElement(); }
function setTextElementContent(element, text) { element.textContent = text; }
function showElement(element) { element.style.display = 'block'; }
function hideElement(element) { element.style.display = 'none'; }

function centerElementInContainer(element, container) {
  const wasHidden = element.style.display === 'none';
  if (wasHidden) element.style.display = 'block';

  const containerWidth  = container.clientWidth;
  const containerHeight = container.clientHeight;
  const elementWidth    = element.offsetWidth;
  const elementHeight   = element.offsetHeight;

  const leftPx = Math.max(0, (containerWidth  - elementWidth ) / 2);
  const topPx  = Math.max(0, (containerHeight - elementHeight) / 2);

  element.style.left = `${leftPx}px`;
  element.style.top  = `${topPx}px`;

  if (wasHidden) element.style.display = 'none';
}

function getTextInputValue() { return refs.textInputElement.value; }

function render() {
  const value = getTextInputValue().trim();
  const element = getTextElement();

  if (value) {
    setTextElementContent(element, value);

    // první zobrazení → vycentruj do designArea
    if (!state.hasPlacedOnce) {
      showElement(element);
      centerElementInContainer(element, refs.designAreaElement);
      state.hasPlacedOnce = true;
    }

    showElement(element);
  } else {
    hideElement(element);
    state.hasPlacedOnce = false; // až znovu začne psát, znovu vycentrujeme
  }
}

function bindEventListeners() {
  refs.textInputElement.addEventListener('input', render);
}

function init() {
  captureDOMReferences();
  getTextElement();     // připrav element (kvůli drag listenerům)
  bindEventListeners();
  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
