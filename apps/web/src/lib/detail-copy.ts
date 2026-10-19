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

// A world-specific presentation overlay. The shared database configuration and other worlds stay intact.
export function worldDetailCopy(copy:Record<string,Record<string,string>>|undefined,worldSlug:string){
 if(worldSlug!=='lathe-worlds')return copy;
 const result={...copy,en:{...copy?.en},'zh-CN':{...copy?.['zh-CN']}};
 for(const [key,entry] of Object.entries(detailCopyDefaults)){
  const id=latheDetailBindings[entry.scope+'\0'+entry.en];
  if(id)for(const locale of ['en','zh-CN']) result[locale as 'en'|'zh-CN'][key]=copyText(id,locale);
 }
 for(const locale of ['en','zh-CN']) {
  const values=result[locale as 'en'|'zh-CN'];
  values['common.ui.notes']=copyText('detail.shared.visitor-notes.title',locale);
  values['common.ui.fallback']=copyText('navigation.content-fallback',locale);
 }
 return result;
}
import {copyText} from './travel-copy';
const latheDetailBindings:Record<string,string>={
 'stay\0Listing highlights':'stay.highlights.title',
 'stay\0About this stay':'stay.overview.title',
 'stay\0Where you’ll sleep':'stay.rest.title',
 'stay\0What this place offers':'stay.amenities.title',
 'stay\0Where you’ll be':'stay.location.title',
 'stay\0Meet your host':'stay.host.title',
 'stay\0Things to know':'stay.requirements.title',
 'stay\0Message host':'detail.shared.contact',
 'experience\0What you’ll do':'experience.overview.title',
 'experience\0The experience, step by step':'experience.itinerary.title',
 'experience\0What’s included':'experience.included.title',
 'experience\0Where we’ll meet':'experience.meeting-point.title',
 'experience\0About me':'experience.guide.title',
 'experience\0Things to know':'experience.requirements.title',
 'experience\0Dates & prices':'experience.sessions.title',
 'experience\0Message':'detail.shared.contact',
 'service\0Service offerings':'service.offerings.title',
 'service\0Price & dates':'service.appointments.title',
 'service\0My qualifications':'service.credentials.title',
 'service\0My gallery':'service.gallery.title',
 'service\0Where you’ll go':'service.location.title',
 'service\0Things to know':'service.requirements.title',
 'service\0Message':'detail.shared.contact',
 'service\0Message provider':'detail.shared.contact',
 'common\0Explore more in this world':'detail.shared.related.title',
 'common\0Back to results':'detail.shared.back',
 'common\0Continue exploring':'detail.shared.back',
 'common\0Reviews':'detail.shared.visitor-notes.title',
};
