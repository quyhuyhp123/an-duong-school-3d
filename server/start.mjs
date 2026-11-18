// Server chạy thật: website (dist/) + API + WebSocket + giám sát, trên một cổng.
//   npm run build && npm start
// Biến môi trường quan trọng: PORT, ADMIN_PASSWORD, DATA_DIR, MAX_PLAYERS, TRUST_PROXY, CLIENT_IP_HEADER,
// ALLOWED_ORIGINS, METRICS_TOKEN — xem DEPLOY.md.
import {createServer} from 'node:http';
import {performance} from 'node:perf_hooks';
import {attachMultiplayer} from './multiplayer.js';
import {handleWishes} from './wishes.js';
import {handleBasketball} from './basketball.js';
import {handleAdmin,announceAdmin} from './admin.js';
import {handleMetrics,metrics,startMonitorLog} from './metrics.js';
import {createStatic} from './static.js';
import {handleMedia} from './music.js';
import {applyCors} from './net.js';
import {checkDb} from './db.js';

const serveStatic=createStatic('dist');
const route=url=>url.startsWith('/api/admin')?'admin':url.startsWith('/api/wishes')?'wishes':url.startsWith('/api/')?'api':'static';

const server=createServer(async(req,res)=>{
 const t0=performance.now(),r=route(req.url??'/');
 res.on('finish',()=>{if(r!=='static'||res.statusCode>=500)metrics.http(r,performance.now()-t0,res.statusCode);});
 try{
  if(/^\/(api|media)\//.test(req.url??'')&&applyCors(req,res))return; // trang web trên tên miền khác (Cloudflare Pages)
  if(/^\/admin\/?$/.test(req.url)){res.writeHead(302,{Location:'/admin.html'}).end();return;}
  if(handleMetrics(req,res))return;
  if(await handleMedia(req,res))return;
  if(await handleAdmin(req,res)||await handleWishes(req,res)||await handleBasketball(req,res))return;
  await serveStatic(req,res);
 }catch(e){console.error('[http]',e);if(!res.headersSent)res.writeHead(500).end('Server error');else res.destroy();}
});
// Giữ kết nối HTTP lâu hơn timeout mặc định của load balancer để tránh lỗi 502 ngắt quãng
server.keepAliveTimeout=65000;server.headersTimeout=66000;server.requestTimeout=300000; // 5 phút: đủ cho admin tải file nhạc lớn qua mạng chậm

checkDb();
attachMultiplayer(server);
startMonitorLog();
const port=Number(process.env.PORT??5173);
server.listen(port,'0.0.0.0',()=>{console.log('School server listening on port '+port);announceAdmin(port);});

// Tắt êm khi hosting gửi tín hiệu dừng (deploy bản mới): ngừng nhận kết nối, để dữ liệu đang ghi hoàn tất
for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{console.log(`[server] nhận ${sig}, đang tắt…`);server.close();setTimeout(()=>process.exit(0),3000).unref();});
