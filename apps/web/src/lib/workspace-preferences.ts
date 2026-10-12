export interface WorldPreferences {pins:string[];visits:{id:string;at:number}[]}
const key=(actor:string)=>'plotstay:worlds:v1:'+actor;
const valid=(id:unknown):id is string=>typeof id==='string'&&/^[a-f0-9-]{36}$/i.test(id);
export function worldPreferences(actor:string):WorldPreferences {
 const raw=localStorage.getItem(key(actor));if(!raw)return {pins:[],visits:[]};
 const data=JSON.parse(raw);return {pins:[...new Set<string>((Array.isArray(data.pins)?data.pins:[]).filter(valid))].slice(0,4),visits:(Array.isArray(data.visits)?data.visits:[]).filter((v:any)=>valid(v?.id)&&Number.isFinite(v.at)).slice(0,20)};
}
export function saveWorldPreferences(actor:string,data:WorldPreferences){localStorage.setItem(key(actor),JSON.stringify(data));}
export function recordWorldVisit(actor:string,id:string){if(!valid(id))return;try{const data=worldPreferences(actor);data.visits=[{id,at:Date.now()},...data.visits.filter(v=>v.id!==id)].slice(0,20);saveWorldPreferences(actor,data);}catch{/* Read failures are surfaced by the overview preference panel. */}}
