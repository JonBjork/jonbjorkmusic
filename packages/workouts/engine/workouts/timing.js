export const PAUSE_OPTIONS = [0.5, 1, 1.5, 2, 3];
export function readPause(value) {
  return PAUSE_OPTIONS.includes(value) ? value : 1;
}
export function chunkPauseSeconds({fixed, pauseSeconds, bpm, beatsPerBar}) {
  return fixed ? readPause(pauseSeconds) : beatsPerBar * 60 / bpm;
}
export function estimatePieceSeconds({exercises,bpm,notesPerBeat,countInBeats,pauseSeconds,loopMode,loopReps,loopMin}) {
  if(loopMode==='timer')return exercises.length*loopMin*60;
  const passes=loopMode==='reps'?loopReps:1;
  // First pass has a count-in; only subsequent passes have a preceding rest.
  const playAndCounts=exercises.reduce((sum,ex)=>sum+passes*(ex.notes.length/notesPerBeat+countInBeats)*60/bpm,0);
  return playAndCounts+Math.max(0,exercises.length*passes-1)*pauseSeconds;
}
