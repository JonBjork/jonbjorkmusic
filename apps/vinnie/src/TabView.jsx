// ─────────────────────────────────────────────────────────────────────────────
// WORKOUTS — tab
// ─────────────────────────────────────────────────────────────────────────────
//
// Every string always visible, fret numbers punched into the lines, standard
// picking symbols above: the squared frame for a downstroke in purple, V for
// an upstroke in off-white. Same renderer as the standalone app.
//
// One column per tick. A routine's columns are all notes; a piece also has
// `hold` columns (a longer note ringing on), `rest` columns, `extra` frets on
// a column (a chord) and `bar` markers on the first column of each bar, which
// draw the bar line and its number.
//
// With `notesPerBeat` the columns are beamed below the strings in groups of
// that many, the way tab beams stems: one beam for two a beat, two for four,
// three for eight, and a beam with the tuplet number for 3, 5, 6 and 7. That
// makes the click's position readable even when the groups run across the
// bar lines.
//
// The playhead is a prop, not state, so the parent can drive it straight from
// the metronome tick. The container scrolls to keep the current note centred.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from "react";
import { C } from "./storage";

const STANDARD = [40, 45, 50, 55, 59, 64];
const PITCH = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Low string first. The top string goes lowercase when it repeats the bottom
// one, the way tab labels a standard-tuned guitar E A D G B e.
function stringNames(tuning) {
  const names = tuning.map(m => PITCH[m % 12]);
  const top = names.length - 1;
  if (top > 0 && names[top] === names[0]) names[top] = names[top].toLowerCase();
  return names;
}

// Beam lines per group size, and whether the size needs a tuplet number.
const BEAM_LINES = { 1: 0, 2: 1, 3: 1, 4: 2, 5: 2, 6: 2, 7: 2, 8: 3 };
const TUPLET = { 3: true, 5: true, 6: true, 7: true };

const COL_W = 38, PAD_L = 48, PAD_R = 26, ROW_H = 25, TOP_PAD = 46;
const STEM_LEN = 22, BEAM_GAP = 4.5, BEAM_AREA = 44;

