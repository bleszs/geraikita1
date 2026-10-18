// Context is selected by the server from this business, never accepted from the audio payload.
export function speechVocabulary(menu=[]){
  const terms=[];let length=0;
  for(const m of menu)for(const raw of [m.name,...(m.aliases||[])]){
    if(typeof raw!=='string')continue;
    const term=raw.normalize('NFKC').replace(/[^\p{L}\p{N} '\-]/gu,' ').replace(/\s+/g,' ').trim().slice(0,60);
    if(!term||terms.some(t=>t.toLowerCase()===term.toLowerCase()))continue;
    if(terms.length>=20||length+term.length+2>400)return terms.join(', ');
    terms.push(term);length+=term.length+2;
  }
  return terms.join(', ');
}
