import { buildPickingWorkout } from './routines';
export const allPickingIds = () => buildPickingWorkout().map(e=>e.baseId);
export function pickingCoverageRound(sessions, positions) {
 const required=allPickingIds(); let round=1;let covered={};
 for(const s of [...sessions].sort((a,b)=>new Date(a.startedAt)-new Date(b.startedAt))) {
  if(!positions.includes(s.position))continue;
  const records=s.patternsPlayed || (s.complete ? buildPickingWorkout({groups:s.groups || [2,3,4],startStroke:s.startStroke}).map(e=>({id:e.baseId,stroke:e.startStroke})) : []);
  for(const r of records){const key=s.position+r.stroke;covered[key]=new Set([...(covered[key]||[]),r.id]);}
  if(positions.every(p=>['D','U'].every(st=>required.every(id=>covered[p+st]?.has(id))))){round++;covered={};}
 }
 const done=new Set(Object.keys(covered).filter(key=>required.every(id=>covered[key].has(id))));
 return {round,done,target:positions.length*2,covered};
}
