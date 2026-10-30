const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{test,after}=require('node:test');
const repo=path.resolve(__dirname,'../../..');const{mediaRoot}=require(repo+'/tests/helpers/recovery-media.cjs');const{build}=require(repo+'/scripts/build-pwa.cjs');const{harness}=require(repo+'/tests/helpers/game.cjs');
const root=mediaRoot(),file='assets/images/test/transparent.svg';
fs.writeFileSync(path.join(root,file),'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="8"><rect width="8" height="8" fill="red"/></svg>');
const configFile=path.join(root,'assets/images/catalog.json'),config=JSON.parse(fs.readFileSync(configFile));config.entries['background.changnyeong']={sources:[file],fit:'cover'};fs.writeFileSync(configFile,JSON.stringify(config));build(root);
const{game,fixture}=harness({root});after(()=>fs.rmSync(root,{recursive:true,force:true}));
test('real transparent background replaces painted pixels but restores the procedural base through its transparent half',()=>game(fixture(),async p=>{
 await p.waitForFunction(()=>state.customers.length>0,null,{polling:50});
 await p.evaluate(async()=>{await ImageAssets.load('background.changnyeong');state.customers=[];visualRiders=[];});
 const before=await p.evaluate(()=>({state:JSON.stringify(state),primary:localStorage.getItem(SAVE_KEY),backup:localStorage.getItem(SAVE_BACKUP_KEY),dirty:_saveDirty,service:JSON.stringify(ServiceRuntime)}));
 const result=await p.evaluate(()=>{
  const asset=IMAGE_CATALOG.entries['background.changnyeong'].sources[0],record=ImageAssets.cache.get(asset.path+':'+asset.hash);
  const x=Math.floor(canvas.width*.75),y=Math.floor(canvas.height*.5),leftX=Math.floor(canvas.width*.25);
  record.status='failed';render();const procedural=[...ctx.getImageData(x,y,1,1).data];
  record.status='ready';ctx.fillStyle='#00ff00';ctx.fillRect(x,y,2,2);render();
  return {procedural,throughAlpha:[...ctx.getImageData(x,y,1,1).data],opaque:[...ctx.getImageData(leftX,y,1,1).data]};
 });
 assert.deepEqual(result.throughAlpha,result.procedural);assert.notDeepEqual(result.throughAlpha,[0,255,0,255]);assert.deepEqual(result.opaque,[255,0,0,255]);
 assert.deepEqual(await p.evaluate(()=>({state:JSON.stringify(state),primary:localStorage.getItem(SAVE_KEY),backup:localStorage.getItem(SAVE_BACKUP_KEY),dirty:_saveDirty,service:JSON.stringify(ServiceRuntime)})),before);
 fs.writeFileSync(repo+'/docs/improvements/verification/REC-STRUCTURE-02-transparency.json',JSON.stringify({actualChromium:true,fixtureOnly:true,opaquePixelsReplaced:true,transparentPixelsRestoreProceduralBase:true,stateSaveBackupDirtyServiceUnchanged:true,pixels:result,addedToFinalTestCount:false},null,2)+'\n');
}));
