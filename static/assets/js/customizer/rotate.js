'use strict';

/**
 * Rotace textu pomocí horního „diamant“ knobu (↻) – styl z CSS.
 * - API: window.enableRotateForElement(textElement, containerElement)
 * - Klik na text → zobraz knob nad textem; tažením mění úhel.
 * - Dvojklik na knob → reset na 0°.
 * - SINGLE-SELECTION: při výběru jiného objektu (image) knob odstraníme ('design:select').
 */
(function exposeRotate(global){
  function enableRotateForElement(textElement, containerElement){
    if (!textElement || !containerElement) return;

    // --- Stav ---
    let rotateKnob = null;
    let isRotating = false;
    let centerScreen = { x: 0, y: 0 };
    let startAngleRad = 0;
    let initialDeg = 0;
    let rafScheduled = false;

    // --- Helpers ---
    const toDeg = (rad)=> rad * 180 / Math.PI;

    function getCurrentRotationDeg(){
      const v = parseFloat(textElement.dataset.rotateDeg || '0');
      return isFinite(v) ? v : 0;
    }
    function setCurrentRotationDeg(deg){
      textElement.dataset.rotateDeg = String(deg);
      textElement.style.transform = `rotate(${deg}deg)`;  // text používá left/top + font-size, rotaci aplikujeme samostatně
      window.dispatchEvent(new Event('resize'));          // ať si ostatní (rámy) přepočítají pozice
    }

    function getRects(){
      return {
        el: textElement.getBoundingClientRect(),
        cont: containerElement.getBoundingClientRect(),
      };
    }

    function ensureKnob(){
      if (rotateKnob) return rotateKnob;

      const k = document.createElement('div');
      // VZHLED z CSS: .handle.rotate (+ varianta .is-floating)
      k.className = 'handle rotate is-floating';
      k.style.position = 'absolute';      // pozici (left/top) řídí JS
      k.style.zIndex = '1001';
      k.style.pointerEvents = 'auto';

      k.addEventListener('pointerdown', onKnobPointerDown);
      k.addEventListener('dblclick', onKnobDoubleClick);

      containerElement.appendChild(k);
      rotateKnob = k;
      positionKnob();
      return k;
    }

    function removeKnob(){
      if (!rotateKnob) return;
      rotateKnob.removeEventListener('pointerdown', onKnobPointerDown);
      rotateKnob.removeEventListener('dblclick', onKnobDoubleClick);
      rotateKnob.remove();
      rotateKnob = null;
    }

    function positionKnob(){
      if (!rotateKnob) return;
      const { el, cont } = getRects();
      const knobOffset = 34; // px nad horním okrajem textu
      const sizeHalf = 11;   // 22px / 2 (rozměr z CSS)
      const x = (el.left - cont.left) + el.width / 2 - sizeHalf;
      const y = (el.top  - cont.top)  - knobOffset - sizeHalf;
      rotateKnob.style.left = `${x}px`;
      rotateKnob.style.top  = `${y}px`;
    }

    function scheduleReposition(){
      if (!rotateKnob || rafScheduled) return;
      rafScheduled = true;
      requestAnimationFrame(()=>{
        positionKnob();
        rafScheduled = false;
      });
    }

    // --- Rotace interakce ---
    function onKnobPointerDown(ev){
      ev.preventDefault();
      ev.stopPropagation();

      isRotating = true;
      rotateKnob.classList.add('is-grabbing');
      rotateKnob.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';

      const { el } = getRects();
      centerScreen = { x: el.left + el.width/2, y: el.top + el.height/2 };

      startAngleRad = Math.atan2(ev.clientY - centerScreen.y, ev.clientX - centerScreen.x);
      initialDeg = getCurrentRotationDeg();

      window.addEventListener('pointermove', onKnobPointerMove);
      window.addEventListener('pointerup', onKnobPointerUp, { once: true });
      rotateKnob.setPointerCapture?.(ev.pointerId);
    }

    function onKnobPointerMove(ev){
      if (!isRotating) return;
      const currentRad = Math.atan2(ev.clientY - centerScreen.y, ev.clientX - centerScreen.x);
      const deltaDeg = toDeg(currentRad - startAngleRad);
      let nextDeg = initialDeg + deltaDeg;

      if (nextDeg >= 180) nextDeg -= 360;
      if (nextDeg <  -180) nextDeg += 360;

      setCurrentRotationDeg(nextDeg);
      scheduleReposition();
    }

    function onKnobPointerUp(ev){
      isRotating = false;
      rotateKnob?.releasePointerCapture?.(ev.pointerId);
      rotateKnob && (rotateKnob.style.cursor = 'grab');
      rotateKnob?.classList.remove('is-grabbing');
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', onKnobPointerMove);
      scheduleReposition();
    }

    // --- Dvojklik = reset rotace na 0° ---
    function onKnobDoubleClick(ev){
      ev.preventDefault();
      ev.stopPropagation();
      setCurrentRotationDeg(0);
      scheduleReposition();
    }

    // --- Výběr / zrušení ---
    function onTextPointerDown(){
      ensureKnob();
      positionKnob();
      window.dispatchEvent(new CustomEvent('design:select', { detail: { kind: 'text' } }));
    }

    function onGlobalPointerDown(ev){
      const t = ev.target;
      if (t === textElement) return;
      if (rotateKnob && (t === rotateKnob || rotateKnob.contains(t))) return;
      removeKnob();
    }

    // Když je vybrán jiný objekt (image apod.), knob pryč.
    window.addEventListener('design:select', (e)=>{
      const kind = e?.detail?.kind;
      if (kind !== 'text') removeKnob();
    });

    // --- Bind / Unbind ---
    function bind(){
      textElement.addEventListener('pointerdown', onTextPointerDown);
      document.addEventListener('pointerdown', onGlobalPointerDown);
      window.addEventListener('resize', scheduleReposition);
      window.addEventListener('pointermove', scheduleReposition);
    }
    function unbind(){
      textElement.removeEventListener('pointerdown', onTextPointerDown);
      document.removeEventListener('pointerdown', onGlobalPointerDown);
      window.removeEventListener('resize', scheduleReposition);
      window.removeEventListener('pointermove', scheduleReposition);
      removeKnob();
    }

    bind();
    return { destroy: unbind };
  }

  global.enableRotateForElement = enableRotateForElement;
})(window);
