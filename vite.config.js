import {defineConfig} from 'vite';
import {attachMultiplayer} from './server/multiplayer.js';
export default defineConfig({plugins:[{name:'school-multiplayer',configureServer(server){return ()=>attachMultiplayer(server.httpServer)}}]});
