import { settingsEditor } from './settings-editor';
import { structuredFields } from './structured-fields';
import { attributesSchema, textSchema, type ContentText, type ContentAttributes, type Locale } from '@plotstay/contracts';

import { bilingual } from './i18n';

const root = document.querySelector<HTMLElement>('#admin');
if (root) initialize(root);
function initialize(root: HTMLElement) {
const locale = root.dataset.locale ?? 'en';
const l = bilingual(locale);
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const editor = el<HTMLFormElement>('editor');
const field = (name: string) => editor.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
let locales: Locale[] = [], worlds: any[] = [], options: any = {}, detail: any = null, actor: any = null;
let settingsDirty=false;
let dirty = false, selectedRevision: string | null = null, previewedImport = '';
let importIsValid = false;
let loadedWorld='';
let listRequest=0;
let listPage = 1;
let formMode = 'structured';
let parentFilter = '';
let originalAttributes: ContentAttributes = {images:[]};
let formTexts: Record<string,any> = {};
let previewRevisionId: string | null = null;
let savingDraft = false;
const workspaceMode = root.dataset.mode === 'workspace';
const initialWorkspaceView = document.getElementById('new-workspace')?.dataset.view;
const listView = !workspaceMode || ['works','world-content','world-review'].includes(initialWorkspaceView ?? '');
let openRequest=0;
let worldLoadRequest=0;
let previewNonce='';
const statuses: Record<string, string> = l('zh', 'en') === 'zh' ? { draft: '草稿', submitted: '待审核', approved: '已审核', rejected: '已退回', pending: '等待执行', running: '执行中', completed: '完成', failed: '失败', superseded: '已过期' } : {};
const status = (value: string) => statuses[value] ?? value;
const worldId = () => el<HTMLSelectElement>('world').value;
const message = (text: string) => { el('message').textContent = text; };
function resetPreview() {
  previewNonce='';
  previewRevisionId = null;
  el('draft-preview-area').hidden = true;
  el<HTMLIFrameElement>('draft-preview-frame').removeAttribute('src');
  el<HTMLAnchorElement>('draft-preview-full').hidden = true;
  el('preview-links').replaceChildren();
  updatePreviewState();
}
function updatePreviewState() {
  const version = detail?.revisions[0]?.number;
  const state = !detail ? l('新内容尚未保存。保存草稿后可预览。', 'New content is not saved yet. Save a draft to preview it.')
    : dirty ? previewRevisionId ? l(`有未保存修改；当前预览仍是已保存版本 ${version}。点击“保存并预览”更新。`, `Unsaved changes. The preview still shows saved revision ${version}. Select Save and preview to update it.`) : l('有未保存修改；点击“保存并预览”查看效果。', 'Unsaved changes. Select Save and preview to see them.')
    : previewRevisionId === detail.content.head_revision_id ? l(`已保存 · 版本 ${version} · 预览不影响公开页面。`, `Saved · revision ${version} · preview does not change the public page.`)
    : l(`已保存 · 版本 ${version}。可以预览当前草稿。`, `Saved · revision ${version}. You can preview this draft.`);
  el('draft-preview-state').textContent = state;
}
function showPreview() {
  if (!detail) throw new Error(l('请先保存草稿。', 'Save the draft first.'));
  const language = el<HTMLSelectElement>('draft-preview-language').value;
  previewNonce=crypto.randomUUID();
  const q = new URLSearchParams({revisionId:detail.content.head_revision_id,token:detail.content.draft_token,...workspaceMode?{bridge:previewNonce}:{}});
  const url = `/api/admin/preview/${language}/${detail.content.id}?${q}`;
  const full = el<HTMLAnchorElement>('draft-preview-full');
  full.href = url; full.hidden = false;
  const area = el('draft-preview-area'); area.hidden = false;
  area.dataset.width = el<HTMLSelectElement>('draft-preview-width').value;
  el<HTMLIFrameElement>('draft-preview-frame').src = url;
  previewRevisionId = detail.content.head_revision_id;
  if(workspaceMode)document.getElementById('new-workspace')!.dataset.stage='preview';
  updatePreviewState();
}
if(workspaceMode){
  const workspace=document.getElementById('new-workspace')!;workspace.dataset.stage='edit';
  el<HTMLButtonElement>('ws-tab-edit').addEventListener('click',()=>{workspace.dataset.stage='edit';el('editor').scrollIntoView({block:'start'});});
  el<HTMLButtonElement>('ws-tab-preview').addEventListener('click',()=>{workspace.dataset.stage='preview';el('draft-preview-area').scrollIntoView({block:'start'});});
  el('ws-section-nav').addEventListener('click',event=>{
    const selected=(event.target as HTMLElement).closest<HTMLButtonElement>('button[data-section]');if(!selected)return;
    const language=el('structured-editor').querySelector<HTMLElement>('.language-pane[data-active=true]')?.dataset.code??field('sourceLocale').value;
    const kind=detail?.content.kind??field('kind').value;
    const targetName=({basics:`${language}.title`,details:`${language}.${kind}.introduction`,price:'amount',provider:'personaId',rules:`${language}.${kind}.cancellation`} as Record<string,string>)[selected.dataset.section!];
    const target=selected.dataset.section==='images'?el('editor').querySelector<HTMLElement>('[data-field="attributes.images"]'):targetName?[...el('editor').querySelectorAll<HTMLElement>('[name]')].find(item=>item.getAttribute('name')===targetName):null;
    if(!target)return;
    workspace.dataset.stage='edit';for(let section=target.closest('details');section;section=section.parentElement?.closest('details')??null)section.open=true;
    for(const tab of el('ws-section-nav').querySelectorAll<HTMLButtonElement>('button'))tab.setAttribute('aria-pressed',String(tab===selected));
    target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});target.focus?.({preventScroll:true});
  });
  window.addEventListener('message',event=>{
    const data=event.data;
    if(event.origin!==location.origin||event.source!==el<HTMLIFrameElement>('draft-preview-frame').contentWindow||data?.type!=='plotstay:preview'||data.nonce!==previewNonce||data.contentId!==detail?.content.id||data.revisionId!==detail?.content.head_revision_id)return;
    if(data.action!=='select'||typeof data.section!=='string')return;
    const kind=detail.content.kind;const language=el<HTMLSelectElement>('draft-preview-language').value==='zh'?'zh-CN':'en';
    const section=data.section;const targetName=section==='about'?`${language}.${kind}.introduction`:section==='host'?`${language}.${kind}.hostIntroduction`:section==='rules'?`${language}.${kind}.cancellation`:section==='location'?`${language}.${kind}.locationNote`:section==='notes'?`${language}.description`:section.includes('gallery')?'attributes.images':section.includes('price')?'amount':`${language}.title`;
    const target=[...el('editor').querySelectorAll<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>('[name]')].find(input=>input.name===targetName)||el('editor').querySelector<HTMLElement>('[name="'+language+'.title"]');
    if(!target)return;
    workspace.dataset.stage='edit';
    for(const pane of el('structured-editor').querySelectorAll<HTMLElement>('.language-pane'))pane.dataset.active=String(pane.dataset.code===language);
    const tabs=[...el('structured-editor').querySelectorAll<HTMLButtonElement>('.language-tabs button')];for(const [index,tab] of tabs.entries())tab.setAttribute('aria-selected',String(locales[index]?.code===language));
    for(let section=target.closest('details');section;section=section.parentElement?.closest('details')??null)section.open=true;
    target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});
    target.focus({preventScroll:true});
    message(l('已定位到对应栏目。','Focused the matching section.'));
  });
}
const errorText = (error: any) => {
  if (error.code === 'REVISION_CONFLICT' || error.code === 'TRANSLATION_CONFLICT') return l('保存冲突：另一位编辑或翻译任务已更新内容。你的输入仍保留；请先复制或导出，再载入最新版本比较。', 'Save conflict: the draft changed. Your input is preserved. Copy it before loading the latest version.');
  if(error.code==='SESSION_REQUIRED'){el('login').hidden=false;return l('会话已过期。输入仍保留；请重新登录后重试，系统将重新核对版本和权限。','Session expired. Your input is preserved. Sign in again, then retry; permissions and versions will be checked.');}
  if (error.code === 'TRANSLATIONS_REQUIRED') return l('缺少发布所需译文：', 'Required translations missing: ') + JSON.stringify(error.details);
  return error.message + (error.details ? '\n' + JSON.stringify(error.details) : '');
};
async function api(path: string, body?: unknown, method = 'POST'): Promise<any> {
  const response = await fetch('/api' + path, { method: body === undefined ? 'GET' : method, credentials: 'same-origin',
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
  const data = await response.json();
  if(data.error?.code==='SESSION_REQUIRED')el('login').hidden=false;
  if (!response.ok) throw Object.assign(new Error(data.error?.message ?? l('请求失败', 'Request failed')), data.error);
  return data;
}
function on(id: string, fn: () => Promise<void>) {
  el<HTMLButtonElement>(id).addEventListener('click', async event => {
    event.preventDefault();
    const button = event.currentTarget as HTMLButtonElement;
    button.disabled = true;
    try { await fn(); } catch (error) { message(errorText(error)); }
    finally { button.disabled = false; refreshActions(); }
  });
}
function option(value: string, title: string) { const item = document.createElement('option'); item.value = value; item.textContent = title; return item; }
function button(title: string, fn: () => Promise<void>) {
  const item = document.createElement('button'); item.type = 'button'; item.textContent = title;
  item.addEventListener('click', async () => { item.disabled = true; try { await fn(); } catch (error) { message(errorText(error)); } finally { item.disabled = false; } });
  return item;
}
function line(text: string) { const item = document.createElement('p'); item.textContent = text; return item; }
function confirmDiscard() { return !(dirty||settingsDirty) || confirm(l('放弃未保存的输入？', 'Discard unsaved input?')); }
const textFields = [
  ['title', '名称', 'Title', false], ['summary', '短介绍', 'Summary', false], ['description', '完整介绍', 'Description', false],
  ['tags', '标签（每行一项）', 'Tags (one per line)', true],
  ['highlights', '住宿亮点（每行一项）', 'Stay highlights (one per line)', true],
  ['included', '活动包含项目（每行一项）', 'Experience inclusions (one per line)', true],
  ['serviceItems', '服务项目（每行一项）', 'Service items (one per line)', true],
  ['facilities', '设施（每行一项）', 'Facilities (one per line)', true], ['rules', '须知（每行一项）', 'Rules (one per line)', true],
  ['itinerary', '行程（每行一项）', 'Itinerary (one per line)', true], ['hostName', '房东／向导／提供者名称', 'Host / guide / provider name', false],
  ['hostBio', '人物介绍', 'Host / guide biography', false], ['imageAlts', '图片说明（图片 ID 对应文字，JSON）', 'Image descriptions (image ID to text, JSON)', false],
  ['service', '服务完整资料（JSON，可留空）', 'Full service details (JSON, optional)', false],
  ['experience', '活动完整资料（JSON，可留空）', 'Full experience details (JSON, optional)', false],
  ['stay', '住宿完整资料（JSON，可留空）', 'Full stay details (JSON, optional)', false],
  ['map', '地图叙事标注（JSON）', 'Map narrative labels (JSON)', false],
  ['review', '手记旅客资料（JSON，可留空）', 'Visitor note profile (JSON, optional)', false],
] as const;
const sharedLists=['tags','facilities','rules','itinerary','highlights','included','serviceItems','stay.sleeping','stay.highlights','stay.amenities','stay.nearby','stay.houseRules','stay.safety','experience.steps','service.qualifications'];
const atPath=(body:any,path:string,create=false):any[]=>{const parts=path.split('.');let object=body;for(const part of parts.slice(0,-1)){if(!object[part]){if(!create)return [];object[part]={};}object=object[part];}const key=parts.at(-1)!;if(!Array.isArray(object[key])){if(!create)return [];object[key]=[];}return object[key];};
function prepareListIds(){
  const known=locales.filter(language=>formTexts[language.code]?.title);
  const warnings:string[]=[];
  for(const path of sharedLists){const present=known.filter(language=>atPath(formTexts[language.code],path).length||formTexts[language.code]?.editorListIds?.[path]);if(!present.length)continue;
    const lengths=present.map(language=>atPath(formTexts[language.code],path).length);
    if(new Set(lengths).size>1){warnings.push(path);continue;}
    const existing=present.map(language=>formTexts[language.code].editorListIds?.[path]).find(ids=>Array.isArray(ids)&&ids.length===lengths[0]);
    const ids=existing??Array.from({length:lengths[0]},()=>crypto.randomUUID());
    for(const language of present){formTexts[language.code].editorListIds??={};formTexts[language.code].editorListIds[path]=[...ids];}
  }
  el('list-alignment-warning').textContent=warnings.length?l('以下双语列表项目数量不同，请先在高级 JSON 模式校订对应关系：','These bilingual lists have different item counts. Reconcile their alignment in advanced JSON mode: ')+warnings.join('、'):'';
}
function sharedArrayOperation(path:string,operation:'up'|'down'|'delete'|'add',index:number,newItem?:any){
  const dot=path.indexOf('.');const relative=path.slice(dot+1);if(!sharedLists.includes(relative))return false;
  const known=locales.filter(language=>formTexts[language.code]?.title);
  if(!known.length)return true;
  const lists=known.map(language=>atPath(formTexts[language.code],relative,true));
  if(lists.every(items=>items.length===0))for(const language of known){formTexts[language.code].editorListIds??={};formTexts[language.code].editorListIds[relative]??=[];}
  const ids=known.map(language=>formTexts[language.code].editorListIds?.[relative]);
  if(new Set(lists.map(items=>items.length)).size>1||ids.some(v=>!Array.isArray(v)||JSON.stringify(v)!==JSON.stringify(ids[0]))){message(l('中英项目对应关系不一致；请先校订，再排序或增删。','The bilingual items need alignment before sorting or changing structure.'));return true;}
  if(operation==='delete'&&!confirm(l('删除这个共用项目及所有语言的文字？','Delete this shared item and its text in every language?')))return true;
  for(const [position,language] of known.entries()){
    const items=lists[position]!,order=ids[position]!;
    if(operation==='up'&&index>0){[items[index-1],items[index]]=[items[index],items[index-1]];[order[index-1],order[index]]=[order[index],order[index-1]];}
    if(operation==='down'&&index<items.length-1){[items[index+1],items[index]]=[items[index],items[index+1]];[order[index+1],order[index]]=[order[index],order[index+1]];}
    if(operation==='delete'){items.splice(index,1);order.splice(index,1);}
    if(operation==='add'){items.push(structuredClone(newItem));order.push(position===0?crypto.randomUUID():ids[0]!.at(-1)!);}
    const top=relative.split('.')[0]!;const fieldNode=field(`${language.code}:${top}`);fieldNode.value=Array.isArray(formTexts[language.code][top])?formTexts[language.code][top].join('\n'):JSON.stringify(formTexts[language.code][top]);
  }
  dirty=true;refreshActions();renderStructured();
  requestAnimationFrame(()=>{const target=el('structured-editor').querySelector<HTMLElement>(`[data-field="${path}"] .repeat-row[data-index="${Math.min(index,lists[0]!.length-1)}"] [data-field-input]`);target?.focus({preventScroll:true});});
  return true;
}
function renderTextFields(translations: Record<string, ContentText>) {
  formTexts=structuredClone(translations);
  prepareListIds();
  const fragment = document.createDocumentFragment();
  for (const language of locales) {
    const section = document.createElement('fieldset'); section.dataset.language = language.code;
    const legend = document.createElement('legend'); legend.textContent = language.name; section.append(legend);
    for (const [key, zh, en, array] of textFields) {
      const label = document.createElement('label'); label.textContent = l(zh, en);
      const input = document.createElement(key === 'title' || key === 'hostName' ? 'input' : 'textarea');
      input.name = `${language.code}:${key}`;
      const value = translations[language.code]?.[key];
      input.value = key === 'imageAlts' ? JSON.stringify(value ?? {}) : key === 'map' || key === 'service' || key === 'experience' || key === 'stay' || key === 'review' ? (value ? JSON.stringify(value,null,2) : '') : array ? (value as string[] ?? []).join('\n') : String(value ?? '');
      if (input instanceof HTMLTextAreaElement) input.rows = key === 'stay' || key === 'experience' || key === 'service' ? 8 : key === 'description' ? 5 : key === 'review' ? 3 : 2;
      label.append(input); section.append(label);
    }
    fragment.append(section);
  }
  el('language-fields').replaceChildren(fragment);
  renderStructured();
}
function renderStructured() {
  const kind = detail?.content.kind ?? field('kind').value;
  const panel = el('structured-editor'); panel.replaceChildren();
  panel.hidden = formMode !== 'structured'; el('advanced-fields').hidden = formMode === 'structured';
  if (formMode !== 'structured') return;
  const shared = document.createElement('div'); shared.className='ws-shared-fields';
  const attrs = { ...originalAttributes, images: formMode==='structured'?structuredClone(originalAttributes.images):field('images').value.split('\n').filter(Boolean).map(row => { const [id,url]=row.split('|').map(v=>v.trim());return {id,url};}) } as any;
  for(const [key,name] of [['stay','stayAttributes'],['experience','experienceAttributes'],['service','serviceAttributes'],['reviewRatings','reviewRatings']]) {
    const value=field(name!).value; if(value)attrs[key!]=JSON.parse(value);else delete attrs[key!];
  }
  structuredFields(shared,attributesSchema,attrs,value=>{
    originalAttributes=value;
    field('images').value=value.images.map((i:any)=>`${i.id} | ${i.url}`).join('\n');
    for(const [key,name] of [['stay','stayAttributes'],['experience','experienceAttributes'],['service','serviceAttributes'],['reviewRatings','reviewRatings']])field(name!).value=value[key!]?JSON.stringify(value[key!]):'';
    dirty = true; refreshActions();
  },{zh:locale==='zh-CN',path:'attributes',kind,keys:kind==='review'?['reviewRatings']:['images',kind],media:()=>attrs.images.map((i:any)=>i.id),collapseGroups:workspaceMode});
  const tabs=document.createElement('div');tabs.className='language-tabs admin-actions';panel.append(tabs);
  const languages=document.createElement('div');languages.className='bilingual-fields';panel.append(languages);
  for(const language of locales){
    const section=document.createElement('section');section.className='language-pane';section.dataset.active=String(language.code===(field('sourceLocale').value||'en'));section.dataset.code=language.code;const tab=document.createElement('button');tab.type='button';tab.textContent=language.name;tab.setAttribute('aria-selected',section.dataset.active);tab.addEventListener('click',()=>{for(const pane of languages.querySelectorAll<HTMLElement>('.language-pane'))pane.dataset.active=String(pane.dataset.code===language.code);for(const choice of tabs.querySelectorAll<HTMLButtonElement>('button'))choice.setAttribute('aria-selected',String(choice===tab));});tabs.append(tab);const h=document.createElement('h3');h.textContent=language.name;section.append(h);const target=document.createElement('div');section.append(target);languages.append(section);
    const data:any=structuredClone(formTexts[language.code]??{});
    const keys=kind==='review'?['title','description','tags','review']:['title','summary','description','tags','hostName','hostBio','imageAlts',kind,'map','facilities','rules'];
    if(kind==='stay')keys.push('highlights');if(kind==='experience')keys.push('included','itinerary');if(kind==='service')keys.push('serviceItems','itinerary');
    const existingCleared=el('language-fields').querySelector<HTMLElement>(`[data-language="${language.code}"]`)?.dataset.cleared;
    const cleared = new Set<string>(existingCleared?JSON.parse(existingCleared):detail?.revisions.find((r:any)=>r.id===selectedRevision)?.translations[language.code]?.clearedFields ?? []);
    data.clearedFields=[...cleared];
    structuredFields(target,textSchema,data,value=>{formTexts[language.code]=structuredClone(value);for(const [key,,,array]of textFields){const v=value[key];field(`${language.code}:${key}`).value=['stay','experience','service','review','map'].includes(key)?(v===undefined?'':JSON.stringify(v)):key==='imageAlts'?JSON.stringify(v??{}):array?(v??[]).join('\n'):v??'';}dirty = true; refreshActions();},{zh:locale==='zh-CN',path:language.code,kind,keys,media:()=>attrs.images.map((i:any)=>i.id),collapseGroups:workspaceMode,onArrayOperation:sharedArrayOperation,onEdited:(path,v)=>{const key=path.slice(language.code.length+1);if(!/^(?:stay|experience|service|review|map|hostName|hostBio|highlights|facilities|rules|itinerary)(?:\.[a-zA-Z]+)*$/.test(key))return;if(v===undefined){for(const item of cleared)if(item===key||item.startsWith(key+'.'))cleared.delete(item);}if(v===''||Array.isArray(v)&&!v.length)cleared.add(key);else cleared.delete(key);data.clearedFields=[...cleared];el('language-fields').querySelector<HTMLElement>(`[data-language="${language.code}"]`)!.dataset.cleared=JSON.stringify([...cleared]);}});
  }
  panel.append(shared);
}
on('toggle-mode', async()=>{if(formMode==='structured'){formMode='advanced';}else{const parsed=readTexts();originalAttributes=attributesSchema.parse(formValue().attributes);formTexts=parsed;formMode='structured';}renderStructured();el('toggle-mode').textContent=formMode==='structured'?l('切换到高级 JSON','Switch to advanced JSON'):l('返回栏目表单','Return to section forms');});
function readTexts() {
  const result: Record<string, ContentText> = {};
  for (const language of locales) {
    const body: Record<string, unknown> = formMode==='structured'?structuredClone(formTexts[language.code]??{}):{};
    if(formMode!=='structured'&&formTexts[language.code]?.editorListIds)body.editorListIds=structuredClone(formTexts[language.code].editorListIds);
    let any = false;
    for (const [key, , , array] of textFields) {
      const value = field(`${language.code}:${key}`).value.trim();
      if (key !== 'imageAlts' && value) any = true;
      if(formMode==='structured')continue;
      if(array && value===(formTexts[language.code]?.[key]??[]).join('\n').trim()){body[key]=structuredClone(formTexts[language.code]?.[key]??[]);continue;}
      body[key] = key === 'imageAlts' ? JSON.parse(value || '{}') : key === 'map' || key === 'service' || key === 'experience' || key === 'stay' || key === 'review' ? (value ? JSON.parse(value) : undefined) : array ? value.split('\n').map(v => v.trim()).filter(Boolean) : value;
    }
    const metadata=el('language-fields').querySelector<HTMLElement>(`[data-language="${language.code}"]`)?.dataset.cleared;
    const previous=detail?.revisions.find((r:any)=>r.id===selectedRevision)?.translations[language.code]?.clearedFields;
    if(metadata)body.clearedFields=JSON.parse(metadata);else if(previous)body.clearedFields=previous;
    if(Array.isArray(body.clearedFields)&&!body.clearedFields.length&&!previous)delete body.clearedFields;
    if (any) result[language.code] = textSchema.parse(body);
  }
  return result;
}
function formValue() {
  const texts = readTexts(), sourceLocale = field('sourceLocale').value;
  if(!detail&&formMode==='advanced')for(const path of sharedLists){const present=locales.filter(language=>texts[language.code]&&atPath(texts[language.code],path).length);if(!present.length||present.some(language=>texts[language.code]?.editorListIds?.[path]))continue;const lengths=present.map(language=>atPath(texts[language.code],path).length);if(new Set(lengths).size!==1)continue;const ids=Array.from({length:lengths[0]},()=>crypto.randomUUID());for(const language of present){texts[language.code]!.editorListIds??={};texts[language.code]!.editorListIds![path]=[...ids];formTexts[language.code]??={};formTexts[language.code].editorListIds??={};formTexts[language.code].editorListIds[path]=[...ids];}}
  const bodies=Object.values(texts);
  for(const path of sharedLists){const filled=bodies.filter(body=>atPath(body,path).length||body.editorListIds?.[path]);if(filled.length<2)continue;const signatures=filled.map(body=>JSON.stringify(body.editorListIds?.[path]??[]));if(new Set(signatures).size>1||filled.some(body=>(body.editorListIds?.[path]?.length??0)!==atPath(body,path).length))throw new Error(l('双语项目身份或顺序不一致，请校订后保存：','Bilingual item identities or order differ. Reconcile before saving: ')+path);}
  if (!texts[sourceLocale]) throw new Error(l('请填写源语言的名称与完整介绍。', 'Complete the source title and description.'));
  const text = texts[sourceLocale]; delete texts[sourceLocale];
  const kind = detail?.content.kind ?? field('kind').value;
  const attributes: ContentAttributes = { ...originalAttributes, images: formMode==='structured'?structuredClone(originalAttributes.images):field('images').value.split('\n').filter(row => row.trim()).map(row => {
    const [id, url, ...extra] = row.split('|').map(value => value.trim());
    if (!id || !url || extra.length) throw new Error(l('每行图片需要：标识 | 地址', 'Each image needs: ID | URL'));
    return { id, url };
  }) };
  if (kind !== 'review') {
    if (field('amount').value === '') throw new Error(l('请填写虚构金额。', 'Enter the fictional amount.'));
  }
  for(const key of ['price','durationMinutes','rating','category','stay','experience','service','reviewRatings'] as const) delete attributes[key];
  if (kind !== 'review') attributes.price = { amount: Number(field('amount').value), unit: kind === 'stay' ? 'night' : kind === 'service' ? 'session' : 'person' };
  if(field('duration').value)attributes.durationMinutes=Number(field('duration').value);
  if(field('rating').value)attributes.rating=Number(field('rating').value);
  if (field('category').value) attributes.category = field('category').value;
  if (field('serviceAttributes').value.trim()) attributes.service = JSON.parse(field('serviceAttributes').value);
  if (field('experienceAttributes').value.trim()) attributes.experience = JSON.parse(field('experienceAttributes').value);
  if (field('stayAttributes').value.trim()) attributes.stay = JSON.parse(field('stayAttributes').value);
  if (field('reviewRatings').value.trim()) attributes.reviewRatings = JSON.parse(field('reviewRatings').value);
  const shared = { sourceLocale, text, translations: texts, attributes };
  return detail ? { ...shared, baseRevisionId: detail.content.head_revision_id, baseDraftToken: detail.content.draft_token } : {
    ...shared, worldId: worldId(), kind, slug: field('slug').value,
    placeId: field('placeId').value || null, personaId: field('personaId').value || null,
    parentContentId: kind === 'review' ? field('parentContentId').value || null : null,
  };
}
async function refreshList() {
  if(!listView)return;
  const request=++listRequest;el('content-list').replaceChildren();
  if(workspaceMode){const loading=document.createElement('p');loading.className='ws-loading';loading.textContent=l('正在载入内容…','Loading content…');el('work-cards').replaceChildren(loading);}
  const importRequest=!workspaceMode
    ?api(`/admin/worlds/${worldId()}/imports`).then(value=>({value,error:null}),(error:unknown)=>({value:null,error})):null;
  const params=new URLSearchParams({page:String(listPage)});
  for(const [key,id]of [['kind','filter-kind'],['q','filter-query'],['status','filter-status']]){const value=el<HTMLInputElement>(id!).value;if(value)params.set(key!,value);}
  if(parentFilter)params.set('parentId',parentFilter);
  let data:any;
  try{data=await api(`/admin/worlds/${worldId()}/contents?${params}`);}
  catch(error){if(workspaceMode&&request===listRequest){const box=el('work-cards');const retry=document.createElement('button');retry.type='button';retry.textContent=l('重试载入内容','Retry loading content');retry.addEventListener('click',()=>void refreshList().catch(e=>message(errorText(e))));box.replaceChildren(retry);}throw error;}
  if(request!==listRequest)return;
  if(workspaceMode){const url=new URL(location.href);url.searchParams.set('world',worldId());url.searchParams.set('page',String(listPage));for(const [key,id] of [['kind','filter-kind'],['q','filter-query'],['status','filter-status']]){const value=el<HTMLInputElement>(id!).value;if(value)url.searchParams.set(key!,value);else url.searchParams.delete(key!);}history.replaceState(history.state,'',url);}
  el('list-page').textContent=`${data.page} / ${data.pages} · ${data.total}`;
  if(workspaceMode)el('ws-result-count').textContent=l(`${data.total} 条内容 · ${el<HTMLSelectElement>('world').selectedOptions[0]?.textContent??''}`,`${data.total} ${data.total===1?'entry':'entries'} · ${el<HTMLSelectElement>('world').selectedOptions[0]?.textContent??''}`);
  el<HTMLButtonElement>('list-prev').disabled=listPage<=1;el<HTMLButtonElement>('list-next').disabled=listPage>=data.pages;
  const visibleContents=data.contents.filter((c: any) => !el<HTMLSelectElement>('filter-kind').value || c.kind === el<HTMLSelectElement>('filter-kind').value);
  const openFromList=async(content:any)=>{
    if (!confirmDiscard()) return;
    const returnTo=location.pathname+location.search,returnY=scrollY;
    await openContent(content.id);
    if(detail?.content.id!==content.id)return;
    if(workspaceMode)window.dispatchEvent(new CustomEvent('workspace:editor',{detail:{id:content.id,title:content.title,world:worldId(),worldName:el<HTMLSelectElement>('world').selectedOptions[0]?.textContent??'',returnTo,returnY}}));
    el('editor-panel').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
    const heading=workspaceMode?document.getElementById('ws-page-title')!:el('editor-title');heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});
  };
  const rows = visibleContents.map((content: any) => {
    const tr = document.createElement('tr');
    for (const text of [content.title, `${content.number} · ${status(content.status)}`, content.site_blocked ? l('网站限制', 'Site restricted') : content.published_publication_id ? l('已公开', 'Published') : l('未公开', 'Unpublished')]) {
      const td = document.createElement('td'); td.textContent = text; tr.append(td);
    }
    const td = document.createElement('td'); td.append(button(l('编辑', 'Edit'), () => openFromList(content))); tr.append(td);
    return tr;
  });
  el('content-list').replaceChildren(...rows);
  if(workspaceMode){
    const cards=el('work-cards');cards.replaceChildren();
    for(const content of visibleContents){
      const card=document.createElement('article');card.className='ws-work-card';card.dataset.contentId=content.id;
      const art=document.createElement('div');art.className=`ws-work-art ws-work-art-${content.kind}`;art.setAttribute('aria-hidden','true');art.textContent=({stay:'⌂',experience:'◈',service:'⚒',review:'✎'} as Record<string,string>)[content.kind]??'◇';
      const body=document.createElement('div');body.className='ws-work-body';
      const type=document.createElement('p');type.className='ws-work-type';type.textContent=({stay:l('住宿','Stay'),experience:l('活动','Experience'),service:l('服务','Service'),review:l('手记','Note')} as Record<string,string>)[content.kind]??content.kind;
      const title=document.createElement('h3');title.textContent=content.title;
      const slug=document.createElement('p');slug.className='ws-work-slug';slug.textContent=content.slug??content.number??'';
      const state=document.createElement('span');state.className='ws-badge';state.textContent=content.site_blocked?l('网站限制','Site restriction'):content.published_publication_id?l('已公开','Published'):l('未公开','Unpublished');
      const draft=document.createElement('span');draft.className='ws-badge ws-badge-muted';draft.textContent=status(content.status);
      const action=button(initialWorkspaceView==='world-review'?l('查看送审版本','Review submission'):content.status==='rejected'?l('查看意见并修改','View feedback and edit'):l('编辑内容','Edit content'),()=>openFromList(content));action.className='ws-work-action';
      body.append(type,title,slug,state,draft,action);card.append(art,body);cards.append(card);
    }
    if(!visibleContents.length){const empty=document.createElement('p');empty.className='ws-empty';empty.textContent=initialWorkspaceView==='world-review'?l('当前没有符合筛选条件的待审核内容。','No submissions match these filters.'):l('没有匹配的内容。试着调整筛选。','No matching content. Try another filter.');cards.append(empty);}
    try{const saved=JSON.parse(sessionStorage.getItem('plotstay:workspace-scroll')??'null');if(saved?.href===location.pathname+location.search){const selected=cards.querySelector<HTMLElement>(`[data-content-id="${saved.id}"]`);if(selected)selected.dataset.returned='true';sessionStorage.removeItem('plotstay:workspace-scroll');requestAnimationFrame(()=>scrollTo(0,Number(saved.y)||0));}}catch{sessionStorage.removeItem('plotstay:workspace-scroll');}
  }
  if(importRequest){
    const result=await importRequest;
    if(result.error)throw result.error;
    renderImportHistory(result.value.batches);
  }
}
function renderImportHistory(batches:any[]){el('import-history').replaceChildren(...batches.map((batch:any)=>{const item=document.createElement('details');const title=document.createElement('summary');title.textContent=`${batch.source} · ${new Date(batch.created_at).toLocaleString(locale)}`;const result=document.createElement('pre');result.textContent=JSON.stringify(batch.results,null,2);item.append(title,result);return item;}));}
async function loadWorld(page=1) {
  const request=++worldLoadRequest;
  loadedWorld=worldId();
  listPage=page;parentFilter='';
  el('editor-panel').hidden = true; detail = null; dirty = false;
  resetPreview();
  previewedImport = ''; el<HTMLButtonElement>('import-apply').disabled = true;
  if(!workspaceMode||initialWorkspaceView==='world-settings')settingsEditor(el('settings-panel'),worldId(),locale==='zh-CN',api,v=>settingsDirty=v);
  const tasks:Promise<unknown>[]=[];
  if(!workspaceMode||listView||initialWorkspaceView==='editor')tasks.push(api(`/admin/worlds/${worldId()}/options`).then(value=>{if(request===worldLoadRequest)options=value;}));
  if(listView)tasks.push(refreshList());
  if(initialWorkspaceView==='world-tools')tasks.push(api(`/admin/worlds/${worldId()}/imports`).then(({batches})=>{if(request===worldLoadRequest)renderImportHistory(batches);}));
  await Promise.all(tasks);
}
async function signIn() {
  const [session,languages,managed]=await Promise.all([api('/auth/me'),api('/locales'),api('/admin/worlds')]);
  actor=session.actor;locales=languages.locales;worlds=managed.worlds;
  el('account').textContent = actor.email;
  el<HTMLSelectElement>('draft-preview-language').value = locale === 'zh-CN' ? 'zh' : 'en';
  el('login').hidden = true; el('workspace').hidden = false;
  el<HTMLSelectElement>('world').replaceChildren(...worlds.map(world => option(world.id, world.translations[locale]?.name ?? world.slug)));
  if (worlds.length) el<HTMLSelectElement>('world').value = worlds.find(world=>world.id===new URLSearchParams(location.search).get('world'))?.id ?? (worlds.find(world => world.slug === 'lathe-worlds') ?? worlds[0]).id;
  if (worlds.length) {
    const query=new URLSearchParams(location.search);
    if(workspaceMode&&initialWorkspaceView?.startsWith('world-')){
      const requested=query.get('world');
      if(!requested){const url=new URL(location.href);url.searchParams.set('world',worldId());location.replace(url);return;}
      if(!worlds.some(world=>world.id===requested)){el('workspace').hidden=true;message(l('无权访问此世界。','This world is unavailable.'));return;}
    }
    if(workspaceMode||query.has('content')||query.has('world')){el<HTMLSelectElement>('filter-kind').value=query.get('kind')??'';el<HTMLInputElement>('filter-query').value=query.get('q')??'';el<HTMLSelectElement>('filter-status').value=query.get('status')??(document.getElementById('new-workspace')?.dataset.view==='world-review'?'submitted':'');listPage=Math.max(1,Number(query.get('page'))||1);}
    await loadWorld(workspaceMode?Math.max(1,Number(query.get('page'))||1):1);
    const id=query.get('content');if(id)await openContent(id);
    if(workspaceMode)message('');
  } else { el<HTMLButtonElement>('new').disabled = true; message(l('没有可管理的世界。', 'No worlds are assigned to this account.')); }
}
function fillRevision(revision: any) {
  originalAttributes=structuredClone(revision.attributes);
  field('sourceLocale').value = revision.source_locale;
  refreshCategories();
  field('category').value = revision.attributes.category ?? '';
  field('amount').value = revision.attributes.price?.amount?.toString() ?? '';
  field('duration').value = revision.attributes.durationMinutes?.toString() ?? '';
  field('rating').value = revision.attributes.rating?.toString() ?? '';
  field('serviceAttributes').value = revision.attributes.service ? JSON.stringify(revision.attributes.service,null,2) : '';
  field('experienceAttributes').value = revision.attributes.experience ? JSON.stringify(revision.attributes.experience,null,2) : '';
  field('stayAttributes').value = revision.attributes.stay ? JSON.stringify(revision.attributes.stay,null,2) : '';
  field('reviewRatings').value = revision.attributes.reviewRatings ? JSON.stringify(revision.attributes.reviewRatings,null,2) : '';
  field('images').value = revision.attributes.images.map((image: any) => `${image.id} | ${image.url}`).join('\n');
  selectedRevision = revision.id;
  renderTextFields(revision.translations);
}
function refreshCategories() {
  const value = field('category').value;
  const kind = detail?.content.kind ?? field('kind').value;
  (field('category') as HTMLSelectElement).replaceChildren(option('', l('无', 'None')), ...(options.categories ?? []).filter((c: any) => c.kind === kind).map((c: any) => option(c.slug, c.slug)));
  field('category').value = value;
  for(const [name,visible]of [['amount',kind!=='review'],['duration',kind==='experience'||kind==='service'],['rating',kind==='review'],['category',kind!=='review']] as const)field(name).closest('label')!.hidden=!visible;
}
field('kind').addEventListener('change', () => { refreshCategories(); renderStructured(); });
el('filter-kind').addEventListener('change', () => { listPage=1;parentFilter=''; void refreshList().catch(error => message(errorText(error))); });
function identity() {
  refreshCategories();
  (field('sourceLocale') as HTMLSelectElement).replaceChildren(...locales.map(item => option(item.code, item.name)));
  for (const [name, list, title] of [
    ['placeId', options.places, (item: any) => item.names[locale] ?? item.slug],
    ['parentContentId', options.parents, (item: any) => item.slug],
    ['personaId', options.personas, (item: any) => item.profiles[locale]?.name ?? item.profiles.en?.name ?? item.id],
  ] as const) (field(name) as HTMLSelectElement).replaceChildren(option('', l('无', 'None')), ...list.map((item: any) => option(item.id, title(item))));
}
function refreshActions() {
  el<HTMLButtonElement>('import-apply').disabled = !previewedImport || !importIsValid;
  el<HTMLButtonElement>('preview-draft').disabled = !detail || dirty;
  updatePreviewState();
  if (!detail) return;
  const head = detail.revisions[0];
  const unsaved = dirty || selectedRevision !== detail.content.head_revision_id;
  el<HTMLButtonElement>('submit-revision').disabled = unsaved || !['draft', 'rejected'].includes(head.status);
  for (const id of ['publish', 'reject']) el<HTMLButtonElement>(id).disabled = unsaved || !detail.canReview || head.status !== 'submitted';
  el<HTMLButtonElement>('unpublish').disabled = !detail.canReview || !detail.content.published_publication_id;
  el('site-block').hidden = actor.siteRole !== 'admin';
  el('release-block').hidden = actor.siteRole !== 'admin' || !detail.content.site_blocked;
}
async function openContent(id: string) {
  const request=++openRequest;
  const next = await api(`/admin/contents/${id}`);
  if(request!==openRequest)return;
  if(next.content.world_id!==worldId()&&worlds.some(world=>world.id===next.content.world_id)){
    if(workspaceMode){const url=new URL(location.href);url.searchParams.set('world',next.content.world_id);location.replace(url);return;}
    el<HTMLSelectElement>('world').value=next.content.world_id;await loadWorld();
  }
  resetPreview();
  detail = next;
  const newLink=el<HTMLAnchorElement>('new-workspace-link');if(newLink)newLink.href=`/${locale==='zh-CN'?'zh':'en'}/workspace?${new URLSearchParams({view:'editor',world:detail.content.world_id,content:id})}`;
  identity();
  for (const name of ['kind', 'slug']) field(name).value = detail.content[name];
  field('placeId').value = detail.content.place_id ?? '';
  field('parentContentId').value = detail.content.parent_content_id ?? '';
  field('personaId').value = detail.content.persona_id ?? '';
  el<HTMLFieldSetElement>('identity').disabled = true;
  fillRevision(detail.revisions[0]); dirty = false;
  el('editor-title').textContent = detail.revisions[0].source_text.title;
  if(workspaceMode){
    document.getElementById('ws-context')!.textContent=`${el<HTMLSelectElement>('world').selectedOptions[0]?.textContent??''} · ${({stay:l('住宿','Stay'),experience:l('活动','Experience'),service:l('服务','Service'),review:l('手记','Note')} as Record<string,string>)[detail.content.kind]??detail.content.kind}`;
    if(document.getElementById('new-workspace')?.dataset.view==='editor')window.dispatchEvent(new CustomEvent('workspace:editor-context',{detail:{world:worldId(),worldName:el<HTMLSelectElement>('world').selectedOptions[0]?.textContent??'',title:detail.revisions[0].source_text.title}}));
  }
  el('revision-state').textContent = `${l('版本', 'Revision')} ${detail.revisions[0].number} · ${status(detail.revisions[0].status)}`;
  el('editor-panel').hidden = false; el('editor-panel').dataset.existing='true'; el('workflow').hidden = false;
  el('translation-status').textContent = options.translationProvider === 'disabled' ? l('自动翻译暂未启用，可手工填写译文。待处理任务会保留。', 'Automatic translation is disabled. Enter translations manually; pending tasks are preserved.') : options.translationProvider;
  el('history').replaceChildren(...detail.revisions.map((revision: any) => {
    const row = line(`${l('版本', 'Revision')} ${revision.number} · ${status(revision.status)} · ${revision.source_text.title} `);
    row.append(button(l('载入此版本', 'Load revision'), async () => {
      if (!confirmDiscard()) return;
      fillRevision(revision); dirty = true; refreshActions(); message(l('历史文本已载入，保存会创建新草稿。', 'Historical text loaded. Saving creates a new draft.'));
    }));
    for (const publication of detail.publications.filter((item: any) => item.revision_id === revision.id)) {
      const current = publication.id === detail.content.published_publication_id;
      row.append(line(`${current ? l('当前公开', 'Currently published') : l('历史发布', 'Past publication')} · ${new Date(publication.published_at).toLocaleString(locale)}`));
      if (detail.canReview && !current) row.append(button(l('恢复此发布', 'Restore publication'), async () => {
        if (dirty) throw new Error(l('请先保存或放弃当前输入。', 'Save or discard input first.'));
        if (!confirm(l('将公开内容恢复为此版本？当前草稿会保留。', 'Restore this public version? The current draft will be preserved.'))) return;
        await api(`/admin/contents/${id}/restore`, { publicationId: publication.id }); await openContent(id); await refreshList();
      }));
    }
    return row;
  }));
  const published=detail.publications.find((p:any)=>p.id===detail.content.published_publication_id);
  const previous=detail.revisions.find((r:any)=>r.id===published?.revision_id);
  const changed:string[]=[];
  const compare=(a:any,b:any,path:string)=>{if(JSON.stringify(a)===JSON.stringify(b))return;if(a&&b&&typeof a==='object'&&typeof b==='object'){for(const key of new Set([...Object.keys(a),...Object.keys(b)]))compare(a[key],b[key],path+'.'+key);}else changed.push(path);};
  compare(previous?.attributes,detail.revisions[0].attributes,'attributes');compare(previous?.translations,detail.revisions[0].translations,'translations');
  el('content-changes').textContent=l('相对当前公开版本的改动字段：','Fields changed from the public revision: ')+(changed.join(', ')||l('无','None'))+'\n'+locales.map(language=>language.name+': '+(detail.revisions[0].translations[language.code]?l('已填写，请校订','Present; review wording'):l('缺译，不能发布','Missing; cannot publish'))).join(' · ');
  el('jobs').replaceChildren(...detail.jobs.map((job: any) => {
    const row = line(`${job.locale} · ${status(job.status)} · ${job.attempts}/${job.max_attempts} ${job.last_error ?? ''}`);
    if (job.status === 'failed') row.append(button(l('重试', 'Retry'), async () => { await api(`/admin/translation-jobs/${job.id}/retry`, {}); if (!dirty) await openContent(id); }));
    return row;
  }));
  el('events').replaceChildren(...detail.events.map((event: any) => line(`${new Date(event.created_at).toLocaleString(locale)} · ${event.action} · ${event.note}`)));
  refreshActions();
  if(workspaceMode){showPreview();document.getElementById('new-workspace')!.dataset.stage='edit';}
}
el<HTMLFormElement>('login').addEventListener('submit', async event => {
  event.preventDefault(); const data = new FormData(event.currentTarget as HTMLFormElement);
  try { await api('/auth/login', Object.fromEntries(data)); (event.target as HTMLFormElement).reset(); if(dirty||settingsDirty){({actor}=await api('/auth/me'));el('login').hidden=true;message(l('已重新登录，输入已保留。','Signed in again; your input is preserved.'));}else{await signIn();message('');} if(workspaceMode)window.dispatchEvent(new Event('workspace:authenticated')); }
  catch (error) { message(errorText(error)); }
});
editor.addEventListener('input', () => { dirty = true; refreshActions(); });
async function saveDraft() {
  if (savingDraft) throw new Error(l('草稿正在保存，请稍候。', 'The draft is being saved. Please wait.'));
  if (!editor.reportValidity()) throw new Error(l('请先修正表单中标出的字段。', 'Correct the highlighted form fields first.'));
  savingDraft = true;
  const submit = editor.querySelector<HTMLButtonElement>('button[type=submit]')!;
  const previewButton = el<HTMLButtonElement>('save-preview');
  submit.disabled = true; previewButton.disabled = true;
  try {
    const payload=formValue();const snapshot=JSON.stringify([...new FormData(editor)].map(([key,value])=>[key,String(value)]));
    const result = await api(detail ? `/admin/contents/${detail.content.id}/revisions` : '/admin/contents', payload);
    if(snapshot===JSON.stringify([...new FormData(editor)].map(([key,value])=>[key,String(value)])))await openContent(result.id);
    else {detail=await api(`/admin/contents/${result.id}`);selectedRevision=detail.content.head_revision_id;dirty=true;refreshActions();message(l('已保存提交时的输入；保存期间的新修改仍未保存。','The submitted input was saved. Changes made during saving remain unsaved.'));}
    await refreshList();
    if(!dirty)message(l('草稿已保存，公开内容保持原版本。', 'Draft saved. The public version is unchanged.'));
  } finally {
    savingDraft = false; submit.disabled = false; previewButton.disabled = false;
  }
}
editor.addEventListener('submit', async event => {
  event.preventDefault();
  try { await saveDraft(); } catch (error) { message(errorText(error)); }
});
on('save-preview', async () => {
  if (dirty || !detail) await saveDraft();
  if(dirty)return;
  showPreview();
});
el<HTMLSelectElement>('draft-preview-language').addEventListener('change', () => {
  if (previewRevisionId) showPreview(); else updatePreviewState();
});
el<HTMLSelectElement>('draft-preview-width').addEventListener('change', () => {
  el('draft-preview-area').dataset.width = el<HTMLSelectElement>('draft-preview-width').value;
});
on('new', async () => {
  if (!confirmDiscard()) return;
  detail = null; resetPreview(); originalAttributes={images:[]}; editor.reset(); identity(); el<HTMLFieldSetElement>('identity').disabled = false;
  renderTextFields({}); selectedRevision = null; dirty = false;
  el('editor-title').textContent = l('新建内容', 'New content'); el('revision-state').textContent = '';
  el('editor-panel').hidden = false; el('editor-panel').dataset.existing='false'; el('workflow').hidden = true; updatePreviewState();
});
on('export-draft',async()=>{const blob=new Blob([JSON.stringify({contentId:detail?.content.id??null,...formValue()},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='plotstay-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message(l('草稿副本已下载到本机。','A draft copy was downloaded to this device.'));});
on('refresh-image-fields',async()=>renderStructured());
on('reload-editor', async () => { if (detail && confirmDiscard()) await openContent(detail.content.id); });
on('clear-translations', async () => {
  if (!confirm(l('清空表单中的其他语言？保存草稿后会创建缺译任务，历史版本会保留。', 'Clear other languages in this form? Saving queues missing translations and preserves history.'))) return;
  const source = field('sourceLocale').value;
  for (const language of locales.filter(item => item.code !== source)) {
    delete formTexts[language.code];
    for (const [key] of textFields) field(`${language.code}:${key}`).value = key === 'imageAlts' ? '{}' : '';
  }
  renderStructured(); dirty = true; refreshActions();
});
on('refresh-list', async()=>{listPage=1;await refreshList();});
on('list-prev',async()=>{listPage--;await refreshList();});on('list-next',async()=>{listPage++;await refreshList();});
on('search-list',async()=>{listPage=1;parentFilter='';await refreshList();});
on('entry-notes',async()=>{if(!detail)return;parentFilter=detail.content.kind==='review'?detail.content.parent_content_id:detail.content.id;el<HTMLSelectElement>('filter-kind').value='review';el<HTMLInputElement>('filter-query').value='';el<HTMLSelectElement>('filter-status').value='';listPage=1;await refreshList();el('content-list').scrollIntoView();});
on('new-note',async()=>{if(!detail||!confirmDiscard())return;const parent=detail.content.kind==='review'?detail.content.parent_content_id:detail.content.id;detail=null;resetPreview();originalAttributes={images:[]};editor.reset();identity();el<HTMLFieldSetElement>('identity').disabled=false;field('kind').value='review';field('parentContentId').value=parent;refreshCategories();renderTextFields({});dirty=false;selectedRevision=null;el('editor-panel').dataset.existing='false';el('workflow').hidden=true;el('editor-title').textContent=l('新建后台手记','New editorial note');refreshActions();});
on('preview-draft',async()=>{if(!detail||dirty)throw new Error(l('请先保存草稿。','Save the draft first.'));const rev=detail.content.head_revision_id;const links=el('preview-links');links.replaceChildren(...locales.map(language=>{const a=document.createElement('a');a.href=`/api/admin/preview/${language.pathPrefix}/${detail.content.id}?revisionId=${rev}&token=${detail.content.draft_token}`;a.target='_blank';a.rel='noopener';a.textContent=language.name+' ↗ ';return a;}));});
on('logout', async () => { if (!confirmDiscard()) return; await api('/auth/logout', {}); location.reload(); });
el<HTMLSelectElement>('world').addEventListener('change', async () => {
  if (!confirmDiscard()) { el<HTMLSelectElement>('world').value = loadedWorld; return; }
  if(workspaceMode){
    dirty=false;settingsDirty=false;
    ++openRequest;++listRequest;++worldLoadRequest;el('workspace').inert=true;
    const url=new URL(location.href);
    url.searchParams.set('world',worldId());url.searchParams.delete('content');url.searchParams.delete('page');
    location.assign(url);
    return;
  }
  try { await loadWorld(); } catch (error) { message(errorText(error)); }
});
for (const [id, route, payload] of [
  ['submit-revision', 'submit', () => ({ revisionId: detail.content.head_revision_id, draftToken: detail.content.draft_token })],
  ['publish', 'review', () => ({ revisionId: detail.content.head_revision_id, draftToken: detail.content.draft_token, decision: 'publish', note: el<HTMLTextAreaElement>('moderation-note').value })],
  ['reject', 'review', () => ({ revisionId: detail.content.head_revision_id, draftToken: detail.content.draft_token, decision: 'reject', note: el<HTMLTextAreaElement>('moderation-note').value })],
  ['unpublish', 'unpublish', () => ({ siteBlock: false, note: el<HTMLTextAreaElement>('moderation-note').value })],
  ['site-block', 'unpublish', () => ({ siteBlock: true, note: el<HTMLTextAreaElement>('moderation-note').value })],
  ['release-block', 'release-site-block', () => ({ note: el<HTMLTextAreaElement>('moderation-note').value })],
] as const) on(id, async () => {
  if (dirty) throw new Error(l('请先保存或放弃未保存的输入。', 'Save or discard input first.'));
  const contentId = detail.content.id;
  await api(`/admin/contents/${contentId}/${route}`, payload());
  await openContent(contentId); await refreshList(); message(l('操作已完成。', 'Action completed.'));
});
const importInput = el<HTMLTextAreaElement>('import-json');
importInput.addEventListener('input', () => { previewedImport = ''; importIsValid = false; el<HTMLButtonElement>('import-apply').disabled = true; });
on('import-example', async () => {
  importInput.value = JSON.stringify({ worldId: worldId(), source: 'manual-example', items: [{ externalId: 'example-room-1', content: {
    worldId: worldId(), kind: 'stay', slug: 'import-example-room', sourceLocale: 'en', text: { title: 'Import example', description: 'Replace with your source content.' },
    translations: { 'zh-CN': { title: '导入示例', description: '请替换为需要导入的内容。' } }, attributes: { price: { amount: 100, unit: 'night' } },
  } }] }, null, 2); importInput.dispatchEvent(new Event('input'));
});
el<HTMLInputElement>('import-file').addEventListener('change', async event => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { message(l('文件不能超过 2 MB。', 'File must be at most 2 MB.')); return; }
  importInput.value = await file.text(); importInput.dispatchEvent(new Event('input'));
});
on('import-preview', async () => {
  const body = JSON.parse(importInput.value);
  if (body.worldId !== worldId()) throw new Error(l('导入世界必须与当前选择一致。', 'Import world must match the selected world.'));
  const data = await api('/admin/imports/preview', body);
  el('import-results').textContent = JSON.stringify(data.results, null, 2);
  previewedImport = importInput.value;
  importIsValid = data.results.some((item: any) => item.status === 'valid');
  el<HTMLButtonElement>('import-apply').disabled = !importIsValid;
});
on('import-apply', async () => {
  if (previewedImport !== importInput.value || !previewedImport) throw new Error(l('内容已改变，请重新预览。', 'Input changed. Preview it again.'));
  const data = await api('/admin/imports/apply', JSON.parse(previewedImport));
  el('import-results').textContent = JSON.stringify(data.results, null, 2); previewedImport = '';
  await refreshList();
  if(initialWorkspaceView==='world-tools')renderImportHistory((await api(`/admin/worlds/${worldId()}/imports`)).batches);
});
window.addEventListener('beforeunload', event => { if (dirty||settingsDirty) event.preventDefault(); });
if(workspaceMode)window.addEventListener('workspace:leave',event=>{if(!confirmDiscard())event.preventDefault();else {dirty=false;settingsDirty=false;}});
signIn().catch(error => { if (error.code !== 'SESSION_REQUIRED') message(errorText(error)); });

}
