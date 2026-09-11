export function focusPassages(data,mode,sequence){return mode==='focus'?{...data,passages:data.passages.filter(p=>p.sequence===sequence)}:data;}
export function completedFocusSequences(sessions,context,count,positions){
 const coverage=Array.from({length:count},()=>new Set());
 sessions.forEach(s=>{
  if(s.practiceMode!=='focus'||!Object.entries(context).every(([k,v])=>s[k]===v))return;
  if(!Number.isInteger(s.focusSequence)||!coverage[s.focusSequence])return;
  (s.completedPositions||[]).forEach(p=>{if(Number.isInteger(p)&&p>=0&&p<positions)coverage[s.focusSequence].add(p);});
 });
 return coverage.map(p=>p.size===positions);
}
