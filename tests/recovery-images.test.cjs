const assert=require('node:assert/strict'),fs=require('node:fs');const {test,after}=require('node:test');
const {harness}=require('./helpers/game.cjs'),{mediaRoot}=require('./helpers/recovery-media.cjs');
const root=mediaRoot(),{game,fixture}=harness({root});after(()=>fs.rmSync(root,{recursive:true,force:true}));
const stable=p=>p.waitForFunction(()=>state.customers.length>0,null,{polling:50});
const snap=p=>p.evaluate(()=>({state:JSON.stringify(state),primary:localStorage.getItem(SAVE_KEY),backup:localStorage.getItem(SAVE_BACKUP_KEY),dirty:_saveDirty,timers:JSON.stringify(ServiceRuntime),layout:{staff:staffCenters(),boss:bossCenter(),serve:serveSpot()},stage:[canvas.width,canvas.height]}));
const ready=p=>p.evaluate(()=>ImageAssets.load('menu.fried'));

test('catalog/loader install without game or DOM access and an empty source mount changes no fallback styles',()=>{
 const vm=require('node:vm');let fetches=0,writes=0;
 const context=vm.createContext({fetch:()=>{fetches++;throw Error('unexpected fetch');}});
 vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../js/media/catalog.js'),'utf8'),context);
 vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../js/media/images.js'),'utf8'),context);
 const host={textContent:'🍗',children:[],style:new Proxy({color:'',position:''},{set(){writes++;throw Error('unexpected style change');}})};
 context.host=host;vm.runInContext('ImageAssets.mount(host,"menu.fried","🍗");ImageAssets.mount(host,"menu.fried","🍗");',context);
 assert.equal(fetches,0);assert.equal(writes,0);assert.equal(host.textContent,'🍗');
 assert.equal(vm.runInContext('Object.isFrozen(IMAGE_CATALOG.entries)&&ImageAssets.cache.size===0',context),true);
});

test('a hung Image.decode finishes as cached failure and revokes its Blob without waiting on gameplay',async()=>{
 const vm=require('node:vm'),crypto=require('node:crypto'),path=require('node:path');
 const bytes=Buffer.from('test'),digest=crypto.createHash('sha256').update(bytes).digest('hex');
 let deadline,revoked=0,cleared=0,decoding=false;
 class TestURL extends URL {static createObjectURL(){return 'blob:test';}static revokeObjectURL(){revoked++;}}
 class HungImage {constructor(){this.naturalWidth=1;this.naturalHeight=1;}set src(v){queueMicrotask(()=>this.onload());}decode(){decoding=true;return new Promise(()=>{});}}
 const context=vm.createContext({URL:TestURL,Image:HungImage,Blob,AbortSignal,crypto:crypto.webcrypto,document:{baseURI:'https://localhost/'},fetch:async()=>({ok:true,redirected:false,headers:{get:()=> 'image/png'},arrayBuffer:async()=>Uint8Array.from(bytes).buffer}),setTimeout:fn=>{deadline=fn;return 1;},clearTimeout:()=>{cleared++;}});
 vm.runInContext('const IMAGE_CATALOG='+JSON.stringify({entries:{'test.hang':{sources:[{path:'assets/images/hang.png',hash:digest,mime:'image/png'}]}},aliases:{customers:{},vehicles:{}}})+';',context);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/media/images.js'),'utf8'),context);
 const result=vm.runInContext('ImageAssets.load("test.hang")',context);
 for(let i=0;i<100&&!decoding;i++)await new Promise(setImmediate);
 assert.equal(decoding,true);assert.equal(typeof deadline,'function');deadline();
 assert.equal(await result,null);assert.equal(revoked,1);assert.equal(cleared,1);
 assert.equal(vm.runInContext('[...ImageAssets.cache.values()][0].status',context),'failed');
 assert.match(vm.runInContext('[...ImageAssets.cache.values()][0].error',context),/timed out/);
});

test('scene and menu share one verified decoded image and keep cache/catalog out of state and saves',()=>game(fixture(),async p=>{
 await stable(p);await ready(p);const before=await snap(p);const result=await p.evaluate(async()=>{const images=await Promise.all(['menu.fried','character.boss','staff.neighbor','customer.default','vehicle.0','signboard.0'].map(id=>ImageAssets.load(id)));render();return {one:images.every(i=>i===images[0]),ready:[...ImageAssets.cache.values()].filter(r=>r.status==='ready').length,keys:Object.keys(state),frozen:Object.isFrozen(IMAGE_CATALOG.entries['menu.fried'].sources[0])};});
 assert.equal(result.one,true);assert.equal(result.ready,1);assert.equal(result.frozen,true);assert.ok(!result.keys.includes('ImageAssets'));assert.deepEqual(await snap(p),before);
}));

