// Isolated baseline audit. Never connects to a public or running development server.
// Output: .tools/capacity-audit/report.json. Does not change application code/data.
import {fork} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdir,writeFile,mkdtemp,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {monitorEventLoopDelay,performance} from 'node:perf_hooks';
import {randomUUID} from 'node:crypto';
import WebSocket from 'ws';
import os from 'node:os';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
if(process.argv.includes('--worker')){
  const {attachMultiplayer}=await import('../server/multiplayer.js');
  const {handleWishes}=await import('../server/wishes.js');
  const {handleAdmin}=await import('../server/admin.js');
  const server=createServer(async(req,res)=>{
    if(await handleWishes(req,res)||await handleAdmin(req,res))return;
    res.writeHead(200).end('ok');
  });
  const lag=monitorEventLoopDelay({resolution:10});lag.enable();
  let bytes=0,messages=0,cpu=process.cpuUsage(),start=performance.now();
  let peakRss=process.memoryUsage().rss,maxBufferedBytes=0,processedMoves=0;
  const original=WebSocket.prototype.send;
  WebSocket.prototype.send=function(data,...args){bytes+=Buffer.byteLength(data);messages++;const result=original.call(this,data,...args);maxBufferedBytes=Math.max(maxBufferedBytes,this.bufferedAmount);return result};
  setInterval(()=>{peakRss=Math.max(peakRss,process.memoryUsage().rss)},100).unref();
  const wss=attachMultiplayer(server);
  wss.on('connection',socket=>socket.on('message',raw=>{try{if(JSON.parse(raw).type==='move')processedMoves++}catch{}}));
  process.on('message',m=>{
    if(m==='reset'){bytes=messages=processedMoves=maxBufferedBytes=0;lag.reset();cpu=process.cpuUsage();start=performance.now();peakRss=process.memoryUsage().rss;process.send({reset:true});}
    if(m==='metrics'){
      const used=process.cpuUsage(cpu),elapsedMs=performance.now()-start;
      process.send({metrics:{elapsedMs,bytes,messages,MBps:bytes/elapsedMs/1000,
        cpuOneCorePercent:(used.user+used.system)/elapsedMs/10,
        eventLoopP95Ms:lag.percentile(95)/1e6,eventLoopMaxMs:lag.max/1e6,
        peakRssMB:peakRss/1e6,maxBufferedBytes,processedMoves}});
    }
  });
  server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));
}else{
  const output=resolve('.tools/capacity-audit');await mkdir(output,{recursive:true});
  const ramp=process.argv.includes('--ramp');
  const counts=(process.env.CAPACITY_COUNTS??(ramp?'25,50,60,70,80,90,100,125,150,200':'10,25,50')).split(',').map(Number);
  const durationMs=Number(process.env.CAPACITY_DURATION_MS??(ramp?8000:5000));
  if(counts.some(n=>!Number.isInteger(n)||n<1||n>200)||durationMs<1000||durationMs>60000)throw Error('Counts must be 1..200; duration 1000..60000ms');
  const report={createdAt:new Date().toISOString(),scope:'Local baseline, separate Node server and load generator. Not a browser or WAN certification.',
    host:{cpu:os.cpus()[0]?.model,logicalCpus:os.availableParallelism(),totalMemoryGB:os.totalmem()/1e9},durationMs,
    acceptance:{eventLoopP95Ms:100,cpuOneCorePercent:85,maxBufferedBytes:4194304,minProcessedFraction:.98},scenarios:[]};
  function waitFor(child,key,timeout=15000){return new Promise((ok,fail)=>{
    const timer=setTimeout(()=>finish(new Error(`Timeout: ${key}`)),timeout);
    const onMessage=m=>{if(key in m)finish(null,m[key])};
    const onExit=code=>finish(new Error(`Worker exited: ${code}`));
    function finish(error,value){clearTimeout(timer);child.off('message',onMessage);child.off('exit',onExit);error?fail(error):ok(value)}
    child.on('message',onMessage);child.on('exit',onExit);
  })}
  async function worker(){
    const dir=await mkdtemp(resolve(output,'run-'));
    const child=fork(fileURLToPath(import.meta.url),['--worker'],{env:{...process.env,DATA_DIR:dir,ADMIN_PASSWORD:'audit-only-'+randomUUID()},stdio:['ignore','ignore','inherit','ipc']});
    try{return {child,port:await waitFor(child,'port'),dir}}catch(e){child.kill();throw e}
  }
  for(const n of counts){
    const {child,port}=await worker(),clients=[];let timer,receivedBytes=0,receivedMessages=0,sentMoves=0;
    try{
      for(let i=0;i<n;i++){
        const ws=new WebSocket(`ws://127.0.0.1:${port}/multiplayer`);clients.push(ws);
        ws.on('error',()=>{});
        ws.on('message',raw=>{receivedBytes+=raw.length;receivedMessages++});
        await new Promise((ok,fail)=>{const t=setTimeout(()=>fail(new Error('Connection timeout')),10000);ws.once('open',()=>{clearTimeout(t);ok()});ws.once('error',e=>{clearTimeout(t);fail(e)})});
      }
      await sleep(500);const reset=waitFor(child,'reset');child.send('reset');await reset;
      receivedBytes=receivedMessages=0;const begin=performance.now();let tick=0;
      timer=setInterval(()=>{
        tick++;for(let i=0;i<n;i++)if(clients[i].readyState===1){clients[i].send(JSON.stringify({type:'move',position:[8+i*.1+tick*.001,1.001234,17.002345],yaw:.123456,mode:'stand'}));sentMoves++;}
      },200);
      await sleep(durationMs);clearInterval(timer);timer=null;
      const metrics=waitFor(child,'metrics',30000);child.send('metrics');
      const measured=await metrics;
      const result={clients:n,targetMovesPerClientPerSecond:5,loadGeneratorElapsedMs:performance.now()-begin,sentMoves,receivedBytes,receivedMessages,...measured};
      result.processedFraction=measured.processedMoves/Math.max(1,sentMoves);
      result.generatorMovesPerClientPerSecond=sentMoves/n/(durationMs/1000);
      result.withinLocalLimits=measured.eventLoopP95Ms<=100&&measured.cpuOneCorePercent<=85&&measured.maxBufferedBytes<=4194304&&result.processedFraction>=.98&&result.generatorMovesPerClientPerSecond>=4.5;
      report.scenarios.push(result);console.log(JSON.stringify(result));
      await writeFile(resolve(output,ramp?'ramp-report.json':'report.json'),JSON.stringify(report,null,2));
      if(ramp&&!result.withinLocalLimits){report.stoppedAt=n;report.stopReason='Local latency, CPU, queue, processed-rate or generator limit exceeded';break}
    }finally{clearInterval(timer);child.kill();for(const ws of clients)ws.terminate();}
  }
  // Reproduce a reverse proxy forwarding two distinct public clients over one TCP IP.
  const {child,port}=await worker();
  try{
    const post=(path,ip,body)=>fetch(`http://127.0.0.1:${port}${path}`,{method:'POST',headers:{'Content-Type':'application/json','X-Forwarded-For':ip},body:JSON.stringify(body),signal:AbortSignal.timeout(5000)});
    const statuses=[];
    for(const ip of ['198.51.100.10','198.51.100.20']){const r=await post('/api/wishes',ip,{name:'Audit',message:'Isolated audit only'});statuses.push(r.status);await r.text()}
    const failures=[];for(let i=0;i<5;i++){const r=await post('/api/admin/login','198.51.100.30',{password:'incorrect-audit-password'});failures.push(r.status);await r.text()}
    const other=await post('/api/admin/login','198.51.100.40',{password:'incorrect-audit-password'});await other.text();
    report.proxy={distinctWishClientsStatuses:statuses,firstClientLoginStatuses:failures,secondClientLoginStatus:other.status};
  }finally{child.kill()}
  // Byte model of the exact current full-snapshot protocol; extrapolation, not load measurements.
  report.projections=[500,1000].map(n=>{
    const players=Array.from({length:n},(_,i)=>({id:randomUUID(),position:[8+i*.1+.123456,1.001234,17.002345],yaw:.123456,mode:'stand',seat:null,partner:null,action:null}));
    const snapshotBytes=Buffer.byteLength(JSON.stringify({type:'state',players}));
    return {players:n,snapshotBytes,movesPerSecond:n*5,serverSendsPerSecond:n*n*5,
      totalPayloadBytesPerSecond:snapshotBytes*n*n*5,perClientPayloadBytesPerSecond:snapshotBytes*n*5,
      note:'Assumes all clients report 5 times/sec, no compression, no dropped messages; excludes TCP/TLS/WebSocket overhead.'};
  });
  report.assets={modelBytes:(await stat('public/models/an-duong-school.glb')).size};
  const reportFile=resolve(output,ramp?'ramp-report.json':'report.json');
  await writeFile(reportFile,JSON.stringify(report,null,2));
  console.log('REPORT',reportFile);console.log(JSON.stringify({proxy:report.proxy,projections:report.projections}));
}
