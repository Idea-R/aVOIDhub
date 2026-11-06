import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {lstatSync,readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const provenance=JSON.parse(readFileSync(path.join(root,'docs/boomerangavoid/static-release/game-candidate.json'),'utf8'));
const candidate='c9866d5fd370f348702da6cbae499b8f9adbdefc';
const digest=data=>createHash('sha256').update(data).digest('hex');
const safe=p=>typeof p==='string'&&p&&!p.startsWith('/')&&!/[\\:\0]/.test(p)&&p.split('/').every(s=>s&&s!=='.'&&s!=='..');
assert.equal(provenance.candidateCommit,candidate);
assert.equal(provenance.buildMode,'local-release');
const sourcePrefixes=['games/boomerang-avoid/','packages/boomerangavoid-sim/','packages/boomerangavoid-protocol/'];
let checkedSources=0;
for(const entry of provenance.sourceFiles){
  assert(safe(entry.path));
  if(!sourcePrefixes.some(prefix=>entry.path.startsWith(prefix)))continue;
  const target=path.join(root,entry.path);
  assert(lstatSync(target).isFile()&&!lstatSync(target).isSymbolicLink());
  const bytes=readFileSync(target);
  assert.equal(bytes.length,entry.bytes,`Source size: ${entry.path}`);
  assert.equal(digest(bytes),entry.sha256,`Source hash: ${entry.path}`);
  checkedSources++;
}
assert.equal(checkedSources,124);
for(const entry of provenance.supportingFixtures){
  assert(safe(entry.path));
  const bytes=readFileSync(path.join(root,entry.path));
  assert.equal(bytes.length,entry.bytes,`Fixture size: ${entry.path}`);
  assert.equal(digest(bytes),entry.sha256,`Fixture hash: ${entry.path}`);
}
const pkg=JSON.parse(readFileSync(path.join(root,'games/boomerang-avoid/package.json'),'utf8'));
assert.equal(pkg.scripts.build,'tsc --noEmit && vite build --mode local-release');
const rootPkg=JSON.parse(readFileSync(path.join(root,'package.json'),'utf8'));
assert(rootPkg.scripts['build:platform:games'].includes('npm run build --workspace=@avoid/boomerang-avoid'));
assert(!rootPkg.scripts['build:platform:games'].includes('online-candidate'));

function tree(directory,prefix=''){
  assert(lstatSync(directory).isDirectory()&&!lstatSync(directory).isSymbolicLink());
  const files=[];
  for(const entry of readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
    const relative=prefix+entry.name;assert(safe(relative));
    const file=path.join(directory,entry.name),stat=lstatSync(file);
    assert(!stat.isSymbolicLink(),'Linked artifact path');
    if(stat.isDirectory())files.push(...tree(file,relative+'/'));
    else{assert(stat.isFile());const bytes=readFileSync(file);files.push({path:relative,bytes:bytes.length,sha256:digest(bytes)});}
    assert(files.length<1000);
  }
  return files;
}
const output=path.join(root,'dist/BoomerangaVOID');
const files=tree(output),expected=provenance.artifactFiles;
assert.deepEqual(files.map(f=>f.path),expected.map(f=>f.path),'Unexpected or missing static artifact files');
const normalizedText=[];
for(let i=0;i<files.length;i++){
  const actual=files[i],approved=expected[i];
  if(actual.sha256===approved.sha256&&actual.bytes===approved.bytes)continue;
  const allowance=provenance.allowedArtifactTextNormalization;
  assert(allowance&&actual.path===allowance.path,'Unreviewed compiled-byte difference: '+actual.path);
  assert.equal(actual.path,'licenses/ORIGINAL-ASSET-PROVENANCE.md');
  const text=new TextDecoder('utf8',{fatal:true}).decode(readFileSync(path.join(output,actual.path)));
  assert.equal(digest(text.replaceAll('\r\n','\n')),allowance.normalizedSha256,'Provenance text differs beyond line endings');
  normalizedText.push(actual.path);
}
const html=readFileSync(path.join(output,'index.html'),'utf8');
assert(html.includes('/boomerangavoid/assets/'));
assert(!html.includes('localhost')&&!html.includes('/src/'));
for(const entry of files.filter(f=>f.path.endsWith('.js'))){
  const code=readFileSync(path.join(output,entry.path),'utf8');
  assert(!/sb_secret_|sk_live_|-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(code),'Credential marker in browser code');
}
if(process.argv.includes('--staged'))assert.deepEqual(tree(path.join(root,'apps/platform/public/BoomerangaVOID')),files,'Staged game differs from the verified build');
console.log(JSON.stringify({candidateGameCommit:candidate,buildMode:'local-release',checkedSourceFiles:checkedSources,artifactFiles:files.length,artifactBytes:files.reduce((n,f)=>n+f.bytes,0),artifactTreeSha256:digest(JSON.stringify(files)),approvedTreeSha256:provenance.artifactTreeSha256,normalizedText,staged:process.argv.includes('--staged')},null,2));
