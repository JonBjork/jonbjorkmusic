const stroke=(s,x)=>s==='D'?`<path d="M${x-5} 30V19H${x+5}V30"/>`:`<path d="M${x-5} 19L${x} 30L${x+5} 19"/>`;
export function chunkNotation(group,score) {
  // Wrap on beat boundaries, preserving complete triplet beams on small screens.
  const rows=[];let row=[];
  for(const n of group.notes){
    if(row.length>=6&&n!==group.notes.at(-1)&&(n.sourceAt-score.pickupTicks)%3===0){rows.push(row);row=[];}
    row.push(n);
  }
  if(row.length)rows.push(row);
  let index=0;
  return rows.map(notes=>{
    const width=52+Math.max(...rows.map(r=>r.length))*43,x=i=>45+i*43,y=s=>68+(s-1)*21;
    let s=`<svg viewBox="0 0 ${width} 233" role="img" aria-label="${group.label}, guitar tablature"><g fill="none" stroke="#696969">`;
    for(let string=1;string<=6;string++)s+=`<path d="M25 ${y(string)}H${width-10}"/>`;
    s+='</g>';
    ['e','B','G','D','A','E'].forEach((name,i)=>{s+=`<text x="8" y="${y(i+1)+5}" fill="#aaa" font-size="13">${name}</text>`;});
    notes.forEach((n,i)=>{
      const xx=x(i),yy=y(n.string),landing=n===group.notes.at(-1)&&group.size!=='whole',pickup=n.sourceAt===0;
      s+=`<g data-note="${index++}"><rect class="note-highlight" x="${xx-18}" y="8" width="36" height="211" rx="5" fill="#7c3aed" opacity="0"/><g fill="none" stroke="#c9aaff" stroke-width="2">${stroke(n.stroke,xx)}</g><rect x="${xx-14}" y="${yy-11}" width="28" height="22" fill="#181818"/><text x="${xx}" y="${yy+6}" text-anchor="middle" fill="${landing?'#c9aaff':'#fff'}" font-size="18" font-weight="700">${n.fret}</text>`;
      if(n.len===1)s+=`<path d="M${xx} ${yy+11}V201" stroke="#eee" stroke-width="1.5"/>`;
      else s+=`<text x="${xx}" y="213" text-anchor="middle" fill="#c9aaff" font-size="11">4 beats</text>`;
      if(pickup)s+=`<text x="${xx}" y="46" text-anchor="middle" fill="#aaa" font-size="10">pickup</text>`;
      if(landing)s+=`<text x="${xx}" y="46" text-anchor="middle" fill="#c9aaff" font-size="10">land</text>`;
      s+='</g>';
    });
    for(let i=0;i<notes.length;){
      if(notes[i].len!==1){i++;continue;}
      const beat=Math.floor((notes[i].sourceAt-score.pickupTicks)/3);let end=i;
      while(end+1<notes.length&&notes[end+1].len===1&&Math.floor((notes[end+1].sourceAt-score.pickupTicks)/3)===beat)end++;
      if(end>i)s+=`<path d="M${x(i)} 201H${x(end)}" stroke="#eee" stroke-width="3"/><text x="${(x(i)+x(end))/2}" y="220" text-anchor="middle" fill="#c9aaff" font-size="12">3</text>`;
      else s+=`<path d="M${x(i)} 194q12 -3 10 -14" fill="none" stroke="#eee" stroke-width="2"/><text x="${x(i)}" y="220" text-anchor="middle" fill="#c9aaff" font-size="11">3</text>`;
      i=end+1;
    }
    return s+'</svg>';
  }).join('');
}
