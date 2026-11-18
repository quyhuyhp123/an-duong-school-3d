import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BAYS,BAY_SIZE,nearestBay,setBay} from '../src/bikes.js';
const data=JSON.parse(readFileSync('public/models/campus-data.json','utf8'));
const deck=data.colliders.find(c=>c.name==='Parking yellow deck');
const wall=data.colliders.find(c=>c.name.startsWith('Parking inner parapet'));
const insideEdge=wall.position[0]-wall.halfExtents[0];
const east=BAYS.filter(b=>b.group==='main'&&b.floorY>3&&/^[de]\d+$/.test(b.id));
assert.equal(east.length,38,'keep every upper east parking bay');
for(const prefix of ['d','e'])for(let i=0;i<19;i++)assert(east.some(b=>b.id===prefix+i),'existing bay IDs retained');
for(const b of east){
 const minX=b.x-BAY_SIZE.d/2,maxX=b.x+BAY_SIZE.d/2;
 assert(minX>=deck.position[0]-deck.halfExtents[0]);
 assert(maxX<insideEdge,'whole bay must fit inside the floor, clear of ramp wall');
 assert(minX-46>=2,'retain at least a 2m central aisle');
 const p=nearestBay(b.x,b.floorY+.85,b.z,false);assert.equal(p?.id,b.id,'parking interaction moves with its markings');
 setBay(b.id,true);assert.equal(nearestBay(b.x,b.floorY+.85,b.z,true)?.id,b.id,'bike retrieval uses the moved bay');setBay(b.id,false);
}
console.log('PASS 38 bays retained: full footprint on upper floor, ramp clearance, 2m aisle, matching park/retrieve positions');
