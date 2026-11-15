import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {attachMultiplayer} from './multiplayer.js';
const root=resolve('dist');const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.json':'application/json','.png':'image/png','.jpg':'image/jpeg'};
const server=createServer(async(req,res)=>{try{let path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403).end();return;}if((await stat(path).catch(()=>null))?.isDirectory())path=resolve(path,'index.html');const bytes=await readFile(path);res.writeHead(200,{'Content-Type':mime[extname(path)]??'application/octet-stream'});res.end(bytes);}catch{res.writeHead(404).end('Not found');}});
attachMultiplayer(server);server.listen(Number(process.env.PORT??5173),'0.0.0.0',()=>console.log('School multiplayer listening on port '+(process.env.PORT??5173)));
