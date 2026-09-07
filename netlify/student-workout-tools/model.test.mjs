import assert from 'node:assert/strict';
import {buildPlan,defaultSettings,hammerFingerings,remaining,freshState,validateState,mergeState} from '../../student-workouts/model.js';
import config from '../../student-workouts/students/lukebolton.js';
const p=buildPlan({...config,exercises:config.exercises.slice(0,2)},defaultSettings);
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

const full=buildPlan(config,defaultSettings),deep=full.blocks.filter(b=>b.kind==='deepdive'&&b.section==='six-string-shapes');
assert.equal(deep.length,22);assert.deepEqual(deep.filter(b=>!b.high).map(b=>b.position),[1,3,5,7,8,10,12,13,15,17,19]);
assert.equal(deep[0].shape.degree,4);assert.equal(deep[8].shape.degree,1);assert.equal(deep.at(-1).shape.degree,7);
for(const b of deep){assert.equal(b.bpm,80);assert.equal(b.sub,1);assert.equal(b.length,35);assert.equal(b.notes[0].stroke,'D');assert.equal(b.notes[0].midi,b.notes.at(-1).midi);assert.equal(new Set(b.notes.map(n=>`${n.string}:${n.fret}`)).size,18);for(let i=1;i<b.notes.length;i++)assert.notEqual(b.notes[i].stroke,b.notes[i-1].stroke);assert(b.notes.every(n=>n.fret>=1&&n.fret<=24));}
assert.equal(remaining({blocks:deep},deep[0].start),577.5);
const checkpoint= freshState('lukebolton');checkpoint.activeWorkout='deepdive';checkpoint.checkpoint.cursor=deep[0].start;checkpoint.progress={deepdive:{...checkpoint.checkpoint}};assert.equal(validateState(checkpoint,'lukebolton',full.length).activeWorkout,'deepdive');
console.log('PASS: 11 C-major shapes, root-relative numbering, 22 downstroke-start return passages, quarter-note durations and Deep Dive backup support.');

const pairs=full.blocks.filter(b=>b.section==='two-string-shapes');assert.equal(pairs.length,5);assert.deepEqual(pairs.map(b=>b.position),[2,3,4,5,6]);assert.deepEqual(pairs.map(b=>b.length),[144,132,144,144,144]);
for(const b of pairs){assert.equal(b.bpm,80);assert.equal(b.sub,1);assert.equal(b.notes[0].stroke,'D');assert.equal(b.notes[b.turnaround].stroke,'D');assert.deepEqual(b.notes.slice(b.turnaround).map(n=>[n.string,n.fret]),b.notes.slice(0,b.turnaround).toReversed().map(n=>[n.string,n.fret]));for(let i=1;i<b.notes.length;i++)assert.notEqual(b.notes[i].stroke,b.notes[i-1].stroke);for(const shape of b.shapes)assert.equal(shape.rows.flat().length,6);}
assert.equal(remaining({blocks:pairs},pairs[0].start),531);assert.deepEqual(pairs[0].notes.slice(0,6).map(n=>[n.string,n.fret]),[[2,1],[2,3],[2,5],[1,1],[1,3],[1,5]]);
console.log('PASS: exact two-string score order, five pairs, six-note shapes, downstroke turnaround and 8:51 playing time.');
const singles=full.blocks.filter(b=>b.section==='single-string');assert.equal(singles.length,6);assert.deepEqual(singles.map(b=>b.position),[1,2,3,4,5,6]);
for(const b of singles){assert.equal(b.length,72);assert.equal(b.sub,1);assert.equal(b.bpm,80);assert.equal(b.shapes.length,24);for(let i=1;i<b.notes.length;i++)assert.notEqual(b.notes[i].stroke,b.notes[i-1].stroke);assert.deepEqual(b.notes.slice(36).map(n=>n.fret),b.notes.slice(0,36).toReversed().map(n=>n.fret));}
assert.deepEqual(singles[0].notes.slice(0,9).map(n=>n.fret),[1,3,5,3,5,7,5,7,8]);assert.deepEqual(singles[0].notes.slice(36,42).map(n=>n.fret),[24,22,20,22,20,19]);assert.equal(remaining({blocks:singles},singles[0].start),324);
console.log('PASS: six single-string fret maps, exact overlapping threes, continuous alternate picking and 5:24 playing time.');
const planting=full.blocks.filter(b=>b.section==='picking-hand-focus');assert.equal(planting.length,43);assert.deepEqual(planting.map(b=>b.position),[...Array.from({length:22},(_,i)=>i+1),...Array.from({length:21},(_,i)=>21-i)]);
assert.deepEqual(planting[0].notes.filter((_,i)=>i%3===0).map(n=>[n.string,n.fret]),[[6,1],[5,3],[4,1],[3,3],[2,1],[1,3]]);assert.deepEqual(planting[1].notes.filter((_,i)=>i%3===0).map(n=>[n.string,n.fret]),[[1,4],[2,2],[3,4],[4,2],[5,4],[6,2]]);
for(const b of planting){assert.equal(b.sub,3);assert.equal(b.bpm,50);assert.equal(b.gateSeconds,0.06);assert.equal(b.notes.length,18);assert(b.notes.every(n=>n.fret>=1&&n.fret<=24));for(let i=1;i<18;i++)assert.notEqual(b.notes[i].stroke,b.notes[i-1].stroke);}
assert(Math.abs(remaining({blocks:planting},planting[0].start)-309.6)<1e-8);
console.log('PASS: planting score opening, half-step route up and back, triplet timing and 60 ms note gate.');
