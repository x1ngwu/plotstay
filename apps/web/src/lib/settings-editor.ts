import {z} from 'zod';
import {settingsSchema,detailCopyDefaults,completeDetailCopy} from '@plotstay/contracts';
import {structuredFields} from './structured-fields';
export function settingsEditor(container:HTMLElement,worldId:string,zh:boolean,api:(path:string,body?:unknown,method?:string)=>Promise<any>,markDirty:(dirty:boolean)=>void){
 const l=(a:string,b:string)=>zh?a:b;
 let current:any,body:any,home=false,dirty=false,loadedSelection='';
 const node=(tag:string,text?:string)=>{const n=document.createElement(tag);n.textContent=text??'';return n;};
 const message=node('p');message.setAttribute('role','status');
 const select=document.createElement('select'),previewEntry=document.createElement('select'),previewLinks=node('span'),form=document.createElement('form'),fields=node('div'),history=node('div'),impact=node('p'),diff=node('pre');
 const button=(title:string,fn:()=>Promise<void>)=>{const b=document.createElement('button');b.type='button';b.textContent=title;b.addEventListener('click',async()=>{b.disabled=true;select.disabled=true;try{await fn();}catch(e:any){message.textContent=e.message+(e.details?' '+JSON.stringify(e.details):'');}finally{b.disabled=false;select.disabled=false;}});return b;};
 const setDirty=(v:boolean)=>{dirty=v;markDirty(v);};
 const actions=node('div');actions.className='admin-actions';
 const heading=node('h2',l('详情共用文案与关联资料','Detail copy and shared references'));
 const description=node('p',l('保存为草稿后提交审核，发布才会影响当前页面。恢复历史发布保留当前草稿；历史凭条不改变。','Save a draft and submit for review. Publication changes current pages. Restoring a publication preserves drafts and historical receipts.'));
 const search=document.createElement('input');search.type='search';search.placeholder=l('筛选文案（键名或内容）','Filter copy by key or wording');search.addEventListener('input',()=>{for(const label of fields.querySelectorAll<HTMLElement>('label'))label.hidden=!!search.value&&!label.textContent?.toLowerCase().includes(search.value.toLowerCase())&&!label.querySelector<HTMLInputElement>('input,textarea')?.value.toLowerCase().includes(search.value.toLowerCase());});
 form.append(search,fields,actions,previewEntry,previewLinks);form.addEventListener('submit',e=>e.preventDefault());container.replaceChildren(heading,description,select,message,impact,form,diff,history);
 const pathFor=(value:string)=>value==='home'?`/admin/worlds/${worldId}/home`:`/admin/settings/${value}`;
 const rootPath=()=>pathFor(loadedSelection);
 async function load(){
  const selection=select.value;const fetched=await api(pathFor(selection));loadedSelection=selection;home=selection==='home';current=fetched;
  if(!current.setting){fields.replaceChildren(node('p',l('此世界尚无首页分类配置。','This world has no home categories.')));return;}
  const revision=current.revisions.find((r:any)=>r.id===current.setting.head_revision_id);
  body=structuredClone(revision.body);if(current.setting.kind==='copy')body=completeDetailCopy(body);setDirty(false);message.textContent='';
  impact.textContent=home?l('影响首页分类入口、列表分类与详情类别名；其他首页配置保留。','Affects home categories, listing filters and detail category names. Other home configuration is preserved.'):current.setting.kind==='copy'?l('影响三类详情与其中的行程控件，不改变首页、计价规则或凭条。','Affects detail pages and their trip controls; home, pricing rules and receipts keep their own copy.'):l('发布后影响首页、列表和以下引用：','Publication affects the home, listings and these references: ')+(current.impacts??[]).map((i:any)=>i.world+'/'+i.slug).join(', ');
  render();history.replaceChildren();previewLinks.replaceChildren();
  const options=await api(`/admin/worlds/${worldId}/options`);const candidates=home||current.setting.kind==='copy'||current.setting.kind==='world'?options.parents:(current.impacts??[]).filter((i:any)=>i.world===options.worldSlug||options.parents.some((p:any)=>p.id===i.id));previewEntry.replaceChildren(...candidates.map((p:any)=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.slug;return o;}));
  diff.textContent=l('当前保存版本：','Saved revision: ')+revision.id+'\n'+l('发布前请核对两种语言和影响范围。','Check both languages and the impact before publishing.');
  for(const p of current.publications){const row=node('p',`${p.published_at} · ${p.revision_id} `);if(p.id===current.setting.published_id)row.append(node('strong',l('当前公开','Current')));else row.append(button(l('恢复此发布','Restore publication'),async()=>{if(dirty)throw new Error(l('请先保存输入。','Save your input first.'));await api(rootPath()+(home?'/review/restore':'/restore'),{revisionId:current.setting.head_revision_id,publicationId:p.id});await load();}));history.append(row);}
  for(const r of current.revisions){const row=node('p',r.created_at+' · '+r.id+' ');row.append(button(l('载入历史版本为草稿','Load revision into draft'),async()=>{if(dirty&&!confirm(l('放弃未保存输入？','Discard unsaved input?')))return;body=structuredClone(r.body);if(current.setting.kind==='copy')body=completeDetailCopy(body);render();setDirty(true);message.textContent=l('历史正文已载入，保存将追加新草稿。','Historical values loaded. Saving appends a new draft.');}));history.append(row);}
  for(const e of current.events??[])history.append(node('p',`${e.created_at} · ${e.action}`));
 }
 function render(){
  const kind=current.setting.kind;search.hidden=kind!=='copy';
  if(home){const categoryNames=Object.fromEntries(Object.entries(body.translations).map(([language,v]:[string,any])=>[language,v.categoryNames]));structuredFields(fields,z.record(z.string(),z.record(z.string(),z.string().min(1))),categoryNames,v=>{for(const language of Object.keys(v))body.translations[language].categoryNames=v[language];setDirty(true);},{zh,path:'categoryNames'});}
  else {structuredFields(fields,settingsSchema(kind),body,v=>{body=v;setDirty(true);},{zh,path:'translations'});
   if(kind==='copy')for(const input of fields.querySelectorAll<HTMLInputElement>('input,textarea')){const key=input.name.split('.').slice(2).join('.');const def=detailCopyDefaults[key];if(def){const label=input.closest('label')!;label.querySelector('span')!.textContent=def.scope+' · '+(zh?def['zh-CN']:def.en);label.title=key;}}
  }
 }
 actions.append(button(l('保存配置草稿','Save configuration draft'),async()=>{const before=current.revisions.find((r:any)=>r.id===current.setting.head_revision_id).body;const changes:string[]=[];const walk=(a:any,b:any,path:string)=>{if(JSON.stringify(a)===JSON.stringify(b))return;if(a&&b&&typeof a==='object'&&typeof b==='object'){for(const k of new Set([...Object.keys(a),...Object.keys(b)]))walk(a[k],b[k],path+'.'+k);}else changes.push(path);};walk(before,body,'');await api(rootPath(),{body,baseRevisionId:current.setting.head_revision_id},'PUT');await load();diff.textContent=l('本次改动字段：','Changed fields: ')+changes.join(', ');message.textContent=l('配置草稿已保存，尚未公开。','Configuration draft saved; not published.');}));
 actions.append(button(l('预览已保存配置','Preview saved configuration'),async()=>{
  if(dirty)throw new Error(l('请先保存配置草稿。','Save the configuration draft first.'));
  if(!previewEntry.value)throw new Error(l('此资料没有可预览的关联条目。','No associated entry is available to preview.'));
  const d=await api(`/admin/contents/${previewEntry.value}`);previewLinks.replaceChildren(...['en','zh'].map(language=>{const q=new URLSearchParams({revisionId:d.content.head_revision_id,token:d.content.draft_token});if(home)q.set('homeRevision',current.setting.head_revision_id);else{q.set('settingId',loadedSelection);q.set('settingRevision',current.setting.head_revision_id);}const a=document.createElement('a');a.href=`/api/admin/preview/${language}/${d.content.id}?${q}`;a.target='_blank';a.rel='noopener';a.textContent=language+' ↗ ';return a;}));
 }));
 for(const [action,zhText,en]of [['submit','提交审核','Submit for review'],['publish','审核通过并发布','Approve and publish'],['reject','退回修改','Request changes']])actions.append(button(l(zhText!,en!),async()=>{if(dirty)throw new Error(l('请先保存输入。','Save your input first.'));await api(rootPath()+(home?'/review/':'/')+action,{revisionId:current.setting.head_revision_id});await load();message.textContent=l('操作完成。','Action completed.');}));
 select.addEventListener('change',()=>{if(dirty&&!confirm(l('放弃配置未保存输入？','Discard unsaved configuration?'))){select.value=loadedSelection;return;}void load().catch(e=>message.textContent=e.message);});
 void api(`/admin/worlds/${worldId}/settings`).then(async data=>{for(const s of data.settings){const o=document.createElement('option');o.value=s.id;o.textContent=s.kind+' · '+s.name;select.append(o);}const o=document.createElement('option');o.value='home';o.textContent=l('分类名称（原首页配置）','Category names (home configuration)');select.append(o);await load();}).catch(e=>message.textContent=e.message);
 return ()=>!dirty||confirm(l('放弃配置未保存输入？','Discard unsaved configuration?'));
}
