import assert from 'node:assert/strict';
import {wheelieTransform,isWheelie,WHEELIE_FLAG} from '../src/bikeWheelie.js';
import {encodeMove,decodeMove,modeCode,danceOf} from '../src/protocol.js';
for(const amount of [0,.2,.5,1]){
 const p=wheelieTransform(amount),s=Math.sin(p.pitch),c=Math.cos(p.pitch);
 assert(Math.abs(.3*c+.58*s+p.y-.3)<1e-10,'rear wheel height stays fixed');
 assert(Math.abs(.3*s-.58*c+p.z+.58)<1e-10,'rear wheel stays fixed along the ground');
 if(amount>0)assert(.3*c-.58*s+p.y>.3,'front wheel must lift above ground');
}
const riding=modeCode('stand',false,7)|WHEELIE_FLAG;
const move=decodeMove(new DataView(encodeMove(1,1,1,0,riding)));
assert(isWheelie(move.mode));assert.equal(danceOf(move.mode),7,'wheelie remains a bicycle for passenger controls');
assert(!isWheelie(decodeMove(new DataView(encodeMove(1,1,1,0,WHEELIE_FLAG))).mode),'walking cannot retain wheelie flag');
assert.deepEqual(wheelieTransform(0),{pitch:-0,y:0,z:0});
console.log('PASS wheelie pivot: rear wheel grounded, front wheel lifts, smooth zero pose, binary flag round-trip, walking flag rejection');
