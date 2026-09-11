// Subdivision clicks within one scheduler tick, in beats from that tick.
// An independent grid keeps triplets even when the music uses sixteenths.
export function subdivisionOffsets(position, ticksPerBeat, audibleSubdivision) {
 const offsets=[], start=position/ticksPerBeat, end=(position+1)/ticksPerBeat;
 for(let n=Math.ceil(start*audibleSubdivision-1e-9);n/audibleSubdivision<end-1e-9;n++) {
  if(n>0)offsets.push(n/audibleSubdivision-start);
 }
 return offsets;
}
