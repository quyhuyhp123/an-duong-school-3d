import assert from 'node:assert/strict';
import {STAGE_DANCE,shouldStopForEvent,dancePose} from '../src/dances.js';
for(const event of [null,'none','teachers','campfire','dj']){
 assert.equal(shouldStopForEvent(STAGE_DANCE,event),false,'Stage dance must survive non-DJ events');
 for(const dance of [1,2,3])assert.equal(shouldStopForEvent(dance,event),event!=='dj');
 assert.equal(shouldStopForEvent(0,event),false);
}
const a={},b={};dancePose(STAGE_DANCE,1,a);dancePose(STAGE_DANCE,2.5,b);
assert.notDeepEqual(a,b,'Stage choreography must animate over time');
console.log('PASS stage choreography continues without DJ; DJ dances stop with their event; stage pose animates');