test('actual scene/menu images preserve state and clear previous pixels outside a contain image',()=>game(fixture(),async p=>{
 await stable(p);await ready(p);await p.waitForFunction(()=>!!menuGrid.querySelector('.emoji canvas'),null,{polling:50});
 await p.evaluate(()=>{state.customers=[];visualRiders=[];});const before=await snap(p);
 const result=await p.evaluate(()=>{
  render();
  const center=[...ctx.getImageData(Math.floor(canvas.width/2),Math.floor(canvas.height/2),1,1).data];
  ctx.fillStyle='#00ff00';ctx.fillRect(0,0,2,2);render();
  const corner=[...ctx.getImageData(0,0,1,1).data];
  const menu=menuGrid.querySelector('.emoji canvas'),m=menu.getContext('2d');
  return {center,corner,menu:[...m.getImageData(Math.floor(menu.width/2),Math.floor(menu.height/2),1,1).data],identity:ctx.getTransform().isIdentity,alpha:ctx.globalAlpha};
 });
 assert.deepEqual(result.center,[255,0,0,255]);assert.notDeepEqual(result.corner,[0,255,0,255]);
 assert.deepEqual(result.menu,[255,0,0,255]);assert.equal(result.identity,true);assert.equal(result.alpha,1);
 assert.deepEqual(await snap(p),before);
}));

test('missing/decode/hash/MIME failures use fallback and terminal cache without request storms',()=>game(fixture(),async p=>{
 await stable(p);await p.route('**/assets/images/test/hash.svg',r=>r.fulfill({status:200,contentType:'image/svg+xml',body:'wrong bytes'}));await p.route('**/assets/images/test/mime.svg',r=>r.fulfill({status:200,contentType:'text/plain',body:'wrong mime'}));const before=await snap(p);
 const value=await p.evaluate(async()=>{const ids=['test.missing','test.broken','test.hash','test.mime'];const values=await Promise.all(ids.map(id=>ImageAssets.load(id)));const size=ImageAssets.cache.size;for(let i=0;i<30;i++)for(const id of ids)ImageAssets.draw(ctx,id,0,0,10,10);return {fallback:values.every(v=>v===null),sameSize:ImageAssets.cache.size===size,status:ids.map(id=>ImageAssets.cache.get(IMAGE_CATALOG.entries[id].sources[0].path+':'+IMAGE_CATALOG.entries[id].sources[0].hash).status)};});
 assert.deepEqual(value,{fallback:true,sameSize:true,status:Array(4).fill('failed')});assert.deepEqual(await snap(p),before);
}));

test('failed candidate advances to the verified next file; network failure retries only explicitly',()=>game(fixture(),async p=>{
 await stable(p);let requests=0;await p.route('**/assets/images/test/retry.svg',r=>{requests++;return r.abort();});const before=await snap(p);
 assert.equal(await p.evaluate(async()=>!!await ImageAssets.load('test.candidates')),true);assert.equal(await p.evaluate(async()=>await ImageAssets.load('test.retry')),null);await p.evaluate(async()=>{for(let i=0;i<20;i++)await ImageAssets.load('test.retry');});assert.equal(requests,1);
 await p.unroute('**/assets/images/test/retry.svg');assert.equal(await p.evaluate(async()=>!!await ImageAssets.retry('test.retry')),true);assert.deepEqual(await snap(p),before);
}));

for(const width of [360,390])test(`${width}px delayed menu picture keeps dimensions, stage, focus and business state`,()=>game(fixture(),async p=>{
 await stable(p);await ready(p);let finish,started;const arrived=new Promise(r=>started=r),gate=new Promise(r=>finish=r);await p.route('**/assets/images/test/delay.svg',async r=>{started();await gate;await r.continue();});
 await p.locator('[data-menu-id="fried"][data-action="serve-menu"]').focus();const before=await snap(p);const rect=await p.locator('[data-menu-id="fried"][data-action="serve-menu"]').boundingBox();
 await p.evaluate(()=>ImageAssets.mount(menuGrid.querySelector('.emoji'),'test.delay','🍗'));await arrived;assert.deepEqual(await snap(p),before);finish();await p.waitForFunction(()=>menuGrid.querySelector('.emoji canvas'),null,{polling:50});
 assert.deepEqual(await p.locator('[data-menu-id="fried"][data-action="serve-menu"]').boundingBox(),rect);assert.equal(await p.evaluate(()=>document.activeElement.dataset.menuId),'fried');assert.deepEqual(await snap(p),before);
 await p.locator('[data-menu-id="fried"][data-action="serve-menu"]').tap();assert.equal(await p.evaluate(()=>state.missions._serveToday),1);
},{viewport:{width,height:844}}));

