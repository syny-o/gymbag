// js/customizer/helpers.js

// Promise wrapper pro Image.fromURL (funguje i ve 4/5.x)
export function fromURL(url, options = {}) {
  return new Promise((resolve, reject) => {
    fabric.Image.fromURL(
      url,
      (img) => (img ? resolve(img) : reject(new Error('Failed to load ' + url))),
      options
    );
  });
}

// Nastaví backgroundImage "contain" + centrování
export function setBgContain(canvas, img) {
  const cw = canvas.getWidth(), ch = canvas.getHeight();
  const iw = img.width, ih = img.height;
  const scale = Math.min(cw / iw, ch / ih);
  const left  = (cw - iw * scale) / 2;
  const top   = (ch - ih * scale) / 2;

  canvas.setBackgroundImage(img, canvas.requestRenderAll.bind(canvas), {
    scaleX: scale, scaleY: scale,
    left, top,
    originX: 'left', originY: 'top'
  });
}

// Zajistí overlay wrapper (přepíše inline styly Fabricu)
export function ensureWrapOverlay(canvas) {
  const wrap = canvas.getElement().parentNode;
  wrap.style.position = 'absolute';
  wrap.style.top = '0'; wrap.style.right = '0';
  wrap.style.bottom = '0'; wrap.style.left = '0';
  return wrap;
}

// Vizuální rám tiskové oblasti
export function makePrintFrame(area) {
  return new fabric.Rect({
    left: area.x, top: area.y, width: area.w, height: area.h,
    stroke: '#00AEEF', strokeDashArray: [6, 6],
    fill: 'rgba(0,0,0,0)', selectable: false, evented: false
  });
}

// Vrstva pro design s clipPath (sem budeme přidávat text/obrázky)
export function makeDesignLayer(area) {
  const clip = new fabric.Rect({ left: area.x, top: area.y, width: area.w, height: area.h });
  return new fabric.Group([], { clipPath: clip, selectable: false, evented: false });
}
