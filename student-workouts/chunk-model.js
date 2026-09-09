export const stages = [1, 2, 3, 4, 'whole'];
export const stageLabel = size => size === 'whole' ? 'Whole piece' : `${size} chunk${size === 1 ? '' : 's'}`;
export const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export function buildGroups(score, size) {
  const width = size === 'whole' ? score.chunkCount : size;
  return Array.from({length: score.chunkCount-width+1}, (_, start) => {
    const from = start === 0 ? 0 : score.pickupTicks + start*score.chunkTicks;
    const boundary = score.pickupTicks + (start+width)*score.chunkTicks;
    // Include exactly one landing note, retaining its original duration.
    const landing = score.notes.find(n => n.at >= boundary);
    const notes = score.notes.filter(n => n.at >= from && (n.at < boundary || n === landing)).map(n => ({...n, sourceAt:n.at, at:n.at-from}));
    const length = notes.at(-1).at + notes.at(-1).len;
    return {id:`${size}:${start}`,size,start,end:start+width-1,notes,length,pickup:start===0,
      label:size==='whole'?'Whole piece':width===1?`Chunk ${start+1}`:`Chunks ${start+1}–${start+width}`};
  });
}
// Whole-beat cycles keep the pickup on the final triplet before the downbeat.
export function cycleLayout(group, sub=3) {
  const musicStart = 4*sub - (group.pickup ? 1 : 0);
  return {musicStart,musicEnd:musicStart+group.length,length:Math.ceil((musicStart+group.length)/sub)*sub};
}
export function freshChunkState(student,score) {
  return {format:'jonbjork-chunk-workout',version:1,student,score:score.id,updatedAt:new Date().toISOString(),
    stage:1,start:0,settings:{bpm:score.bpm,timerSeconds:120,tone:'electric',instrumentOn:true,instrumentVolume:65,metronomeOn:true,metronomeVolume:65,subdivisions:false},progress:{},events:[]};
}
export function validateChunkState(data,student,score) {
  const fail=()=>{throw Error('This is not a compatible practice backup for this student.');};
  if(!data || data.format!=='jonbjork-chunk-workout'||data.version!==1||data.student!==student||data.score!==score.id||!Number.isFinite(Date.parse(data.updatedAt)))fail();
  if(!stages.includes(data.stage)||!Number.isInteger(data.start)||!buildGroups(score,data.stage)[data.start])fail();
  const s=data.settings;
  if(!s||!Number.isInteger(s.bpm)||s.bpm<20||s.bpm>200||!Number.isFinite(s.timerSeconds)||s.timerSeconds<30||s.timerSeconds>1200||!['electric','nylon','piano','harpsichord'].includes(s.tone))fail();
  if(!['instrumentOn','metronomeOn','subdivisions'].every(k=>typeof s[k]==='boolean')||!['instrumentVolume','metronomeVolume'].every(k=>Number.isFinite(s[k])&&s[k]>=0&&s[k]<=100))fail();
  const ids=new Set(stages.flatMap(n=>buildGroups(score,n).map(g=>g.id)));
  if(!data.progress||typeof data.progress!=='object'||Array.isArray(data.progress))fail();
  for(const [id,p] of Object.entries(data.progress)){if(!ids.has(id)||!p||!Number.isFinite(p.elapsed)||p.elapsed<0||p.elapsed>3600||typeof p.done!=='boolean'||!Number.isFinite(Date.parse(p.updatedAt)))fail();}
  if(!Array.isArray(data.events)||data.events.length>200000)fail();
  const seen=new Set();
  for(const e of data.events){
    if(!e||typeof e.id!=='string'||!e.id.length||e.id.length>100||seen.has(e.id)||!ids.has(e.group)||!/^\d{4}-\d{2}-\d{2}$/.test(e.day)||!Number.isFinite(Date.parse(e.day))||!Number.isFinite(e.seconds)||e.seconds<0||e.seconds>86400||!Number.isInteger(e.repetitions)||e.repetitions<0||e.repetitions>100000||!Number.isInteger(e.completions)||e.completions<0||e.completions>10000||!Number.isInteger(e.bpm)||e.bpm<20||e.bpm>200)fail();
    seen.add(e.id);
  }
  return structuredClone(data);
}
export function mergeChunkState(current,incoming) {
  const latest=Date.parse(incoming.updatedAt)>Date.parse(current.updatedAt)?incoming:current;
  const progress={...current.progress};
  for(const [id,p] of Object.entries(incoming.progress))if(!progress[id]||Date.parse(p.updatedAt)>Date.parse(progress[id].updatedAt))progress[id]=p;
  const events=new Map(current.events.map(e=>[e.id,e]));
  for(const e of incoming.events){const old=events.get(e.id);events.set(e.id,old?{...old,seconds:Math.max(old.seconds,e.seconds),repetitions:Math.max(old.repetitions,e.repetitions),completions:Math.max(old.completions,e.completions)}:e);}
  return {...latest,progress,events:[...events.values()]};
}