test('a delayed image cannot decorate a detached old-branch menu after real map travel',()=>game(fixture({regionUnlocked:{changnyeong:true,busan:true}}),async p=>{
 await stable(p);let finish,started;const arrived=new Promise(r=>started=r),gate=new Promise(r=>finish=r);await p.route('**/assets/images/test/delay.svg',async r=>{started();await gate;await r.continue();});
 await p.evaluate(()=>{window.oldImageHost=menuGrid.querySelector('.emoji');ImageAssets.mount(oldImageHost,'test.delay','🍗');});await arrived;
 await p.locator('#openMap').tap();await p.locator('.map-node[data-region-id="busan"] button').tap();await p.keyboard.press('Escape');await ready(p);const before=await snap(p);finish();await p.evaluate(()=>ImageAssets.load('test.delay'));
 assert.equal(await p.evaluate(()=>oldImageHost.isConnected),false);assert.equal(await p.evaluate(()=>oldImageHost.querySelector('canvas')===null),true);assert.deepEqual(await snap(p),before);await p.reload();await p.evaluate(()=>SessionOwner.ready);assert.equal(await p.evaluate(()=>state.regionId),'busan');
}));

test('remount cancels stale images, clears transparent text on fallback, and fit never changes canvas transform',()=>game(fixture(),async p=>{
 await stable(p);await ready(p);const before=await snap(p);const result=await p.evaluate(async()=>{const host=menuGrid.querySelector('.emoji');ImageAssets.mount(host,'test.missing','🍗');await ImageAssets.load('test.missing');const context=document.createElement('canvas').getContext('2d');context.canvas.width=context.canvas.height=20;context.translate(1,2);context.globalAlpha=.75;await ImageAssets.load('test.contain');await ImageAssets.load('test.cover');ImageAssets.draw(context,'test.contain',0,0,16,16);const letterbox=context.getImageData(8,3,1,1).data[3];context.clearRect(-1,-2,20,20);ImageAssets.draw(context,'test.cover',0,0,16,16);return {fallback:host.style.color!=='transparent'&&!host.querySelector('canvas'),a:context.globalAlpha,transform:[context.getTransform().e,context.getTransform().f],letterbox,cover:context.getImageData(8,3,1,1).data[3]};});
 assert.equal(result.fallback,true);assert.equal(result.a,.75);assert.deepEqual(result.transform,[1,2]);assert.equal(result.letterbox,0);assert.ok(result.cover>0);assert.deepEqual(await snap(p),before);
}));

test('image readiness never changes export/import, fixed receipt, paid/coupons or reset preservation rules',()=>game(fixture({offlineReward:{amount:777,seconds:60},coupons:{drink:3,veg:7}}),async p=>{
 p.on('dialog',d=>d.accept());await p.keyboard.press('Escape');await stable(p);await ready(p);
 const before=await p.evaluate(()=>({coupons:state.coupons,ledger:JSON.stringify(state.couponLedger),pending:state.offlineReward,paid:state.missions.dailyCompletedToday}));
 assert.equal(await p.evaluate(()=>{const raw=exportSaveData();return importSaveData(raw);}),true);await ready(p);assert.deepEqual(await p.evaluate(()=>({coupons:state.coupons,ledger:JSON.stringify(state.couponLedger),pending:state.offlineReward,paid:state.missions.dailyCompletedToday})),before);
 const exported=await p.evaluate(()=>exportSaveData());assert.ok(!exported.includes('blob:'));assert.ok(!exported.includes('ImageAssets'));assert.equal(await p.evaluate(()=>resetGame()),true);await ready(p);assert.equal(await p.evaluate(()=>state.money),0);assert.equal(await p.evaluate(()=>JSON.stringify(state.couponLedger)),before.ledger);
}));

for(const action of ['import','reset'])test(`late image completion after successful ${action} cannot change the replacement root or attach to its menu`,()=>game(fixture(),async p=>{
 p.on('dialog',d=>d.accept());await stable(p);let finish,started;const arrived=new Promise(r=>started=r),gate=new Promise(r=>finish=r);await p.route('**/assets/images/test/delay.svg',async r=>{started();await gate;await r.continue();});
 await p.evaluate(()=>{window.detachedImageHost=menuGrid.querySelector('.emoji');ImageAssets.mount(detachedImageHost,'test.delay','🍗');});await arrived;
 assert.equal(await p.evaluate(action=>action==='import'?importSaveData(exportSaveData()):resetGame(),action),true);
 await stable(p);await ready(p);const before=await snap(p);finish();await p.evaluate(()=>ImageAssets.load('test.delay'));assert.equal(await p.evaluate(()=>detachedImageHost.isConnected),false);assert.equal(await p.evaluate(()=>detachedImageHost.querySelector('canvas')===null),true);assert.deepEqual(await snap(p),before);
}));
