/* Recovery-Structure-2: decoded image cache and presentation adapters only.
   No game state, persistence, rewards, input listeners or additional render loop. */
const ImageAssets = {
  cache: new Map(),
  mounts: new WeakMap(),
  entry(id) { return Object.hasOwn(IMAGE_CATALOG.entries,id) ? IMAGE_CATALOG.entries[id] : null; },
  customerId(emoji) { return 'customer.' + (Object.hasOwn(IMAGE_CATALOG.aliases.customers,emoji) ? IMAGE_CATALOG.aliases.customers[emoji] : 'default'); },
  vehicleId(emoji, id) { return 'vehicle.' + (id ?? (Object.hasOwn(IMAGE_CATALOG.aliases.vehicles,emoji) ? IMAGE_CATALOG.aliases.vehicles[emoji] : '0')); },
  async decode(asset) {
    if (!asset.hash) throw Error('Image not present in this release');
    const response = await fetch(new URL('./'+asset.path, document.baseURI), {
      mode:'same-origin', credentials:'same-origin', redirect:'error', cache:'no-store', signal:AbortSignal.timeout(10000),
    });
    if (!response.ok || response.redirected || (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase() !== asset.mime) throw Error('Image unavailable or wrong MIME');
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 8*1024*1024) throw Error('Image exceeds 8 MiB');
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hash = [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
    if (hash !== asset.hash) throw Error('Image version mismatch');
    const url = URL.createObjectURL(new Blob([bytes], {type:asset.mime}));
    let timeout;
    try {
      const img = new Image();
      const decoding = new Promise((resolve,reject) => {
        img.onload = resolve;
        img.onerror = () => reject(Error('Image decode failed'));
        img.src = url;
      }).then(async () => {
        if (img.decode) await img.decode();
        if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth*img.naturalHeight > 16777216) throw Error('Invalid image dimensions');
        return img;
      });
      const deadline = new Promise((resolve,reject) => {
        timeout = setTimeout(() => reject(Error('Image decode timed out')), 10000);
      });
      return await Promise.race([decoding,deadline]);
    } finally { clearTimeout(timeout); URL.revokeObjectURL(url); }
  },
  request(asset) {
    const key = asset.path + ':' + asset.hash;
    let record = this.cache.get(key);
    if (!record) {
      record = {status:'loading',image:null,error:null,promise:null};
      this.cache.set(key,record);
      if (!asset.hash) {
        record.status='failed'; record.error='Image not present in this release'; record.promise=Promise.resolve(null);
        return record;
      }
      // Rejections terminate inside the cache: render and UI never receive an unhandled failure.
      record.promise = this.decode(asset).then(img => {record.image=img;record.status='ready';return img;}, error => {record.error=String(error.message);record.status='failed';return null;});
    }
    return record;
  },
  image(id) {
    const entry = this.entry(id);
    if (!entry) return null;
    // A candidate starts only after the preceding one failed; loading keeps the old fallback.
    for (const asset of entry.sources) {
      const record = this.request(asset);
      if (record.status === 'ready') return record.image;
      if (record.status === 'loading') return null;
    }
    return null;
  },
  async load(id) {
    for (const asset of this.entry(id)?.sources || []) {
      const img = await this.request(asset).promise;
      if (img) return img;
    }
    return null;
  },
  retry(id) {
    for (const asset of this.entry(id)?.sources || []) {
      const key = asset.path+':'+asset.hash;
      if (this.cache.get(key)?.status === 'failed') this.cache.delete(key);
    }
    return this.load(id);
  },
  paint(context, img, id, x, y, width, height) {
    if (![x,y,width,height].every(Number.isFinite) || width<=0 || height<=0) return false;
    const entry = this.entry(id), iw = img.naturalWidth, ih = img.naturalHeight;
    const [ax,ay] = entry?.anchor || [.5,.5];
    context.save();
    try {
      if (entry?.fit === 'cover') {
        const scale = Math.max(width/iw,height/ih), sw = width/scale, sh = height/scale;
        context.drawImage(img,(iw-sw)*ax,(ih-sh)*ay,sw,sh,x,y,width,height);
      } else {
        const scale = Math.min(width/iw,height/ih), w = iw*scale, h = ih*scale;
        context.drawImage(img,x+(width-w)*ax,y+(height-h)*ay,w,h);
      }
      return true;
    } catch { return false; }
    finally { context.restore(); }
  },
  draw(context, id, x, y, width, height) {
    const img = this.image(id);
    return !!img && this.paint(context,img,id,x,y,width,height);
  },
  mount(host, id, fallback) {
    const previous = this.mounts.get(host);
    const originalColor = previous?.color ?? host.style.color;
    const originalPosition = previous?.position ?? host.style.position;
    const token = {color:originalColor,position:originalPosition};
    this.mounts.set(host,token);
    if (previous) {
      if (host.style.color !== originalColor) host.style.color=originalColor;
      if (host.style.position !== originalPosition) host.style.position=originalPosition;
    }
    if (host.textContent !== fallback || host.children.length) host.textContent = fallback;
    if (!this.entry(id)?.sources.length) return;
    // The fallback text stays in normal flow. Only an absolute decorative layer is added,
    // so image dimensions cannot resize the menu and user font/viewport changes still work.
    host.style.position = 'relative';
    this.load(id).then(img => {
      if (!img || !host.isConnected || this.mounts.get(host)!==token) return;
      const rect = host.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const layer = document.createElement('canvas'), ratio = Math.min(3,window.devicePixelRatio || 1);
      layer.width = Math.ceil(rect.width*ratio); layer.height = Math.ceil(rect.height*ratio);
      layer.setAttribute('aria-hidden','true');
      Object.assign(layer.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none'});
      const context = layer.getContext('2d');
      if (!context) return;
      context.scale(ratio,ratio);
      if (!this.paint(context,img,id,0,0,rect.width,rect.height)) return;
      host.style.color = 'transparent'; host.append(layer);
    }).catch(() => { if (this.mounts.get(host)===token) host.style.color=originalColor; });
  },
};
