const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {test}=require('node:test');const {mediaRoot}=require('./helpers/recovery-media.cjs');const {build}=require('../scripts/build-pwa.cjs');const {buildImageCatalog}=require('../scripts/image-catalog.cjs');
const withRoot=fn=>{const root=mediaRoot();try{fn(root);}finally{fs.rmSync(root,{recursive:true,force:true});}};
test('same-name image replacement changes the generated catalog and release; stale check never writes',()=>withRoot(root=>{
 const old=build(root,true), generated=['index.html','sw.js','js/media/catalog.js'].map(f=>fs.readFileSync(path.join(root,f),'utf8'));
 fs.appendFileSync(path.join(root,'assets/images/test/picture.svg'),'\n<!-- new bytes -->');
 assert.throws(()=>build(root,true),/release is stale/);assert.deepEqual(['index.html','sw.js','js/media/catalog.js'].map(f=>fs.readFileSync(path.join(root,f),'utf8')),generated);
 const next=build(root);assert.notEqual(next.version,old.version);assert.notEqual(next.optional.find(a=>a.path.endsWith('picture.svg')).hash,old.optional.find(a=>a.path.endsWith('picture.svg')).hash);assert.equal(build(root,true).version,next.version);assert.equal(build(root).version,next.version);
}));
test('declared missing picture builds as optional with null hash; adding it needs a new release',()=>withRoot(root=>{
 const first=build(root,true);const asset=first.optional.find(a=>a.path.endsWith('missing.svg'));assert.equal(asset.hash,null);assert.equal(asset.mime,'image/svg+xml');assert.ok(!first.required.some(a=>a.path===asset.path));
 fs.writeFileSync(path.join(root,asset.path),fs.readFileSync(path.join(root,'assets/images/test/picture.svg')));const next=build(root);assert.notEqual(next.version,first.version);assert.match(next.optional.find(a=>a.path===asset.path).hash,/^[a-f0-9]{64}$/);
}));
test('catalog rejects external/traversal paths, invalid fit and invalid aliases before generating any release',()=>withRoot(root=>{
 const file=path.join(root,'assets/images/catalog.json'),original=JSON.parse(fs.readFileSync(file)),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 for(const entry of [{sources:['https://example.com/a.png']},{sources:['assets/images/../a.png']},{sources:['assets/images/a.png?x=1']},{sources:[],fit:'stretch'}]){const v=structuredClone(original);v.entries['menu.fried']=entry;fs.writeFileSync(file,JSON.stringify(v));assert.throws(()=>build(root),/Invalid image/);assert.equal(fs.readFileSync(path.join(root,'index.html'),'utf8'),html);}
 const v=structuredClone(original);v.aliases.customers['🙂']='not-in-catalog';fs.writeFileSync(file,JSON.stringify(v));assert.throws(()=>buildImageCatalog(root),/Invalid image aliases/);
}));
test('PNG/JPEG/WebP/SVG metadata shares MIME and deduplicates the same optional source across IDs',()=>withRoot(root=>{
 const f=path.join(root,'assets/images/catalog.json'),v=JSON.parse(fs.readFileSync(f));for(const ext of ['png','jpg','jpeg','webp','svg']){const name='assets/images/test/mime.'+ext;fs.writeFileSync(path.join(root,name),'synthetic build bytes');v.entries['test.type-'+ext]={sources:[name]};}fs.writeFileSync(f,JSON.stringify(v));const list=buildImageCatalog(root).assets;
 assert.equal(list.filter(a=>a.path.endsWith('picture.svg')).length,1);for(const [ext,mime]of Object.entries({png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',svg:'image/svg+xml'}))assert.equal(list.find(a=>a.path.endsWith('mime.'+ext)).mime,mime);
}));

test('catalog rejects symlink escapes and oversized files without changing generated outputs',()=>withRoot(root=>{
 const configFile=path.join(root,'assets/images/catalog.json'),config=JSON.parse(fs.readFileSync(configFile));
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 fs.symlinkSync(path.join(root,'index.html'),path.join(root,'assets/images/test/escape.png'));
 config.entries['test.escape']={sources:['assets/images/test/escape.png']};
 fs.writeFileSync(configFile,JSON.stringify(config));
 assert.throws(()=>build(root),/outside asset directory/);
 delete config.entries['test.escape'];
 fs.writeFileSync(path.join(root,'assets/images/test/oversized.png'),Buffer.alloc(8*1024*1024+1));
 config.entries['test.large']={sources:['assets/images/test/oversized.png']};
 fs.writeFileSync(configFile,JSON.stringify(config));
 assert.throws(()=>build(root),/exceeds 8 MiB/);
 assert.equal(fs.readFileSync(path.join(root,'index.html'),'utf8'),html);
}));

test('candidate and entry validation catches duplicate paths, excess candidates, bad anchors and unknown fields',()=>withRoot(root=>{
 const file=path.join(root,'assets/images/catalog.json'),config=JSON.parse(fs.readFileSync(file));
 for(const entry of [
  {sources:['assets/images/a.png','assets/images/a.png']},
  {sources:['a','b','c','d','e'].map(n=>'assets/images/'+n+'.png')},
  {sources:[],anchor:[-1,.5]},
  {sources:[],anchor:[.5]},
  {sources:[],opacity:.5},
 ]){
  const next=structuredClone(config);next.entries['menu.fried']=entry;
  fs.writeFileSync(file,JSON.stringify(next));assert.throws(()=>buildImageCatalog(root),/Invalid image|Repeated image/);
 }
}));
