import assert from 'node:assert/strict';
import {buildPlan,defaultSettings,hammerFingerings,remaining,freshState,validateState,mergeState} from '../../student-workouts/model.js';
import config from '../../student-workouts/students/lukebolton.js';
const p=buildPlan(config,defaultSettings);
assert.equal(new Set(hammerFingerings.map(x=>x.join(''))).size,24);
assert.equal(p.blocks.length,175);assert(Math.abs(remaining(p,0)-4072)<1e-8);assert.equal(remaining(p,p.length),0);
for(const b of p.blocks){assert(b.notes.every(n=>n.fret>=1&&n.fret<=21));if(b.kind==='hammers'){assert.equal(b.notes.length,36);assert(b.notes.every(n=>n.stroke==='H'));assert.equal(b.notes.filter(n=>n.string===1).length,6);}else{for(let i=1;i<b.notes.length;i++)assert.notEqual(b.notes[i].stroke,b.notes[i-1].stroke);}}
const three=p.blocks.find(b=>b.kind==='picking'&&b.fingering==='123');assert.notEqual(three.notes[0].stroke,three.notes[9].stroke);assert.equal(three.notes[48].fret,4);
const four=p.blocks.find(b=>b.kind==='picking'&&b.fingering==='1234');assert.equal(four.notes.at(-1).len,12);assert.equal(remaining({blocks:[four]},four.start+four.length-12),4);
assert.equal(buildPlan(config,defaultSettings,1).blocks[120].stroke,'U');assert.equal(p.blocks[131].stroke,'U');
const a=freshState('lukebolton');a.events=[{id:'test',day:'2026-09-07',seconds:1,notes:3,kind:'picking',position:1,fingering:'123',bpm:60,stroke:'D',completed:false}];
assert.deepEqual(validateState(a,'lukebolton',p.length),a);assert.equal(mergeState(a,a).events.length,1);
const b=structuredClone(a);b.events[0].seconds=4;b.checkpoint.cursor=5;b.checkpoint.updatedAt='2099-01-01T00:00:00Z';assert.equal(mergeState(a,b).events[0].seconds,4);assert.equal(mergeState(a,b).checkpoint.cursor,5);
assert.throws(()=>validateState({...a,student:'other'},'lukebolton',p.length));assert.throws(()=>validateState({...a,checkpoint:{...a.checkpoint,cursor:-1}},'lukebolton',p.length));assert.throws(()=>validateState({...a,events:[{...a.events[0],seconds:-1}]},'lukebolton',p.length));
console.log('PASS: score structure, strict picking, triplet parity, final hold, durations, checkpoint validation and duplicate-safe backup merge.');
