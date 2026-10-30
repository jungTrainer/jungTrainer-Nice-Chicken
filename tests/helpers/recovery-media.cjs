const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const {build} = require('../../scripts/build-pwa.cjs');
function copyApp(root) {
  const source=path.resolve(__dirname,'../..');fs.mkdirSync(root,{recursive:true});
  for(const file of ['index.html','sw.js','manifest.json','icon-192.png','icon-512.png','js','css','assets',...[1,2,3,4,5].map(n=>`END_0${n}.png`),'END_SOUND.mp3'])fs.cpSync(path.join(source,file),path.join(root,file),{recursive:true});
}
function prepareMedia(root,index=0) {
  const folder=path.join(root,'assets/images/test');fs.mkdirSync(folder,{recursive:true});
  const picture=`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="8"><rect width="16" height="8" fill="${index?'blue':'red'}"/></svg>`;
  for(const name of ['picture','delay','retry','hash','mime'])fs.writeFileSync(path.join(folder,name+'.svg'),picture);
  fs.writeFileSync(path.join(folder,'broken.svg'),'<this-is-not-an-image>');
  const catalogFile=path.join(root,'assets/images/catalog.json'), config=JSON.parse(fs.readFileSync(catalogFile));
  const file=n=>'assets/images/test/'+n+'.svg', entry=n=>({sources:[file(n)]});
  for(const id of ['character.boss','staff.neighbor','customer.default','customer.happy','vehicle.0','signboard.0','menu.fried'])config.entries[id]=entry('picture');
  config.entries['background.changnyeong']=entry('picture');
  for(const name of ['delay','retry','hash','mime','broken'])config.entries['test.'+name]=entry(name);
  config.entries['test.missing']=entry('missing');
  config.entries['test.candidates']={sources:[file('broken'),file('picture')]};
  config.entries['test.contain']={...entry('picture'),fit:'contain'};
  config.entries['test.cover']={...entry('picture'),fit:'cover',anchor:[1,.5]};
  fs.writeFileSync(catalogFile,JSON.stringify(config,null,2)+'\n');
}
function mediaRoot() { const root=fs.mkdtempSync(path.join(os.tmpdir(),'nice-chicken-media-'));copyApp(root);prepareMedia(root);build(root);return root; }
module.exports={copyApp,prepareMedia,mediaRoot};
