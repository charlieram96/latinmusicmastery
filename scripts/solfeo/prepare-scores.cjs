const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {JSDOM}=require('jsdom');const {buildSync}=require('esbuild');
const root=process.cwd(),prod=path.join(root,'local-artifacts/solfeo-course/production');
const bundle=path.join(os.tmpdir(),'lmm-solfeo-musicxml-import.cjs');
buildSync({entryPoints:['lib/playsense-studio/parsers/musicxml.ts'],outfile:bundle,bundle:true,platform:'node',format:'cjs',alias:{'@':root},logLevel:'silent'});
global.DOMParser=new JSDOM('').window.DOMParser;
const {parseMusicXmlString}=require(bundle);
const catalog=JSON.parse(fs.readFileSync(path.join(prod,'curriculum.json')));
const refs=[...new Map(catalog.lessons.flatMap(l=>l.scores).map(s=>[s.id,s])).values()];
const out=path.join(prod,'prepared-scores');fs.mkdirSync(out,{recursive:true});
for(const ref of refs){const score=parseMusicXmlString(fs.readFileSync(path.join(root,ref.musicxml),'utf8'));score.composer='LMM';fs.writeFileSync(path.join(out,ref.id+'.json'),JSON.stringify(score,null,2));}
console.log('Prepared',refs.length,'editable PlaySense scores');
