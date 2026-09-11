import {focusPassages,completedFocusSequences} from '../../../packages/workouts/engine/workouts/sequenceFocus';
import {buildNps} from '../../../packages/workouts/engine/workouts/npsData';
import {buildLegato} from '../../../packages/workouts/engine/workouts/legatoData';
test.each([buildNps,buildLegato])('focus preserves original notes and articulation in position order',build=>{
 const full=build({});const focus=focusPassages(full,'focus',3);
 expect(focus.passages).toHaveLength(full.pairs.length);
 focus.passages.forEach((p,i)=>{expect(p.position).toBe(i);expect(p.sequence).toBe(3);expect(p).toBe(full.passages.find(n=>n.sequence===3&&n.position===i));});
 expect(focusPassages(full,'full',3)).toBe(full);
});
test('completion merges partial sessions, isolates settings and requires every position',()=>{
 const context={workoutId:'chops-3nps-1',bpm:80,key:'C / A minor',scale:'natural',notesPerBeat:2,frets:24,startStroke:'D'};
 const session={...context,practiceMode:'focus',focusSequence:0};
 const sessions=[{...session,completedPositions:[0,1]},{...session,completedPositions:[1,2]}];
 expect(completedFocusSequences(sessions,context,11,3)[0]).toBe(true);
 expect(completedFocusSequences(sessions,{...context,bpm:90,notesPerBeat:4},11,3)[0]).toBe(true);
 expect(completedFocusSequences(sessions,context,11,4)[0]).toBe(false);
 expect(completedFocusSequences([{...session,practiceMode:'full',completedPositions:[0,1,2]}],context,11,3)[0]).toBe(false);
});

test('historical completions and partial positions count across tempos without modifying the log',()=>{
 const context={workoutId:'chops-3nps-1',key:'A harmonic minor',scale:'harmonic',frets:24,startStroke:'D',bpm:120,notesPerBeat:4};
 const sessions=[{...context,bpm:80,notesPerBeat:3,practiceMode:'focus',focusSequence:5,completedPositions:[0,1]},{...context,bpm:60,notesPerBeat:2,practiceMode:'focus',focusSequence:5,completedPositions:[2]}];
 const original=JSON.stringify(sessions);
 expect(completedFocusSequences(sessions,context,11,3)[5]).toBe(true);
 expect(completedFocusSequences(sessions,{...context,scale:'natural'},11,3)[5]).toBe(false);
 expect(completedFocusSequences(sessions,{...context,key:'E harmonic minor'},11,3)[5]).toBe(false);
 expect(completedFocusSequences(sessions,{...context,startStroke:'U'},11,3)[5]).toBe(false);
 expect(JSON.stringify(sessions)).toBe(original);
});
