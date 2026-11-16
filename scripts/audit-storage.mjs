// Storage checks in a temporary workspace directory; never opens live data/.
import {mkdir,mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {performance} from 'node:perf_hooks';
const output=resolve('.tools/capacity-audit');await mkdir(output,{recursive:true});
const dir=await mkdtemp(resolve(output,'storage-'));process.env.DATA_DIR=dir;
const {jsonFile}=await import('../server/store.js');
const seed=Array.from({length:500},(_,i)=>({id:i,text:'x'.repeat(200)}));
await writeFile(resolve(dir,'chat-test.json'),JSON.stringify(seed));
const store=jsonFile('chat-test.json',[]),latencies=[];
const started=performance.now();
await Promise.all(Array.from({length:100},(_,i)=>{
  const start=performance.now();
  return store.update(list=>{list.push({id:500+i,text:'y'.repeat(200)});return list.slice(-500)}).then(()=>latencies.push(performance.now()-start));
}));
const elapsedMs=performance.now()-started;
const persisted=JSON.parse(await readFile(resolve(dir,'chat-test.json'),'utf8'));
latencies.sort((a,b)=>a-b);
await writeFile(resolve(dir,'blocker'),'A regular file, not a directory');
const broken=jsonFile('blocker/failed.json',[]);let writeRejected=false;
try{await broken.update(list=>{list.push({unpersisted:true});return list})}catch{writeRejected=true}
const result={scope:'One process, local filesystem, 100 concurrent updates of a full 500-entry history. Not production-disk throughput.',
  concurrentUpdates:100,elapsedMs,p95CompletionMs:latencies[94],persistedEntries:persisted.length,
  allSubmittedEntriesOnDisk:Array.from({length:100},(_,i)=>500+i).every(id=>persisted.some(p=>p.id===id)),
  failedWrite:{writeRejected,unpersistedEntryVisibleInCache:(await broken.get()).some(x=>x.unpersisted)}};
await writeFile(resolve(output,'storage-report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
