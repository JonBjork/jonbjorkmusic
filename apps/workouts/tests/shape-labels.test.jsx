import {scaleShapeLabel} from '../../../packages/workouts/engine/workouts/CurrentRoomShape';
import {buildNps,NPS_SCALES} from '../../../packages/workouts/engine/workouts/npsData';
import {buildSweep} from '../../../packages/workouts/engine/workouts/sweepData';
test('A melodic minor starts at shape 6 and moves to shape 7',()=>{
 const {pairs}=buildNps({scale:'melodic'});
 expect(scaleShapeLabel(pairs[0].lower,9,'A melodic minor',NPS_SCALES.melodic.intervals)).toBe('A melodic minor · Shape #6');
 expect(scaleShapeLabel(pairs[0].upper,9,'A melodic minor',NPS_SCALES.melodic.intervals)).toBe('A melodic minor · Shape #7');
});
test.each([false,true])('arpeggios preserve roots and inversion labels in all twelve keys (five=%s)',five=>{
 for(let key=0;key<12;key++)for(const p of buildSweep({key,five,bpm:30,subdivision:1}).passages)for(const shape of p.shapes){
 expect(shape.root).toBeGreaterThanOrEqual(0);expect(shape.root).toBeLessThan(12);
 expect(shape.notes.some(n=>n.midi[0]%12===shape.root)).toBe(true);
 const interval=(Math.min(...shape.notes.map(n=>n.midi[0]))-shape.root+120)%12;
 expect(shape.label.endsWith(interval===0?'Root position':interval===7?'Second inversion':'First inversion')).toBe(true);
 }
});
