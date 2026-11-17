import {defineConfig} from 'vite';
import {resolve} from 'node:path';
import {attachMultiplayer} from './server/multiplayer.js';
import {handleWishes} from './server/wishes.js';
import {handleBasketball} from './server/basketball.js';
import {handleAdmin,announceAdmin} from './server/admin.js';
import {handleMetrics} from './server/metrics.js';
import {handleMedia} from './server/music.js';

// CDN: đặt ASSET_BASE_URL khi build (VD: https://cdn.anduong.edu.vn/) để JS/CSS/ảnh/model tải từ CDN.
// API (/api) và WebSocket (/multiplayer) vẫn đi thẳng về server gốc.
const base=process.env.ASSET_BASE_URL?process.env.ASSET_BASE_URL.replace(/\/?$/,'/'):'/';
export default defineConfig({
 base,
 // Không theo dõi dữ liệu chạy thật (data/) và thư mục công cụ (.tools/): file ghi liên tục / bị khoá trên Windows có thể làm server dev sập
 server:{watch:{ignored:['**/data/**','**/.tools/**','**/dist/**']}},
 build:{rollupOptions:{input:{main:resolve('index.html'),admin:resolve('admin.html')}}},
 plugins:[{name:'school-multiplayer',configureServer(server){
  server.middlewares.use(async(req,res,next)=>{
   if(req.url==='/admin'||req.url==='/admin/'){res.writeHead(302,{Location:'/admin.html'}).end();return;}
   if(handleMetrics(req,res))return;
   if(await handleMedia(req,res))return;
   if(await handleAdmin(req,res)||await handleWishes(req,res)||await handleBasketball(req,res))return;next();
  });
  server.httpServer?.once('listening',()=>announceAdmin(server.httpServer.address()?.port));
  return ()=>attachMultiplayer(server.httpServer)}}]});
