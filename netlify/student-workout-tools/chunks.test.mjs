import assert from 'node:assert/strict';
import score from '../../student-workouts/love-gun-score.js';
import {buildGroups,cycleLayout,stages,freshChunkState,validateChunkState,mergeChunkState} from '../../student-workouts/chunk-model.js';
import {chunkNotation} from '../../student-workouts/chunk-notation.js';
assert.equal(score.notes.length,38);
assert.deepEqual(score.notes[0],{at:0,string:6,fret:12,len:1,midi:52,stroke:'U'});
assert.equal(score.notes.at(-1).len,12);
assert.equal(score.notes.at(-1).midi,83);
assert.deepEqual(stages.map(s=>buildGroups(score,s).length),[6,5,4,3,1]);
const singles=buildGroups(score,1);
assert.equal(singles[0].notes.length,8); // pickup, six notes, landing
assert.equal(singles[1].notes.length,7);
assert.equal(singles.at(-1).notes.at(-1).len,12);
assert.deepEqual(singles[0].notes.map(n=>[n.string,n.fret]),[[6,12],[5,10],[6,12],[5,10],[5,12],[5,10],[5,12],[5,14]]);
for(const size of stages){
 for(const g of buildGroups(score,size)){
  const expected=score.notes.filter(n=>n.at>=(g.start===0?0:1+g.start*6)&&n.at<=1+(g.end+1)*6);
  assert.deepEqual(g.notes.map(n=>n.sourceAt),expected.map(n=>n.at));
  g.notes.forEach((n,i)=>{if(i)assert.notEqual(n.stroke,g.notes[i-1].stroke);});
  const layout=cycleLayout(g);assert.equal(layout.length%3,0);
  const downbeat=g.notes.find(n=>(n.sourceAt-1)%3===0);
  assert.equal((layout.musicStart+downbeat.at)%3,0);
  const notation=chunkNotation(g,score);
  assert.equal((notation.match(/data-note=/g)||[]).length,g.notes.length);
  // Model the scheduler: count-ins/padding never count, final note always completes.
  let musicTicks=0,finishTick;
  for(let t=0;t<10000;t++){
   const pos=t%layout.length;
   if(pos>=layout.musicStart&&pos<layout.musicEnd)musicTicks++;
   if(pos===layout.musicEnd-1&&musicTicks/3>=120){finishTick=t;break;}
  }
  assert.ok(finishTick);assert.ok(musicTicks/3>=120);assert.ok(musicTicks/3<120+g.length/3);
  assert.equal(musicTicks%g.length,0);
 }
}
const state=freshChunkState('vincentstagliano',score);
state.progress['1:0']={elapsed:32.5,done:false,updatedAt:state.updatedAt};
state.events=[{id:'test',day:'2026-09-09',group:'1:0',bpm:60,seconds:32.5,repetitions:4,completions:0}];
assert.deepEqual(validateChunkState(JSON.parse(JSON.stringify(state)),'vincentstagliano',score),state);
assert.equal(mergeChunkState(state,state).events.length,1);
assert.equal(mergeChunkState(state,state).progress['1:0'].elapsed,32.5);
assert.throws(()=>validateChunkState(state,'lukebolton',score));
const bad=structuredClone(state);bad.progress['__proto__']={elapsed:2};assert.throws(()=>validateChunkState({...bad,stage:7},'vincentstagliano',score));
const corrupted=structuredClone(state);corrupted.events[0].seconds=-1;assert.throws(()=>validateChunkState(corrupted,'vincentstagliano',score));
console.log('PASS: exact GP notes, pickup, 19 overlapping groups, landing durations, strict strokes, beat alignment, music-only timers, notation coverage and student-specific backup validation/merge.');
