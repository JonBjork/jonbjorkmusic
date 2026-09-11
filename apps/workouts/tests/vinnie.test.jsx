import {fresh,validate,merge,counts,completedDays,emptyRow,recordGroup,read,dateKey} from '../../vinnie/src/tracking';
import {EXERCISES,buildChromatic} from '../../vinnie/src/chromaticData';
import fs from 'fs';
import path from 'path';
test('standalone Vinnie musical data and cover are exact Practice Lab copies',()=>{
 const root=path.resolve(__dirname,'../../..');
 for(const name of ['chromaticData.js','vinnieScaleSequences.json','TabView.jsx','CurrentRoomShape.jsx','chromatic-workout.css'])expect(fs.readFileSync(path.join(root,'apps/vinnie/src',name))).toEqual(fs.readFileSync(path.join(root,'../practice-lab/src/workouts',name)));
 expect(fs.readFileSync(path.join(root,'vinnie/cover.png'))).toEqual(fs.readFileSync(path.join(root,'../practice-lab/public/workouts/vinnie-moore-picking-cover.png')));
 expect(EXERCISES).toHaveLength(12);expect(EXERCISES.every(e=>buildChromatic(e).notes.length>0)).toBe(true);
});
test('Vinnie backup validates, merges and keeps skipped positions unfinished',()=>{
 const a=fresh(),b=fresh();a.days['2026-09-11']=emptyRow();b.days['2026-09-11']=emptyRow();
 a.days['2026-09-11'][0]=[0,1];b.days['2026-09-11'][0]=[1,5];
 const merged=merge(a,b);expect(merged.days['2026-09-11'][0]).toEqual([0,1,5]);expect(completedDays(merged)).toEqual([]);
 const complete=fresh();complete.days['2026-09-11']=counts.map(n=>Array.from({length:n},(_,i)=>i));expect(completedDays(validate(complete))).toEqual(['2026-09-11']);
 expect(()=>validate({...a,app:'jb-sweeps'})).toThrow();
 expect(()=>validate({...a,days:{'2026-02-30':emptyRow()}})).toThrow();
 const bad=fresh();bad.days['2026-09-11']=emptyRow();bad.days['2026-09-11'][0]=[counts[0]];expect(()=>validate(bad)).toThrow();
});
test('Vinnie saves independently and repeated groups never double count',()=>{
 localStorage.clear();localStorage.setItem('jb-sweeps-v1','untouched');localStorage.setItem('workouts.log','untouched');
 recordGroup(EXERCISES[0].id,0);recordGroup(EXERCISES[0].id,0);recordGroup(EXERCISES[0].id,4);
 expect(read().days[dateKey()][0]).toEqual([0,4]);expect(localStorage.getItem('jb-sweeps-v1')).toBe('untouched');expect(localStorage.getItem('workouts.log')).toBe('untouched');
});
