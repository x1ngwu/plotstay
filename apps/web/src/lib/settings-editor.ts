import {z} from 'zod';
import {settingsSchema,detailCopyDefaults,completeDetailCopy} from '@plotstay/contracts';
import {structuredFields} from './structured-fields';
export function settingsEditor(container:HTMLElement,worldId:string,zh:boolean,api:(path:string,body?:unknown,method?:string)=>Promise<any>,markDirty:(dirty:boolean)=>void){
 const l=(a:string,b:string)=>zh?a:b;
 let current:any,body:any,home=false,dirty=false,loadedSelection='',loadVersion=0;
 const node=(tag:string,text?:string)=>{const n=document.createElement(tag);n.textContent=text??'';return n;};
 const message=node('p');message.setAttribute('role','status');
 const select=document.createElement('select'),previewEntry=document.createElement('select'),previewLinks=node('span'),form=document.createElement('form'),fields=node('div'),history=node('div'),impact=node('p'),diff=node('pre');
 const button=(title:string,fn:()=>Promise<void>)=>{const b=document.createElement('button');b.type='button';b.textContent=title;b.addEventListener('click',async()=>{b.disabled=true;select.disabled=true;try{await fn();}catch(e:any){message.textContent=e.message+(e.details?' '+JSON.stringify(e.details):'');}finally{b.disabled=false;select.disabled=false;}});return b;};
 let previewRevisionId='';
 const setDirty=(v:boolean)=>{dirty=v;markDirty(v);updatePreviewState();};
 const actions=node('div');actions.className='admin-actions';
 const heading=node('h2',l('详情共用文案与关联资料','Detail copy and shared references'));
 const description=node('p',l('保存为草稿后提交审核，发布才会影响当前页面。恢复历史发布保留当前草稿；历史凭条不改变。','Save a draft and submit for review. Publication changes current pages. Restoring a publication preserves drafts and historical receipts.'));
 const previewPanel=node('section');previewPanel.className='draft-preview-panel';
 const previewHeading=node('h3',l('配置页面预览','Configuration page preview'));
 const previewState=node('p');previewState.setAttribute('aria-live','polite');
 const previewControls=node('div');previewControls.className='admin-actions draft-preview-actions';
 const previewLanguage=document.createElement('select');previewLanguage.append(...[['zh','简体中文'],['en','English']].map(([value,name])=>{const item=document.createElement('option');item.value=value;item.textContent=name;return item;}));previewLanguage.value=zh?'zh':'en';
 const previewWidth=document.createElement('select');previewWidth.append(...[['wide',l('桌面','Desktop')],['mobile',l('手机','Mobile')]].map(([value,name])=>{const item=document.createElement('option');item.value=value;item.textContent=name;return item;}));
 const previewLanguageLabel=node('label',l('预览语言','Preview language'));previewLanguageLabel.append(previewLanguage);
 const previewWidthLabel=node('label',l('查看宽度','View width'));previewWidthLabel.append(previewWidth);
 const previewFull=document.createElement('a');previewFull.textContent=l('打开完整页面 ↗','Open full page ↗');previewFull.target='_blank';previewFull.rel='noopener';previewFull.hidden=true;
 const previewArea=node('div');previewArea.className='draft-preview-area';previewArea.hidden=true;
 const previewFrame=document.createElement('iframe');previewFrame.title=l('配置草稿页面预览','Configuration draft page preview');previewArea.append(previewFrame);
 const previewEntryLabel=node('label',l('选择受影响的条目','Choose an affected entry'));previewEntry.id='settings-preview-entry';previewEntryLabel.setAttribute('for',previewEntry.id);
 const search=document.createElement('input');search.type='search';search.placeholder=l('筛选文案（键名或内容）','Filter copy by key or wording');search.addEventListener('input',()=>{for(const label of fields.querySelectorAll<HTMLElement>('label'))label.hidden=!!search.value&&!label.textContent?.toLowerCase().includes(search.value.toLowerCase())&&!label.querySelector<HTMLInputElement>('input,textarea')?.value.toLowerCase().includes(search.value.toLowerCase());});
 previewPanel.append(previewHeading,previewState,previewControls,previewArea);
 form.append(previewEntryLabel,previewEntry,previewPanel,search,fields,actions,previewLinks);form.addEventListener('submit',e=>e.preventDefault());container.replaceChildren(heading,description,select,message,impact,form,diff,history);
 const pathFor=(value:string)=>value==='home'?`/admin/worlds/${worldId}/home`:`/admin/settings/${value}`;
 const rootPath=()=>pathFor(loadedSelection);
 function updatePreviewState(){previewState.textContent=!current?.setting?l('选择配置后可预览。','Select a configuration to preview.'):dirty?previewRevisionId?l('有未保存修改；预览仍显示上次保存的配置。','Unsaved changes. The preview still shows the last saved configuration.'):l('有未保存修改；点击“保存并预览配置”查看效果。','Unsaved changes. Select Save and preview configuration to see them.'):previewRevisionId===current.setting.head_revision_id?l('已保存的配置草稿；预览不改变公开页面。','Saved configuration draft; preview does not change the public page.'):l('配置草稿已保存。选择关联条目后可以预览。','Configuration draft saved. Choose an affected entry to preview it.');}
 function resetPreview(){previewRevisionId='';previewArea.hidden=true;previewFrame.removeAttribute('src');previewFull.hidden=true;previewLinks.replaceChildren();updatePreviewState();}
 function setLoading(value:boolean){fields.inert=value;for(const field of fields.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement|HTMLButtonElement>('input,select,textarea,button'))field.disabled=value;for(const b of actions.querySelectorAll('button'))b.disabled=value;previewEntry.disabled=value;previewSave.disabled=value;}
 async function load(){
  const version=++loadVersion,selection=select.value;setLoading(true);
  try{
  const fetched=await api(pathFor(selection));if(version!==loadVersion)return;loadedSelection=selection;home=selection==='home';current=fetched;
  if(!current.setting){fields.replaceChildren(node('p',l('此世界尚无首页分类配置。','This world has no home categories.')));return;}
  const revision=current.revisions.find((r:any)=>r.id===current.setting.head_revision_id);
  body=structuredClone(revision.body);if(current.setting.kind==='copy')body=completeDetailCopy(body);setDirty(false);message.textContent='';
  impact.textContent=home?l('影响首页分类入口、列表分类与详情类别名；其他首页配置保留。','Affects home categories, listing filters and detail category names. Other home configuration is preserved.'):current.setting.kind==='copy'?l('影响三类详情与其中的行程控件，不改变首页、计价规则或凭条。','Affects detail pages and their trip controls; home, pricing rules and receipts keep their own copy.'):l('发布后影响首页、列表和以下引用：','Publication affects the home, listings and these references: ')+(current.impacts??[]).map((i:any)=>i.world+'/'+i.slug).join(', ');
  render();setLoading(true);history.replaceChildren();resetPreview();
  const previewTarget=previewEntry.value;
  const options=await api(`/admin/worlds/${worldId}/options`);if(version!==loadVersion)return;const candidates=home||current.setting.kind==='copy'||current.setting.kind==='world'?options.parents:(current.impacts??[]).filter((i:any)=>i.world===options.worldSlug||options.parents.some((p:any)=>p.id===i.id));previewEntry.replaceChildren(...candidates.map((p:any)=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.slug;return o;}));if(candidates.some((p:any)=>p.id===previewTarget))previewEntry.value=previewTarget;
  diff.textContent=l('当前保存版本：','Saved revision: ')+revision.id+'\n'+l('发布前请核对两种语言和影响范围。','Check both languages and the impact before publishing.');
  for(const p of current.publications){const row=node('p',`${p.published_at} · ${p.revision_id} `);if(p.id===current.setting.published_id)row.append(node('strong',l('当前公开','Current')));else row.append(button(l('恢复此发布','Restore publication'),async()=>{if(dirty)throw new Error(l('请先保存输入。','Save your input first.'));await api(rootPath()+(home?'/review/restore':'/restore'),{revisionId:current.setting.head_revision_id,publicationId:p.id});await load();}));history.append(row);}
  for(const r of current.revisions){const row=node('p',r.created_at+' · '+r.id+' ');row.append(button(l('载入历史版本为草稿','Load revision into draft'),async()=>{if(dirty&&!confirm(l('放弃未保存输入？','Discard unsaved input?')))return;body=structuredClone(r.body);if(current.setting.kind==='copy')body=completeDetailCopy(body);render();setDirty(true);message.textContent=l('历史正文已载入，保存将追加新草稿。','Historical values loaded. Saving appends a new draft.');}));history.append(row);}
  for(const e of current.events??[])history.append(node('p',`${e.created_at} · ${e.action}`));
  }finally{if(version===loadVersion)setLoading(false);}
 }
 function render(){
  const kind=current.setting.kind;search.hidden=kind!=='copy';
  if(home){const categoryNames=Object.fromEntries(Object.entries(body.translations).map(([language,v]:[string,any])=>[language,v.categoryNames]));structuredFields(fields,z.record(z.string(),z.record(z.string(),z.string().min(1))),categoryNames,v=>{for(const language of Object.keys(v))body.translations[language].categoryNames=v[language];setDirty(true);},{zh,path:'categoryNames'});}
  else {structuredFields(fields,settingsSchema(kind),body,v=>{body=v;setDirty(true);},{zh,path:'translations'});
   if(kind==='copy')for(const input of fields.querySelectorAll<HTMLInputElement>('input,textarea')){const key=input.name.split('.').slice(2).join('.');const def=detailCopyDefaults[key];if(def){const label=input.closest('label')!;label.querySelector('span')!.textContent=def.scope+' · '+(zh?def['zh-CN']:def.en);label.title=key;}}
  }
 }
 async function saveDraft(){const before=current.revisions.find((r:any)=>r.id===current.setting.head_revision_id).body;const changes:string[]=[];const walk=(a:any,b:any,path:string)=>{if(JSON.stringify(a)===JSON.stringify(b))return;if(a&&b&&typeof a==='object'&&typeof b==='object'){for(const k of new Set([...Object.keys(a),...Object.keys(b)]))walk(a[k],b[k],path+'.'+k);}else changes.push(path);};walk(before,body,'');await api(rootPath(),{body,baseRevisionId:current.setting.head_revision_id},'PUT');await load();diff.textContent=l('本次改动字段：','Changed fields: ')+changes.join(', ');message.textContent=l('配置草稿已保存，尚未公开。','Configuration draft saved; not published.');}
 async function previewUrl(language:string,allowUnsaved=false){
  if(dirty&&!allowUnsaved)throw new Error(l('请先保存配置草稿。','Save the configuration draft first.'));
  if(!previewEntry.value)throw new Error(l('此资料没有可预览的关联条目。','No associated entry is available to preview.'));
  const d=await api(`/admin/contents/${previewEntry.value}`);const q=new URLSearchParams({revisionId:d.content.head_revision_id,token:d.content.draft_token});if(home)q.set('homeRevision',current.setting.head_revision_id);else{q.set('settingId',loadedSelection);q.set('settingRevision',current.setting.head_revision_id);}return `/api/admin/preview/${language}/${d.content.id}?${q}`;
 }
 async function showPreview(){const url=await previewUrl(previewLanguage.value,true);previewFrame.src=url;previewFull.href=url;previewFull.hidden=false;previewArea.hidden=false;previewArea.dataset.width=previewWidth.value;previewRevisionId=current.setting.head_revision_id;updatePreviewState();}
 const previewSave=button(l('保存并预览配置','Save and preview configuration'),async()=>{if(dirty)await saveDraft();await showPreview();});
 previewControls.append(previewSave,previewLanguageLabel,previewWidthLabel,previewFull);
 previewLanguage.addEventListener('change',()=>{if(!previewArea.hidden)void showPreview().catch(e=>message.textContent=e.message);else updatePreviewState();});
 previewWidth.addEventListener('change',()=>{previewArea.dataset.width=previewWidth.value;});
 previewEntry.addEventListener('change',()=>{if(!previewArea.hidden)void showPreview().catch(e=>message.textContent=e.message);else updatePreviewState();});
 actions.append(button(l('保存配置草稿','Save configuration draft'),saveDraft));
 actions.append(button(l('预览已保存配置','Preview saved configuration'),async()=>{const links=await Promise.all(['en','zh'].map(async language=>{const a=document.createElement('a');a.href=await previewUrl(language);a.target='_blank';a.rel='noopener';a.textContent=language+' ↗ ';return a;}));previewLinks.replaceChildren(...links);}));
 for(const [action,zhText,en]of [['submit','提交审核','Submit for review'],['publish','审核通过并发布','Approve and publish'],['reject','退回修改','Request changes']])actions.append(button(l(zhText!,en!),async()=>{if(dirty)throw new Error(l('请先保存输入。','Save your input first.'));await api(rootPath()+(home?'/review/':'/')+action,{revisionId:current.setting.head_revision_id});await load();message.textContent=l('操作完成。','Action completed.');}));
 select.addEventListener('change',()=>{if(dirty&&!confirm(l('放弃配置未保存输入？','Discard unsaved configuration?'))){select.value=loadedSelection;return;}void load().catch(e=>message.textContent=e.message);});
 void api(`/admin/worlds/${worldId}/settings`).then(async data=>{for(const s of data.settings){const o=document.createElement('option');o.value=s.id;o.textContent=s.kind+' · '+s.name;select.append(o);}const o=document.createElement('option');o.value='home';o.textContent=l('分类名称（原首页配置）','Category names (home configuration)');select.append(o);await load();}).catch(e=>message.textContent=e.message);
 return ()=>!dirty||confirm(l('放弃配置未保存输入？','Discard unsaved configuration?'));
}
