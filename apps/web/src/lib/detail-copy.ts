import {detailCopyDefaults} from '@plotstay/contracts';
import {bilingual,messages} from './i18n';
const lookup=new Map(Object.entries(detailCopyDefaults).map(([key,value])=>[value.scope+'\0'+value['zh-CN']+'\0'+value.en,key]));
export function detailBilingual(locale:string,copy:Record<string,Record<string,string>>|undefined,scope:string){
 const fallback=bilingual(locale);
 const plain=(zh:string,en:string)=>{const key=lookup.get(scope+'\0'+zh+'\0'+en);return key ? copy?.[locale]?.[key]??fallback(zh,en):fallback(zh,en);};
 return Object.assign(plain,{format:(name:string,values:Record<string,string|number>,count?:number)=>{
  const base=scope+'.'+name;const key=detailCopyDefaults[base]?base:base+(count===1?'.one':'.other');
  const initial=detailCopyDefaults[key];const template=copy?.[locale]?.[key]??(locale==='zh-CN'?initial?.['zh-CN']:initial?.en)??'';
  return template.replace(/\{([a-zA-Z]+)\}/g,(_all,key)=>String(values[key]??''));
 }});
}
// Explicit empty overrides are opt-in. Old snapshots retain their original fallback behavior.
export function contentFallback(content:import('@plotstay/contracts').PublicContent,path:string,value:any,fallback:any){
 return content.text.clearedFields?.includes(path)?value:(value||fallback);
}

export function detailMessages(locale:string,copy:Record<string,Record<string,string>>|undefined){
 const base=messages(locale);return Object.fromEntries(Object.entries(base).map(([key,value])=>[key,copy?.[locale]?.['common.ui.'+key]??value])) as typeof base;
}
