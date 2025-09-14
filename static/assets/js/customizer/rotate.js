'use strict';

/**
 * Rotace textu pomocí horního „diamant“ knobu (↻).
 * - API: window.enableRotateForElement(textElement, containerElement)
 * - Klik na text → zobraz knob nad textem; tažením mění úhel.
 * - Dvojklik na knob → reset na 0°.
 * - SINGLE-SELECTION: při výběru jiného objektu (image) knob OKAMŽITĚ odstraníme
 *   přes globální událost 'design:select'.
 */
(function exposeRotate(global){
  /**
   * @param {HTMLElement} textElement
   * @param {HTMLElement} containerElement
   */
  function enableRotateForElement(textElement, containerElement){
    if (!textElement || !containerElement) return;

    // --- Stav ---
    let rotateKnob = null;            // kontejner knobu (diamant)
    let isRotating = false;
    let centerScreen = { x: 0, y: 0 }; // střed prvku v obrazovkových souřadnicích
    let startAngleRad = 0;            // úhel ukazatele vůči centru na začátku (rad)
    let initialDeg = 0;               // výchozí úhel prvku (deg)
    let rafScheduled = false;         // throttle pro přepočet polohy knobu

    // --- Helpers ---
    const toDeg = (rad)=> rad * 180 / Math.PI;

    function getCurrentRotationDeg(){
      const v = parseFloat(textElement.dataset.rotateDeg || '0');
      return isFinite(v) ? v : 0;
    }
    function setCurrentRotationDeg(deg){
      textElement.dataset.rotateDeg = String(deg);
      // POZOR: text používá left/top pro pozici a font-size pro velikost,
      // takže transform zde smí měnit jen rotate (bez translate/scale).
      textElement.style.transform = `rotate(${deg}deg)`;
      // vyvoláme přepočty rámečků/observerů
      window.dispatchEvent(new Event('resize'));
    }

    function getRects(){
      return {
        el: textElement.getBoundingClientRect(),
        cont: containerElement.getBoundingClientRect(),
      };
    }

    function ensureKnob(){
      if (rotateKnob) return rotateKnob;

      // Kontejner (diamant)
      const k = document.createElement('div');
      Object.assign(k.style, {
        position: 'absolute',
        width: '22px',
        height: '22px',
        transform: 'rotate(45deg)',      // čtverec → diamant
        borderRadius: '6px',
        border: '2px solid var(--accent, #6ea8fe)',
        background: 'rgba(14,20,45,0.6)',
        boxShadow: '0 2px 10px rgba(0,0,0,.35)',
        pointerEvents: 'auto',
        cursor: 'grab',
        zIndex: '1001',
        touchAction : 'none',
      });

      // Vnitřní ikona ↻ (od-rotujeme ji zpět, aby byla svislá)
      const icon = document.createElement('span');
      icon.textContent = '↻';
      Object.assign(icon.style, {
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%) rotate(-45deg)',
        fontSize: '12px',
        lineHeight: '1',
        color: 'var(--accent, #6ea8fe)',
        userSelect: 'none',
        pointerEvents: 'none',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontWeight: '700',
      });
      k.appendChild(icon);

      // interakce
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
      const knobOffset = 34; // kolik px nad horním okrajem
      const x = (el.left - cont.left) + el.width / 2 - 11; // 11 = half of 22px
      const y = (el.top  - cont.top)  - knobOffset - 11;
      rotateKnob.style.left = `${x}px`;
      rotateKnob.style.top  = `${y}px`;
    }

    function scheduleReposition(){
      if (!rotateKnob) return;
      if (rafScheduled) return;
      rafScheduled = true;
      requestAnimationFrame(()=>{
        positionKnob();
        rafScheduled = false;
      });
    }

    // --- Rotace interakce ---
    function onKnobPointerDown(ev){
      ev.preventDefault();
      ev.stopPropagation(); // ať to neodchytí drag/resize

      isRotating = true;
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

      // udržuj v intervalu [-180, 180)
      if (nextDeg >= 180) nextDeg -= 360;
      if (nextDeg <  -180) nextDeg += 360;

      setCurrentRotationDeg(nextDeg);
      scheduleReposition(); // knob zůstane nad prvkem
    }

    function onKnobPointerUp(ev){
      isRotating = false;
      rotateKnob?.releasePointerCapture?.(ev.pointerId);
      rotateKnob && (rotateKnob.style.cursor = 'grab');
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

    // --- Výběr (klik na text) / zrušení ---
    function onTextPointerDown(){
      ensureKnob();           // vytvoř a ukaž
      positionKnob();
      // volitelně můžeme oznámit, že „text je aktivní“, ale resize modul už hlásí 'text'
      window.dispatchEvent(new CustomEvent('design:select', { detail: { kind: 'text' } }));
    }

    function onGlobalPointerDown(ev){
      const t = ev.target;
      if (t === textElement) return;                   // klik na text → ponech
      if (rotateKnob && (t === rotateKnob || rotateKnob.contains(t))) return; // klik na knob → ponech
      removeKnob();                                    // klik mimo → pryč
    }

    // --- SLUCH NA GLOBÁLNÍ SELECTION BUS -----------------------------
    // Když kdokoli vybere „image“ (nebo cokoli != 'text'), knob musí pryč,
    // i kdyby jiný modul stopnul propagaci pointerdownu.
    window.addEventListener('design:select', (e)=>{
      const kind = e?.detail?.kind;
      if (kind !== 'text') removeKnob();
    });

    // --- Bind / Unbind ---
    function bind(){
      textElement.addEventListener('pointerdown', onTextPointerDown);
      document.addEventListener('pointerdown', onGlobalPointerDown);
      window.addEventListener('resize', scheduleReposition);
      window.addEventListener('pointermove', scheduleReposition); // při dragu/resize se text hýbe → knob se přepočítá
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
