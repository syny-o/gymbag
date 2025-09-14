'use strict';

/**
 * Magnetická vodítka (snap) pro pozicování elementu při DRAGU.
 * - Globální funkce: window.enableSnapForElement(element, container, options)
 * - Cíle: levý/pravý/vrchní/spodní okraj + svislý/vodorovný střed kontejneru
 * - Zobrazuje jemné vodící čáry (inline styly, bez zásahu do CSS)
 * - Aktivuje se jen při držení samotného textu (ne při resize úchytech)
 */
(function exposeSnap(global){
  function enableSnapForElement(draggableElement, containerElement, options){
    if(!draggableElement || !containerElement) return;

    const cfg = Object.assign({ threshold: 8, showGuides: true }, options || {});

    // --- Vodítka (vizuální linie) -----------------------------------
    const guideV = document.createElement('div');
    const guideH = document.createElement('div');
    for (const g of [guideV, guideH]){
      g.style.position = 'absolute';
      g.style.zIndex = '1000';
      g.style.pointerEvents = 'none';
      g.style.display = 'none';
      g.style.background = 'rgba(110,168,254,0.9)'; // jemná modrá
      g.style.boxShadow = '0 0 0 1px rgba(255,255,255,0.2)';
    }
    guideV.style.top = '0';
    guideV.style.bottom = '0';
    guideV.style.width = '2px';

    guideH.style.left = '0';
    guideH.style.right = '0';
    guideH.style.height = '2px';

    // ujisti se, že container je position:relative (pokud není nastaven inline)
    containerElement.style.position = containerElement.style.position || 'relative';
    containerElement.appendChild(guideV);
    containerElement.appendChild(guideH);

    // --- Stav a utility ---------------------------------------------
    let isActiveDrag = false; // true jen když táhneme přímo text (ne úchyt)

    const toNumber = (px)=> px ? parseFloat(px) : 0;
    const clamp = (v, min, max)=> Math.max(min, Math.min(max, v));

    function hideGuides(){ guideV.style.display = 'none'; guideH.style.display = 'none'; }
    function showV(x){ if(!cfg.showGuides) return; guideV.style.left = x + 'px'; guideV.style.display = 'block'; }
    function showH(y){ if(!cfg.showGuides) return; guideH.style.top  = y + 'px'; guideH.style.display = 'block'; }

    function computeSnap(){
      const contW = containerElement.clientWidth;
      const contH = containerElement.clientHeight;
      const elW = draggableElement.offsetWidth;
      const elH = draggableElement.offsetHeight;

      const rect = draggableElement.getBoundingClientRect();
      const contRect = containerElement.getBoundingClientRect();
      let left = toNumber(draggableElement.style.left) || (rect.left - contRect.left);
      let top  = toNumber(draggableElement.style.top)  || (rect.top  - contRect.top);

      // kandidáti X: levá hrana, střed, pravá hrana
      const targetsX = [
        { kind:'left',   pos:left,         target:0,       set: ()=> 0,               guide:0 },
        { kind:'center', pos:left+elW/2,   target:contW/2, set: ()=> contW/2 - elW/2, guide:contW/2 },
        { kind:'right',  pos:left+elW,     target:contW,   set: ()=> contW - elW,     guide:contW }
      ];
      // kandidáti Y: horní hrana, střed, spodní hrana
      const targetsY = [
        { kind:'top',    pos:top,          target:0,       set: ()=> 0,               guide:0 },
        { kind:'middle', pos:top+elH/2,    target:contH/2, set: ()=> contH/2 - elH/2, guide:contH/2 },
        { kind:'bottom', pos:top+elH,      target:contH,   set: ()=> contH - elH,     guide:contH }
      ];

      // najdi nejlepší shodu pod prahem
      let bestX = null; let bestXDist = Infinity;
      for(const c of targetsX){
        const d = Math.abs(c.pos - c.target);
        if(d < bestXDist && d <= cfg.threshold){ bestX = c; bestXDist = d; }
      }
      let bestY = null; let bestYDist = Infinity;
      for(const c of targetsY){
        const d = Math.abs(c.pos - c.target);
        if(d < bestYDist && d <= cfg.threshold){ bestY = c; bestYDist = d; }
      }

      if(bestX){ left = bestX.set(); showV(bestX.guide); } else { guideV.style.display = 'none'; }
      if(bestY){ top  = bestY.set(); showH(bestY.guide); } else { guideH.style.display = 'none'; }

      // omez v rámci kontejneru
      left = clamp(left, 0, Math.max(0, contW - elW));
      top  = clamp(top,  0, Math.max(0, contH - elH));

      draggableElement.style.left = left + 'px';
      draggableElement.style.top  = top  + 'px';
    }

    // Aktivace pouze při držení samotného textu (ne úchytu rámu)
    function onPointerDown(e){
      if(e.target !== draggableElement) return;
      isActiveDrag = true;
    }
    function onPointerMove(){ if(isActiveDrag) computeSnap(); }
    function onPointerUp(){ isActiveDrag = false; hideGuides(); }

    // Bind
    draggableElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('resize', hideGuides);

    // Volitelný destroy
    return function destroy(){
      draggableElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', hideGuides);
      hideGuides();
      guideV.remove(); guideH.remove();
    };
  }

  global.enableSnapForElement = enableSnapForElement;
})(window);