export default function TabView({ notes, cursor, tuning = STANDARD, notesPerBeat, resolution = 1, beatOffset = 0, continuous = false }) {
  const wrapRef = useRef(null);
  const [viewport,setViewport]=useState({left:0,width:1000});

  const nStr = tuning.length;
  const names = stringNames(tuning);
  const n = notes.length;
  const beaming = Number.isInteger(notesPerBeat) && notesPerBeat >= 1;
  // Timing ticks can be finer than sixteenths (triplets). Give every
  // sounded note room, while interpolating hold ticks within that note.
  const offsets=[], onsets=[], widths=[];let position=PAD_L, current=0;
  for(let i=0;i<n;) {
    const col=notes[i], length=col.landing?1:Math.max(1,col.len || 1);
    const span=Math.max(COL_W,COL_W*length/resolution);
    for(let k=0;k<length && i+k<n;k++){offsets[i+k]=position+span*k/length;onsets[i+k]=i;widths[i+k]=span;}
    position+=span;i+=length;
  }
  const width=position+PAD_R;
  const height = TOP_PAD + ROW_H * nStr + 18 + (beaming ? BEAM_AREA : 0);
  const yFor = (s) => TOP_PAD + ROW_H * (s - 0.5);
  const xFor = (i) => offsets[i] + COL_W/2;
  current=onsets[Math.max(0,cursor)] || 0;
  const strings = Array.from({ length: nStr }, (_, i) => i + 1);

  // Keep the current note in view without smooth-scrolling, which lags behind
  // the click at faster tempos.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || cursor == null || cursor < 0) return;
    const x = offsets[onsets[cursor] || 0]+COL_W/2;
    wrap.scrollLeft = Math.max(0, x - wrap.clientWidth * (continuous ? 0.25 : 0.5));
  }, [cursor, notes, continuous]);

  // Keep a full-width strip, but only mount notation near the viewport.
  // Scrolling changes the visible notes without resetting the scroll origin.
  const visible=(i)=>!continuous || (offsets[i]+widths[i]>=viewport.left-600 && offsets[i]<=viewport.left+viewport.width+600);
  const visibleNotes=notes.map((col,i)=>({col,i})).filter(({i})=>visible(i));
  useEffect(()=>{
    if(!continuous)return;
    const wrap=wrapRef.current;
    const update=()=>setViewport({left:wrap.scrollLeft,width:wrap.clientWidth});
    update();
    const observer=typeof ResizeObserver!=="undefined"?new ResizeObserver(update):null;
    observer?.observe(wrap);
    return()=>observer?.disconnect();
  },[continuous,notes]);

  const fretsOf = (col) => [{ string: col.string, fret: col.fret }, ...(col.extra || [])];
  const stemmed = (col) => !col.hold && !col.rest;

  // Beam groups: every `notesPerBeat` columns from the first, which is a
  // downbeat. A group beams from its first stem to its last.
  const groups = [];
  if (beaming) {
    const beatTicks=notesPerBeat*resolution;
    for (let from=0; from<n;) {
      const to=Math.min(n,from+(from===0 && beatOffset ? beatTicks-beatOffset : beatTicks));
      const stems = [];
      for (let i = from; i < to; i++) if (stemmed(notes[i])) stems.push(i);
      if (stems.length) groups.push({ from, to, stems });
      from=to;
    }
  }
  const yStemTop = yFor(nStr) + 5;
  const yBeam = yStemTop + STEM_LEN;

  return (
    <div
      ref={wrapRef}
      onScroll={continuous?e=>setViewport({left:e.currentTarget.scrollLeft,width:e.currentTarget.clientWidth}):undefined}
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: "18px 0 14px",
        overflowX: "auto",
        overflowY: "hidden",
        minHeight: 238,
      }}
    >
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label="tab">
        {cursor != null && cursor >= 0 && (
          <rect
            x={offsets[current]}
            y={TOP_PAD - 34}
            width={widths[current]}
            height={ROW_H * nStr + 40 + (beaming ? BEAM_AREA - 8 : 0)}
            fill="rgba(124,58,237,0.18)"
            stroke={C.purpleLt}
            strokeWidth="1"
            rx="4"
          />
        )}

        {strings.map(s => (
          <g key={s}>
            <line
              x1={PAD_L - 10} y1={yFor(s)} x2={width - PAD_R + 6} y2={yFor(s)}
              stroke={C.string} strokeWidth="1.1"
            />
            <text
              x={PAD_L - 19} y={yFor(s) + 4} textAnchor="end" fontSize="13"
              fontFamily="Oswald,sans-serif" fontWeight="500" fill={C.dim}
            >{names[nStr - s]}</text>
          </g>
        ))}

        {visibleNotes.map(({col, i}) => {
          if (!col.bar) return null;
          const x = offsets[i];
          return (
            <g key={`bar${i}`}>
              <line x1={x} y1={yFor(1)} x2={x} y2={yFor(nStr)} stroke={C.dim} strokeWidth="1.2" />
              <text
                x={x + 4} y={11} fontSize="11" fontFamily="Oswald,sans-serif"
                fontWeight="500" letterSpacing="0.06em" fill={C.purpleLt}
              >{col.bar}</text>
            </g>
          );
        })}

        {groups.filter(g=>g.stems.some(visible)).map((g) => {
          const x1 = xFor(g.stems[0]), x2 = xFor(g.stems[g.stems.length - 1]);
          const beamCount=(i)=>notesPerBeat===4 && notes[i].noteValue ? ({Whole:0,Half:0,Quarter:0,Eighth:1,'16th':2,'32nd':3,'64th':4}[notes[i].noteValue] || 0) : BEAM_LINES[notesPerBeat] ?? 3;
          return (
            <g key={`beam${g.from}`}>
              {g.stems.map(i => (
                <line key={i} x1={xFor(i)} y1={yStemTop} x2={xFor(i)} y2={yBeam} stroke={C.off} strokeWidth="1.4" />
              ))}
              {g.stems.slice(1).flatMap((i,k)=>Array.from({length:Math.min(beamCount(g.stems[k]),beamCount(i))},(_,level)=><line key={`${i}-${level}`} x1={xFor(g.stems[k])} y1={yBeam-level*BEAM_GAP} x2={xFor(i)} y2={yBeam-level*BEAM_GAP} stroke={C.off} strokeWidth="2.6"/>))}
              {g.stems.flatMap((i,k)=>Array.from({length:beamCount(i)},(_,level)=>{
                if((level===0 && g.stems.length>1) || (k>0 && beamCount(g.stems[k-1])>level) || (k<g.stems.length-1 && beamCount(g.stems[k+1])>level))return null;
                return <line key={`flag-${i}-${level}`} x1={xFor(i)} x2={xFor(i)+(k===0?8:-8)} y1={yBeam-level*BEAM_GAP} y2={yBeam-level*BEAM_GAP} stroke={C.off} strokeWidth="2.6"/>;
              }))}
              {g.stems.flatMap(i=>Array.from({length:notes[i].dots||0},(_,d)=><circle key={`dot-${i}-${d}`} cx={xFor(i)+7+d*5} cy={yStemTop+10} r="1.8" fill={C.off}/>))}
              {TUPLET[notesPerBeat] && g.stems.length > 1 && (
                <text
                  x={(x1 + x2) / 2} y={yBeam + 13} textAnchor="middle" fontSize="11"
                  fontFamily="Oswald,sans-serif" fontWeight="500" fill={C.purpleLt}
                >{notesPerBeat}</text>
              )}
            </g>
          );
        })}

        {visibleNotes.map(({col,i})=>{
          if(!col.tuplet || notes.slice(0,i).filter(n=>n.tuplet && !n.hold).length % col.tuplet[0] !== 0)return null;
          const members=notes.map((n,index)=>({n,index})).slice(i).filter(v=>v.n.tuplet && !v.n.hold).slice(0,col.tuplet[0]);
          if(members.length!==col.tuplet[0])return null;
          const x1=xFor(i),x2=xFor(members[members.length-1].index);
          return <g key={`tuplet-${i}`}><path d={`M ${x1} ${yBeam+7} v 4 H ${x2} v -4`} fill="none" stroke={C.purpleLt}/><text x={(x1+x2)/2} y={yBeam+23} textAnchor="middle" fontSize="11" fill={C.purpleLt}>{col.tuplet[0]}</text></g>;
        })}

        {visibleNotes.map(({col, i}) => {
          if (col.hold) return null;
          const x = xFor(i);
          if (col.rest) {
            const y = TOP_PAD + ROW_H * (nStr / 2);
            return <rect key={i} x={x - 5} y={y - 6} width="10" height="12" rx="2" fill={C.dim} />;
          }
          const strokeCol = col.stroke === "D" ? C.down : C.up;
          return (
            <g key={i}>
              {col.legato && <text x={x} y={TOP_PAD-19} textAnchor="middle" fontSize="11" fill={C.purpleLt}>{col.legato}</text>}
              {col.stroke === "D" && (
                <path
                  d={`M ${x - 5} ${TOP_PAD - 18} L ${x - 5} ${TOP_PAD - 28} L ${x + 5} ${TOP_PAD - 28} L ${x + 5} ${TOP_PAD - 18}`}
                  fill="none" stroke={strokeCol} strokeWidth="1.8" strokeLinecap="square"
                />
              )}
              {col.stroke === "U" && (
                <path
                  d={`M ${x - 5} ${TOP_PAD - 28} L ${x} ${TOP_PAD - 18} L ${x + 5} ${TOP_PAD - 28}`}
                  fill="none" stroke={strokeCol} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                />
              )}
              {fretsOf(col).map(({ string, fret }) => {
                const y = yFor(string);
                return (
                  <g key={string}>
                    <rect x={x - 11} y={y - 10} width="22" height="20" fill={C.card} />
                    <text
                      x={x} y={y + 5} textAnchor="middle" fontSize="16"
                      fontFamily="Oswald,sans-serif" fontWeight="600" fill={C.off}
                    >{fret}</text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
