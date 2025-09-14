'use strict';

/**
 * image-transform.js (scale-aware, performant)
 *
 * - Výběr/rámeček až po kliku, klik mimo = zrušení. Esc také zruší.
 * - Drag/resize/rotate obrázku, snap/clamp vůči #designArea (existuje-li), jinak #product.
 * - RÁM: jeden persistentní element, jen aktualizujeme jeho box (RAF throttling).
 * - SCALE-AWARE: přepočty přes měřítko rodičů (transform:scale apod.), takže rám nesjíždí.
 * - Mobil: během interakce vypínáme scroll (touch-action/overscroll-behavior + pointer capture).
 */

(function initImageTransform() {
  const SELECTORS = { product:'#product', bounds:'#designArea', image:'#designImage' };
  const SNAP_THRESHOLD = 10; // px
  const MIN_SCALE = 0.1;
  const MAX_SCALE = 2.0;

  // --- scroll guard pro mobil ---------------------------------------
  let __scrollGuardPrev = null;
  function disablePageScroll(){
    if (__scrollGuardPrev) return;
    const html = document.documentElement;
    __scrollGuardPrev = {
      touchAction: html.style.touchAction,
      overscrollBehavior: html.style.overscrollBehavior
    };
    html.style.touchAction = 'none';
    html.style.overscrollBehavior = 'none';
  }
  function restorePageScroll(){
    if (!__scrollGuardPrev) return;
    const html = document.documentElement;
    html.style.touchAction = __scrollGuardPrev.touchAction || '';
    html.style.overscrollBehavior = __scrollGuardPrev.overscrollBehavior || '';
    __scrollGuardPrev = null;
  }

  // --- refs ----------------------------------------------------------
  const productElement = document.querySelector(SELECTORS.product);
  if (!productElement) return;
  const boundsElement = /** @type {HTMLElement} */ (
    document.querySelector(SELECTORS.bounds) || productElement
  );

  // --- helpers: scale & rects (viewport → CSS px kontejneru) ---------
  function getScale(el){
    const r = el.getBoundingClientRect();
    const sx = r.width  / (el.clientWidth  || r.width  || 1);
    const sy = r.height / (el.clientHeight || r.height || 1);
    return { sx: (sx || 1), sy: (sy || 1) };
  }
  function getRectViewport(el){ return el.getBoundingClientRect(); }
  function v2cX(xViewport, container){ const s = getScale(container); return xViewport / s.sx; }
  function v2cY(yViewport, container){ const s = getScale(container); return yViewport / s.sy; }

  // --- state ---------------------------------------------------------
  let frameEl = null; let hResize = null; let hRotate = null;
  let selectedImg = null;

  // --- bus: single selection ----------------------------------------
  function broadcastSelection(kind){ window.dispatchEvent(new CustomEvent('design:select', { detail:{ kind } })); }
  window.addEventListener('design:select', e => { if (e?.detail?.kind !== 'image') deselect(); });

  // --- data attrs & transform ---------------------------------------
  function ensureDataAttrs(img){
    if (!img.dataset.x)     img.dataset.x = '0';
    if (!img.dataset.y)     img.dataset.y = '0';
    if (!img.dataset.scale) img.dataset.scale = '1';
    if (!img.dataset.rot)   img.dataset.rot = '0';
  }
  function applyTransform(img){
    const x = +img.dataset.x || 0;
    const y = +img.dataset.y || 0;
    const s = +img.dataset.scale || 1;
    const r = +img.dataset.rot || 0;
    img.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${r}deg) scale(${s})`;
    img.style.zIndex = '1'; // pod textem
  }

  // --- SNAP vodítka (v boundsElement CSS px) -------------------------
  let guideV = null, guideH = null;
  function ensureGuides(){
    if (!boundsElement.style.position) boundsElement.style.position = 'relative';
    if (guideV && guideH) return;
    guideV = document.createElement('div');
    guideH = document.createElement('div');
    for (const g of [guideV, guideH]){
      Object.assign(g.style, {
        position:'absolute', zIndex:'1000', pointerEvents:'none',
        display:'none', background:'rgba(110,168,254,0.9)',
        boxShadow:'0 0 0 1px rgba(255,255,255,0.2)', transition:'none'
      });
    }
    guideV.style.top = '0'; guideV.style.bottom = '0'; guideV.style.width = '2px';
    guideH.style.left = '0'; guideH.style.right = '0'; guideH.style.height = '2px';
    boundsElement.appendChild(guideV); boundsElement.appendChild(guideH);
  }
  const showV = x => { ensureGuides(); guideV.style.left = x + 'px'; guideV.style.display = 'block'; };
  const showH = y => { ensureGuides(); guideH.style.top  = y + 'px'; guideH.style.display = 'block'; };
  const hideGuides = () => { if (guideV) guideV.style.display='none'; if (guideH) guideH.style.display='none'; };

  // snap/clamp v **CSS px boundsElementu**
  function snapImagePosition(img){
    const br = getRectViewport(boundsElement);
    const contW = boundsElement.clientWidth;
    const contH = boundsElement.clientHeight;
    const rect = img.getBoundingClientRect();

    // převedeme viewport → CSS px bounds
    const left   = v2cX(rect.left  - br.left, boundsElement);
    const top    = v2cY(rect.top   - br.top , boundsElement);
    const width  = v2cX(rect.width,  boundsElement);
    const height = v2cY(rect.height, boundsElement);
    const right  = left + width;
    const bottom = top  + height;
    const midX   = left + width/2;
    const midY   = top  + height/2;

    const candX = [
      { pos:left,  target:0,         guide:0,         set:()=>0 },
      { pos:midX,  target:contW/2,   guide:contW/2,   set:()=>contW/2 - width/2 },
      { pos:right, target:contW,     guide:contW,     set:()=>contW - width },
    ];
    const candY = [
      { pos:top,   target:0,         guide:0,         set:()=>0 },
      { pos:midY,  target:contH/2,   guide:contH/2,   set:()=>contH/2 - height/2 },
      { pos:bottom,target:contH,     guide:contH,     set:()=>contH - height },
    ];

    let bestX=null, bestXd=Infinity; for(const c of candX){ const d=Math.abs(c.pos-c.target); if(d<bestXd && d<=SNAP_THRESHOLD){bestX=c;bestXd=d;} }
    let bestY=null, bestYd=Infinity; for(const c of candY){ const d=Math.abs(c.pos-c.target); if(d<bestYd && d<=SNAP_THRESHOLD){bestY=c;bestYd=d;} }

    let goalLeft = left, goalTop = top;
    if (bestX){ goalLeft = bestX.set(); showV(bestX.guide); } else if (guideV) guideV.style.display='none';
    if (bestY){ goalTop  = bestY.set(); showH(bestY.guide); } else if (guideH) guideH.style.display='none';

    // clamp
    goalLeft = Math.max(0, Math.min(goalLeft, Math.max(0, contW - width)));
    goalTop  = Math.max(0, Math.min(goalTop , Math.max(0, contH - height)));

    // převeď rozdíl zpět na dataset (už není potřeba scale — dataset je v obrazovkových px a applyTransform to vykreslí správně)
    const curX = +img.dataset.x || 0;
    const curY = +img.dataset.y || 0;
    const dx = goalLeft - left;
    const dy = goalTop  - top;

    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01){
      img.dataset.x = String(curX + dx);
      img.dataset.y = String(curY + dy);
      applyTransform(img);
      return true;
    }
    return false;
  }

  // --- FRAME (persistentní; pozicujeme v CSS px #product) ------------
  function ensureFrame(){
    if (frameEl) return frameEl;
    const frame = document.createElement('div');
    frame.className = 'frame'; frame.dataset.owner = 'image';
    Object.assign(frame.style, { position:'absolute', pointerEvents:'auto', cursor:'move', touchAction:'none', zIndex:'500', transition:'none' });

    const r = document.createElement('div'); // resize
    r.className='handle resize'; r.title='Změnit velikost (táhni)'; r.setAttribute('aria-label','Změnit velikost');
    Object.assign(r.style,{ position:'absolute', width:'18px', height:'18px', right:'-10px', bottom:'-10px',
      borderRadius:'4px', border:'2px solid #6ea8fe', background:'rgba(14,20,45,0.6)', boxShadow:'0 2px 10px rgba(0,0,0,.35)',
      cursor:'nwse-resize', touchAction:'none', transition:'none' });

    const rot = document.createElement('div'); // rotate
    rot.className='handle rotate'; rot.title='Otočit (táhni)'; rot.setAttribute('aria-label','Otočit');
    Object.assign(rot.style,{ position:'absolute', width:'22px', height:'22px', left:'50%', transform:'translateX(-50%) rotate(45deg)',
      top:'-34px', borderRadius:'6px', border:'2px solid #6ea8fe', background:'rgba(14,20,45,0.6)', boxShadow:'0 2px 10px rgba(0,0,0,.35)',
      cursor:'grab', touchAction:'none', transition:'none' });
    const icon=document.createElement('span'); icon.textContent='↻';
    Object.assign(icon.style,{ position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%) rotate(-45deg)',
      fontSize:'12px', lineHeight:'1', color:'#6ea8fe', userSelect:'none', pointerEvents:'none',
      fontFamily:'system-ui,-apple-system,Segoe UI,Roboto,Arial', fontWeight:'700' });
    rot.appendChild(icon);

    frame.appendChild(r); frame.appendChild(rot);
    productElement.appendChild(frame);
    frameEl = frame; hResize = r; hRotate = rot;

    bindFramePointerInteractions();
    return frame;
  }

  // nastav box rámu podle IMG (viewport → CSS px #product)
  function setFrameBoxFromImage(img){
    if (!img || !frameEl) return;
    const ir = img.getBoundingClientRect();
    const pr = getRectViewport(productElement);
    // převod do CSS px #product:
    const left = v2cX(ir.left - pr.left, productElement);
    const top  = v2cY(ir.top  - pr.top , productElement);
    const w    = v2cX(ir.width,  productElement);
    const h    = v2cY(ir.height, productElement);
    frameEl.style.left = (left - 8) + 'px';
    frameEl.style.top  = (top  - 8) + 'px';
    frameEl.style.width  = (w + 16) + 'px';
    frameEl.style.height = (h + 16) + 'px';
  }

  // RAF throttling
  let rafScheduled = false;
  function scheduleFrameSync(){
    if (rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(() => {
      if (selectedImg && frameEl) setFrameBoxFromImage(selectedImg);
      window.dispatchEvent(new CustomEvent('design:tick'));
      rafScheduled = false;
    });
  }

  const showFrameFor = img => { ensureFrame(); setFrameBoxFromImage(img); frameEl.style.display='block'; };
  const hideFrame    = () => { if (frameEl) frameEl.style.display='none'; };
  const removeFrame  = () => { if (frameEl){ frameEl.remove(); frameEl=null; hResize=hRotate=null; } };

  // --- selection -----------------------------------------------------
  function selectImage(img){
    if (!img) return;
    selectedImg = img;
    ensureDataAttrs(img);
    applyTransform(img);
    showFrameFor(img);
    ensureImageDragHandler(img);
    broadcastSelection('image');
    scheduleFrameSync();
  }
  function deselect(){ selectedImg=null; hideGuides(); hideFrame(); }

  document.addEventListener('pointerdown', e => {
    const t = /** @type {HTMLElement} */(e.target);
    const inside = productElement.contains(t);
    const clickedImg = t && t.id === 'designImage';
    const clickedFrame = t && frameEl && frameEl.contains(t);
    if (!inside){ deselect(); return; }
    if (clickedImg){ selectImage(t); e.stopPropagation(); return; }
    if (!clickedFrame){ deselect(); }
  });
  window.addEventListener('keydown', e => { if (e.key === 'Escape') deselect(); });

  const childObserver = new MutationObserver(() => {
    const img = document.querySelector(SELECTORS.image);
    if (img){ ensureDataAttrs(img); applyTransform(img); scheduleFrameSync(); }
    else { deselect(); removeFrame(); }
  });
  childObserver.observe(productElement, { childList:true, subtree:false });

  const existing = document.querySelector(SELECTORS.image);
  if (existing){ ensureDataAttrs(existing); applyTransform(existing); }

  // --- drag přímo z OBRÁZKU ------------------------------------------
  function ensureImageDragHandler(img){
    if (img.__dragBound) return;
    img.__dragBound = true;
    img.style.pointerEvents = 'auto';

    img.addEventListener('pointerdown', e => {
      if (selectedImg !== img) selectImage(img);
      e.preventDefault(); e.stopPropagation();
      img.setPointerCapture?.(e.pointerId);
      document.body.style.userSelect = 'none';
      disablePageScroll();

      const start = { x:e.clientX, y:e.clientY };
      const init  = { x:+img.dataset.x || 0, y:+img.dataset.y || 0 };

      function onMove(ev){
        ev.preventDefault();
        const dx = ev.clientX - start.x;
        const dy = ev.clientY - start.y;
        img.dataset.x = String(init.x + dx);
        img.dataset.y = String(init.y + dy);
        applyTransform(img);
        snapImagePosition(img);
        scheduleFrameSync();
      }
      function onUp(ev){
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        img.releasePointerCapture?.(ev.pointerId);
        document.body.style.userSelect = '';
        restorePageScroll();
        hideGuides();
        scheduleFrameSync();
      }
      window.addEventListener('pointermove', onMove, { passive:false });
      window.addEventListener('pointerup', onUp, { once:true });
    }, { passive:false });
  }

  // --- interakce s rámem ---------------------------------------------
  function bindFramePointerInteractions(){
    if (!frameEl) return;
    let mode = null; // 'move' | 'resize' | 'rotate'
    let start = { x:0, y:0 };
    let init  = { x:0, y:0, scale:1, rot:0 };
    let activePointerId = null;

    function onPointerDown(e){
      if (!selectedImg) return;
      e.preventDefault(); e.stopPropagation();
      const t = /** @type {HTMLElement} */(e.target);
      const isResize = !!t.closest('.handle.resize');
      const isRotate = !!t.closest('.handle.rotate');
      mode = isResize ? 'resize' : isRotate ? 'rotate' : 'move';

      start = { x:e.clientX, y:e.clientY };
      init  = {
        x:+selectedImg.dataset.x || 0,
        y:+selectedImg.dataset.y || 0,
        scale:+selectedImg.dataset.scale || 1,
        rot:+selectedImg.dataset.rot || 0
      };

      activePointerId = e.pointerId;
      frameEl.setPointerCapture?.(activePointerId);
      document.body.style.userSelect = 'none';
      disablePageScroll();

      window.addEventListener('pointermove', onPointerMove, { passive:false });
      window.addEventListener('pointerup', onPointerUp, { once:true });
    }

    function onPointerMove(e){
      if (!selectedImg) return;
      e.preventDefault();
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;

      if (mode === 'move'){
        selectedImg.dataset.x = String(init.x + dx);
        selectedImg.dataset.y = String(init.y + dy);
        applyTransform(selectedImg);
        snapImagePosition(selectedImg);
      } else if (mode === 'resize'){
        const delta = Math.max(Math.abs(dx), Math.abs(dy));
        const sign  = (dx + dy) >= 0 ? 1 : -1;
        const next  = Math.min(MAX_SCALE, Math.max(MIN_SCALE, init.scale + (delta / 200) * sign));
        selectedImg.dataset.scale = String(next);
        applyTransform(selectedImg);
        hideGuides();
      } else if (mode === 'rotate'){
        const rect = selectedImg.getBoundingClientRect();
        const center = { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
        const angle = Math.atan2(e.clientY - center.y, e.clientX - center.x) * 180 / Math.PI;
        selectedImg.dataset.rot = String(Math.round(angle + 90));
        applyTransform(selectedImg);
        hideGuides();
      }

      scheduleFrameSync();
    }

    function onPointerUp(e){
      window.removeEventListener('pointermove', onPointerMove);
      mode = null;
      if (activePointerId != null){
        frameEl.releasePointerCapture?.(activePointerId);
        activePointerId = null;
      }
      document.body.style.userSelect = '';
      restorePageScroll();
      hideGuides();
      scheduleFrameSync();
    }

    frameEl.addEventListener('pointerdown', onPointerDown);
  }

  // sync při změně layoutu / SCROLLU (důležité v Django šablonách)
  window.addEventListener('resize', scheduleFrameSync);
  window.addEventListener('scroll', scheduleFrameSync, { passive:true, capture:true });
})();
