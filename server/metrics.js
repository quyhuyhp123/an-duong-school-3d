// Giám sát: số người online, độ trễ vòng lặp sự kiện, thời gian mỗi tick, băng thông, hàng đợi gửi, bộ nhớ, API.
// /healthz  → JSON ngắn cho bộ kiểm tra sống/chết của hosting
// /metrics  → định dạng Prometheus (Grafana, Uptime Kuma, Better Stack… đọc được).
//             Cần METRICS_TOKEN (Bearer hoặc ?token=) nếu đặt; nếu không đặt chỉ cho truy cập từ máy chủ (localhost).
import {monitorEventLoopDelay} from 'node:perf_hooks';
import {clientIp} from './net.js';

const loop=monitorEventLoopDelay({resolution:10});loop.enable();
const started=Date.now();
const counters={bytesOut:0,messagesOut:0,bytesIn:0,messagesIn:0,snapshotsSkippedBackpressure:0,slowClientsDropped:0,rateLimitedMessages:0,rejectedFull:0,rejectedOrigin:0,heartbeatTimeouts:0,connectionsTotal:0,chatMessages:0,storageErrors:0};
const gauges={players:0,maxBufferedBytes:0,entitiesPerSnapshotAvg:0};
const http=new Map(); // route → {count, errors, durations[]}
const tickTimes=new Float64Array(600);let tickIdx=0,tickCount=0;

export const metrics={
 count(name,n=1){counters[name]=(counters[name]??0)+n;},
 gauge(name,v){gauges[name]=v;},
 tick(ms){tickTimes[tickIdx]=ms;tickIdx=(tickIdx+1)%tickTimes.length;tickCount++;},
 http(route,ms,status){let h=http.get(route);if(!h){h={count:0,errors:0,d:[]};http.set(route,h);}h.count++;if(status>=500)h.errors++;h.d.push(ms);if(h.d.length>500)h.d.shift();},
 snapshot(){
  const ticks=Array.from(tickTimes.subarray(0,Math.min(tickCount,tickTimes.length))).sort((a,b)=>a-b),mem=process.memoryUsage();
  const pct=(arr,p)=>arr.length?arr[Math.min(arr.length-1,Math.floor(arr.length*p))]:0;
  return {
   uptimeSec:Math.round((Date.now()-started)/1000),players:gauges.players,
   eventLoopP95Ms:+(loop.percentile(95)/1e6).toFixed(1),eventLoopMaxMs:+(loop.max/1e6).toFixed(1),
   tickP50Ms:+pct(ticks,.5).toFixed(2),tickP95Ms:+pct(ticks,.95).toFixed(2),tickMaxMs:+(ticks.at(-1)??0).toFixed(2),
   rssMB:Math.round(mem.rss/1e6),heapMB:Math.round(mem.heapUsed/1e6),
   ...counters,...gauges,
   http:Object.fromEntries([...http].map(([k,h])=>{const d=[...h.d].sort((a,b)=>a-b);return [k,{count:h.count,errors:h.errors,p95Ms:+pct(d,.95).toFixed(1)}];})),
  };
 },
 resetLoop(){loop.reset();},
 resetWindow(){loop.reset();tickCount=0;tickIdx=0;}, // dùng khi đo theo từng giai đoạn (kiểm thử tải)
};

// Tốc độ (byte/giây) tính theo cửa sổ 10 giây — dùng cho log và trang quản lý
let lastRate={at:Date.now(),bytesOut:0,bytesIn:0},rates={bytesOutPerSec:0,bytesInPerSec:0};
setInterval(()=>{const now=Date.now(),s=(now-lastRate.at)/1000;rates={bytesOutPerSec:Math.round((counters.bytesOut-lastRate.bytesOut)/s),bytesInPerSec:Math.round((counters.bytesIn-lastRate.bytesIn)/s)};lastRate={at:now,bytesOut:counters.bytesOut,bytesIn:counters.bytesIn};},10000).unref();
export const rateSnapshot=()=>rates;

function prometheus(){
 const s={...metrics.snapshot(),...rates},lines=[];
 for(const [k,v] of Object.entries(s)){if(typeof v!=='number')continue;const name='school_'+k.replace(/[A-Z]/g,c=>'_'+c.toLowerCase());lines.push(`# TYPE ${name} ${k in counters?'counter':'gauge'}`,`${name} ${v}`);}
 for(const [route,h] of Object.entries(s.http)){lines.push(`school_http_requests_total{route="${route}"} ${h.count}`,`school_http_errors_total{route="${route}"} ${h.errors}`,`school_http_p95_ms{route="${route}"} ${h.p95Ms}`);}
 return lines.join('\n')+'\n';
}
export function handleMetrics(req,res){
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/healthz'){const s=metrics.snapshot();res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({ok:true,players:s.players,uptimeSec:s.uptimeSec,eventLoopP95Ms:s.eventLoopP95Ms}));return true;}
 if(url.pathname!=='/metrics')return false;
 const token=process.env.METRICS_TOKEN;
 const given=(req.headers.authorization??'').replace(/^Bearer\s+/i,'')||url.searchParams.get('token');
 const local=['127.0.0.1','::1','localhost'].includes(String(req.socket.remoteAddress).replace(/^::ffff:/,''))&&!req.headers['x-forwarded-for'];
 if(token?given!==token:!local){res.writeHead(403).end('forbidden');return true;}
 res.writeHead(200,{'Content-Type':'text/plain; version=0.0.4','Cache-Control':'no-store'});res.end(prometheus());return true;
}

// Một dòng log tóm tắt mỗi phút khi có người online (tắt bằng MONITOR_LOG=0)
export function startMonitorLog(intervalMs=60000){
 if(process.env.MONITOR_LOG==='0')return;
 setInterval(()=>{const s=metrics.snapshot();if(!s.players&&!s.connectionsTotal)return;
  console.log(`[monitor] online=${s.players} loopP95=${s.eventLoopP95Ms}ms tickP95=${s.tickP95Ms}ms out=${(rates.bytesOutPerSec/1e6).toFixed(2)}MB/s in=${(rates.bytesInPerSec/1e3).toFixed(0)}KB/s rss=${s.rssMB}MB skipped=${s.snapshotsSkippedBackpressure} slowDropped=${s.slowClientsDropped} rateLimited=${s.rateLimitedMessages}`);
  metrics.resetLoop();},intervalMs).unref();
}
export {clientIp};
