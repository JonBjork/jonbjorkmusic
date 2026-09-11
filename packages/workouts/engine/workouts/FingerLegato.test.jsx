import {buildFingerLegato,buildRoutine} from './fingerLegatoData';
test('preserves all original combinations, repetitions and string visits',()=>{
 const original=buildRoutine().flatMap(s=>s.exercises);
 const actual=buildFingerLegato({groups:['two','three','four']});
 expect(actual).toHaveLength(60);
 actual.forEach((p,i)=>expect(p.notes.map(n=>[n.string,n.fret])).toEqual(original[i].notes.map(n=>[n.string,n.fret])));
});
test('transposes frets and sound together, with an articulation for every note',()=>{
 const passages=buildFingerLegato({position:9});
 passages.forEach(p=>p.notes.forEach(n=>{expect(n.fret).toBeGreaterThanOrEqual(9);expect(n.fret).toBeLessThanOrEqual(12);expect(n.stroke||n.legato).toBeTruthy();}));
 expect(passages[0].notes[0].midi).toEqual([49]);
 expect(passages[0].notes.filter(n=>n.stroke).map(n=>n.stroke)).toEqual(['D','D','D','D','D','D','U','U','U','U','U']);
});
test('all hammers has no pick attacks or connecting slurs',()=>{
 buildFingerLegato({mode:'hammers'}).forEach(p=>p.notes.forEach(n=>{expect(n.legato).toBe('H');expect(n.stroke).toBeUndefined();expect(n.detachedHammer).toBe(true);}));
});
