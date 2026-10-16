import {renderModeration,resolveModerationVersion,escapeModeration as esc} from './moderation-view';
export async function initModerationWorkspace(shell:HTMLElement,actor:any){
 const root=document.getElementById('moderation-workspace')!;if(!root)return;
 if(shell.dataset.moderationController==='true'){window.dispatchEvent(new Event('moderation:reload'));return;}
 shell.dataset.moderationController='true';
 const s:any={actor,zh:shell.dataset.locale==='zh-CN',contentLang:shell.dataset.locale,worlds:[],counts:{},url:new URL(location.href),list:null,detail:null,bindings:null,entry:'',persona:'',version:'submitted',loading:true,busy:false,message:'',error:'',failed:false,unknown:null,email:'',password:'',emailError:'',passwordError:'',accountAttempt:null,accountResult:null,source:null};
 let restoringHistory=false;const originalScrollRestoration=history.scrollRestoration;history.scrollRestoration='manual';
 let generation=0,identityGeneration=0,currentHref=location.href,index=Number(history.state?.moderationIndex??0),modalClose:(()=>void)|null=null;
 const notes=new Map<string,string>(),tabs=new Map<string,string>(),positions=new Map<string,number>(),listSources=new Map<string,string>(),focusRecords=new Map<string,string>();
 const l=(zh:string,en:string)=>s.zh?zh:en;
 const labels:Record<string,[string,string]>={ACCOUNT_UNAVAILABLE:['条目所有者账号当前不可用。','The entry owner’s account is unavailable.'],SESSION_REQUIRED:['登录已失效，请重新登录。','Your session expired. Sign in again.'],ACCOUNT_CHANGED:['账号已切换，旧账号的输入和数据已清除。','The account changed. Previous input and data were cleared.'],SITE_ADMIN_REQUIRED:['此页面仅网站管理员可用。','This page requires site administrator access.'],REVIEW_FORBIDDEN:['你没有此世界的审核权限。','You cannot moderate this world.'],WORLD_FORBIDDEN:['你没有此世界的访问权限。','You cannot access this world.'],PERSONA_APPROVAL_REQUIRED:['署名资料尚未通过网站审核。你可以查看或退回送审，但不能批准资料或发布发言。','The signature profile needs site review. You may inspect or return the submission, but cannot approve the profile or publish.'],PERSONA_DISABLED:['署名角色已停用。批准资料不会自动启用角色。','The persona is disabled. Profile approval does not enable it.'],SUBMISSION_SUPERSEDED:['此申请已被替代或处理，请重新核对当前送审版。','This submission was replaced or handled. Review the current submission.'],REVISION_CONFLICT:['状态已变化。请核对最新版本后再决定，输入仍保留。','The state changed. Review the latest version; your input is retained.'],SUBMISSION_EXPIRED:['经营资格已变化，此回复送审已失效。需要提供者重新送审。','Operating eligibility changed. The provider must submit this reply again.'],TARGET_UNAVAILABLE:['关联条目或原评价当前不可公开读取。','The entry or original review is not publicly available.'],SITE_BLOCKED:['此内容受到网站限制，普通发布或恢复不能解除限制。','This content is restricted. Ordinary publication or restoration cannot remove the restriction.'],TRANSLATIONS_REQUIRED:['固定送审版缺少必要译文。请补齐并重新送审。','The fixed submission lacks required translations. Complete and resubmit it.'],PROVIDER_LOCKED:['此条目已首次成功送审或发布，经营角色已永久锁定。撤回、下架或网站管理员身份不会解除锁定。','The provider is permanently locked after successful submission or publication. Withdrawal, unpublishing and administrator status do not unlock it.'],PROVIDER_FORBIDDEN:['你不是此条目的所有者。网站管理员身份不绕过所有权限制。','You do not own this entry. Site administrator access does not override ownership.'],PROVIDER_CHANGED:['条目或提供者已变化，请重新核对当前绑定。','The entry or provider changed. Check the current assignment.'],OWNERSHIP_REVIEW_REQUIRED:['历史所有权或绑定资料缺失，需先核对；此处不会自动补填。','Historical ownership or assignment is missing and needs verification. It is not filled automatically here.'],PROVIDER_REVIEW_REQUIRED:['当前提供者绑定需要核对。','The current provider assignment needs verification.'],ELIGIBILITY_REVOKED:['此账号的经营资格已被撤销，当前不能修改绑定或发布回复。','Operating eligibility was revoked. Assignment changes and reply publication are unavailable.'],NO_CANDIDATES:['当前账号没有可绑定的已保存、启用中角色。请先在“我的角色”准备角色。','This account has no saved, enabled personas available. Prepare a persona in My personas.'],PERSONA_FORBIDDEN:['请选择你本人已保存、启用中的角色。','Choose one of your saved, enabled personas.'],ALREADY_EXISTS:['此邮箱已存在，不能据此认定本次创建成功。','This email already exists. This does not confirm that this request created it.'],NOT_FOUND:['对象不存在或已不可读取。','This item does not exist or is no longer readable.'],INVALID_INPUT:['请核对输入字段。','Check the input fields.'],NOT_SUBMITTED:['当前版本没有有效送审。','This version is not an effective submission.'],REVISION_LOCKED:['此版本已作出决定，请重新核对。','This version has already been decided. Reload it.']};
 s.errorText=(code:string)=>{const x=labels[code];return x?l(...x):l('请求未完成，请重新核对。','The request did not complete. Check the latest state.');};
 const view=()=>s.url.searchParams.get('view')==='site'?'site':'moderation';
 const tab=()=>s.url.searchParams.get('tab')||(view()==='site'?'profiles':'reviews');
 const detailId=()=>s.url.searchParams.get('detail');
 const noteKey=()=>s.detail?`${s.actor.id}:${s.detail.kind}:${s.detail.id}:${s.detail.fixed?.id??s.detail.submitted?.id??'none'}`:'';
 const dirty=()=>Boolean(notes.get(noteKey())?.trim()||s.email||s.password);
 const own=(g:number,a:string)=>g===generation&&a===s.actor.id;
 const remember=()=>{const record=document.activeElement?.closest<HTMLElement>('[data-record]')?.dataset.record;if(record)focusRecords.set(currentHref,record);positions.set(currentHref,scrollY);history.replaceState({...history.state,moderationIndex:index,moderationScroll:scrollY},'',currentHref);};
 history.replaceState({...history.state,moderationIndex:index},'',currentHref);
 function purge(){identityGeneration++;generation++;modalClose?.();notes.clear();s.busy=false;s.detail=s.list=s.bindings=null;s.worlds=[];s.counts={};s.email=s.password='';s.accountAttempt=s.accountResult=s.unknown=null;s.source=null;s.retainedNote=null;tabs.clear();positions.clear();listSources.clear();focusRecords.clear();root.replaceChildren();}
 async function api(path:string,body?:unknown,method=body===undefined?'GET':'POST',expected=s.actor.id){
  const response=await fetch('/api'+path,{method,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-Plotstay-Actor':expected},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
  const value=await response.json();if(!response.ok)throw Object.assign(new Error(value.error?.message??''),{code:value.error?.code,status:response.status});return value;
 }
 async function identity(current=()=>true){
  const epoch=identityGeneration;
  const r=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000)}),a=await r.json();
  // Obsolete navigation and previous-account responses cannot restart a load or change identity.
  if(!current()||epoch!==identityGeneration)return null;
  if(!r.ok)throw Object.assign(new Error(),{code:a.error?.code,status:r.status});
  const changed=a.actor.id!==s.actor.id;
  if(changed){purge();s.actor=a.actor;s.message=s.errorText('ACCOUNT_CHANGED');}
  return {actor:a.actor,changed,generation};
 }
 function chrome(){
  shell.dataset.view=view();shell.dataset.locale=s.zh?'zh-CN':'en';shell.dataset.prefix=s.zh?'zh':'en';document.documentElement.lang=s.zh?'zh-CN':'en';document.title=(view()==='site'?l('网站管理','Site management'):l('评价与回复审核','Review moderation'))+' · Plotstay';
  const titles:Record<string,[string,string]>={overview:['概览','Overview'],personas:['我的角色','My personas'],reviews:['我的评价','My reviews'],replies:['收到的评价','Received reviews'],works:['我管理的内容','Content I manage'],worlds:['我管理的世界','Worlds I manage'],settings:['账号设置','Account settings'],moderation:['评价与回复审核','Review moderation'],site:['网站管理','Site management']};
  for(const a of shell.querySelectorAll<HTMLAnchorElement>('.ws-nav a')){const u=new URL(a.href);u.pathname=`/${s.zh?'zh':'en'}/workspace`;a.href=u.href;const key=u.searchParams.get('view')??'overview';a.setAttribute('aria-current',String(key===view()?'page':'false'));const icon=a.querySelector('span');a.replaceChildren(...icon?[icon]:[],document.createTextNode(l(...(titles[key]??['','']))));}
  for(const a of shell.querySelectorAll<HTMLAnchorElement>('.ws-utility a')){const u=new URL(s.url);u.pathname=`/${a.lang==='en'?'en':'zh'}/workspace`;a.href=u.href;a.setAttribute('aria-current',(a.lang==='en')===!s.zh?'page':'false');}
  const top=shell.querySelector('.ws-utility strong');if(top)top.textContent=l('Plotstay · 私人工作台','Plotstay · Private workspace');
  const sub=shell.querySelector('.ws-utility>span');if(sub)sub.textContent=l('创作与管理','Create and manage');
  const menu=shell.querySelector('.ws-menu');if(menu)menu.textContent=l('☰ 导航','☰ Menu');const accountSmall=shell.querySelector('.ws-sidebar-footer small');if(accountSmall)accountSmall.textContent=l('使用现有账号','Existing account');
  const groups=shell.querySelectorAll('.ws-nav-group');groups.forEach((n,i)=>n.textContent=i?l('审核管理','Moderation'):l('我的内容','My content'));
  const label=shell.querySelector('.ws-nav-label');if(label)label.textContent=l('我的工作台','My workspace');
  document.getElementById('ws-account-name')!.textContent=s.actor.email;
  const legacy=shell.querySelector<HTMLAnchorElement>('.ws-legacy')!;legacy.href=`/${s.zh?'zh':'en'}/account?view=moderation`;legacy.textContent=l('旧版 ↗','Previous ↗');
  shell.querySelector<HTMLElement>('.ws-site-link')!.hidden=s.actor.siteRole!=='admin';
 }
 function render(){
  const focus=document.activeElement as HTMLInputElement|HTMLTextAreaElement|null,focusId=root.contains(focus)?focus?.id:null,selection=focusId&&('selectionStart'in focus!)?focus!.selectionStart:null;
  s.note=notes.get(noteKey())??'';chrome();root.innerHTML=renderModeration(s);
  const password=root.querySelector<HTMLInputElement>('[name=password]');if(password&&!s.accountAttempt&&!s.busy)password.value=s.password;
  if(focusId){const el=document.getElementById(focusId) as HTMLTextAreaElement;el?.focus({preventScroll:true});if(selection!==null&&el?.setSelectionRange)el.setSelectionRange(selection,selection);}
  requestAnimationFrame(()=>{const active=root.querySelector('.tabs .active');if(active){const a=active.getBoundingClientRect(),p=active.parentElement!,b=p.getBoundingClientRect();if(a.right>b.right)p.scrollLeft+=a.right-b.right;}});
 }
 async function load(y=0){
  modalClose?.();const q=s.url.searchParams;if(!q.has('detail')){for(const [legacy,section,v]of [['submission','profiles','site'],['moderateReply','replies','moderation'],['moderate','reviews','moderation']])if(q.has(legacy)){q.set('detail',q.get(legacy)!);q.set('tab',section);q.set('view',v);q.delete(legacy);history.replaceState(history.state,'',s.url);currentHref=s.url.href;break;}}const allowed=view()==='site'?['profiles','accounts','bindings']:['reviews','replies'];if(!allowed.includes(tab())){s.url.searchParams.delete('tab');s.url.searchParams.delete('detail');history.replaceState(history.state,'',s.url);currentHref=s.url.href;}const previousNote={key:noteKey(),value:notes.get(noteKey()),id:s.detail?.id,kind:s.detail?.kind};const g=++generation;s.loading=true;s.error='';s.detail=s.list=s.bindings=null;s.counts={};render();
  try{
   const session=await identity(()=>g===generation);if(!session)return;
   if(session.changed){if(session.generation===generation)return load(y);return;}
   if(g!==generation)return;
   const scope=await api('/moderation-workspace/scopes');if(!own(g,session.actor.id))return;s.worlds=scope.worlds;s.actor=scope.actor;s.counts.profiles=scope.pendingProfiles;
   if(view()==='site'&&s.actor.siteRole!=='admin')throw Object.assign(new Error(),{code:'SITE_ADMIN_REQUIRED',status:403});
   if(detailId()){
    const detail=await api(tab()==='profiles'?'/moderation-workspace/profiles/'+detailId():'/moderation-workspace/records/'+tab()+'/'+detailId());
    if(!own(g,session.actor.id))return;s.detail=detail;
    if(tab()!=='profiles')s.version=resolveModerationVersion(detail,s.url.searchParams.get('version')??s.version);
   }else if(tab()==='bindings'){
    const world=s.url.searchParams.get('world');if(world){const bindings=await api('/moderation-workspace/providers/'+world);if(!own(g,session.actor.id))return;s.bindings=bindings;const requested=s.url.searchParams.get('entry');s.entry=bindings.entries.some((e:any)=>e.id===requested)?requested:'';const current=bindings.entries.find((e:any)=>e.id===s.entry)?.persona_id;s.persona=bindings.personas.some((p:any)=>p.id===current)?current:bindings.personas[0]?.id??'';}
   }else if(tab()!=='accounts'){
    const q=new URLSearchParams({kind:tab(),locale:s.zh?'zh-CN':'en',status:s.url.searchParams.get('status')??'pending',enabled:s.url.searchParams.get('enabled')??'all',q:s.url.searchParams.get('q')??'',page:s.url.searchParams.get('page')??'1'});if(s.url.searchParams.get('world')&&view()!=='site')q.set('world',s.url.searchParams.get('world')!);
    const list=await api('/moderation-workspace/queue?'+q);if(!own(g,session.actor.id))return;s.list=list;s.counts={reviews:list.pendingReviews,replies:list.pendingReplies,profiles:list.pendingProfiles};
    if(list.page!==Number(s.url.searchParams.get('page')??1)){s.url.searchParams.set('page',String(list.page));history.replaceState(history.state,'',s.url);currentHref=s.url.href;}
   }
   if(!own(g,session.actor.id))return;if(previousNote.value&&previousNote.key!==noteKey()&&previousNote.id===s.detail?.id&&previousNote.kind===s.detail?.kind)s.retainedNote=previousNote;s.loading=false;render();window.scrollTo(0,y);const record=focusRecords.get(s.url.href);if(record)root.querySelector<HTMLButtonElement>(`[data-record="${CSS.escape(record)}"] button`)?.focus({preventScroll:true});
  }catch(err:any){if(g!==generation)return;s.loading=false;s.detail=s.list=s.bindings=null;s.error=s.errorText(err.code);if(err.code==='ACCOUNT_CHANGED'||err.code==='SESSION_REQUIRED'){purge();s.error=s.errorText(err.code);s.loading=false;}render();if(err.code==='SESSION_REQUIRED')document.getElementById('ws-login')!.hidden=false;}
 }
 function selectVersion(value:string){s.version=value;s.url.searchParams.set('version',value);history.replaceState(history.state,'',s.url);currentHref=s.url.href;render();}
 function route(patch:Record<string,string|number|null>){const u=new URL(s.url);for(const [k,v]of Object.entries(patch))if(v===null||v==='')u.searchParams.delete(k);else u.searchParams.set(k,String(v));return u;}
 async function go(u:URL,y=0,keep=false){
  if(s.busy)return;
  if(!keep&&dirty()&&!await confirmDialog(l('离开当前页面？','Leave this page?'),`<p>${l('审核说明仅保留在本页内存，未提交服务器。账号表单输入会丢弃。','Review notes remain only in this page’s memory and are not submitted. Account form input will be discarded.')}</p>`,l('离开并保留审核说明','Leave and keep review notes')))return;
  remember();s.email=s.password='';s.emailError=s.passwordError='';s.message='';s.failed=false;modalClose?.();s.url=u;s.zh=u.pathname.startsWith('/zh/');index++;history.pushState({moderationIndex:index,moderationScroll:y},'',u);currentHref=u.href;s.version='submitted';await load(y);
 }
 function confirmDialog(title:string,body:string,button:string):Promise<boolean>{
  modalClose?.();const focus=document.activeElement as HTMLElement;return new Promise(resolve=>{
   const backdrop=document.createElement('div');backdrop.className='modal-backdrop';backdrop.innerHTML=`<section class="modal" role="dialog" aria-modal="true" aria-labelledby="moderation-modal-title"><div class="modal-head"><h2 id="moderation-modal-title">${esc(title)}</h2></div><div class="modal-body">${body}</div><div class="modal-footer"><button type="button" class="btn" data-modal="cancel">${l('取消','Cancel')}</button><button type="button" class="btn primary" data-modal="confirm">${esc(button)}</button></div></section>`;
   root.append(backdrop);const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
   const close=(result:boolean)=>{backdrop.remove();document.body.style.overflow=overflow;modalClose=null;focus?.focus?.({preventScroll:true});resolve(result);};modalClose=()=>close(false);
   backdrop.querySelector('[data-modal=cancel]')!.addEventListener('click',()=>close(false));backdrop.querySelector('[data-modal=confirm]')!.addEventListener('click',()=>close(true));
   backdrop.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close(false);}if(e.key==='Tab'){const controls=Array.from(backdrop.querySelectorAll<HTMLButtonElement>('button'));if(e.shiftKey&&document.activeElement===controls[0]){e.preventDefault();controls.at(-1)!.focus();}else if(!e.shiftKey&&document.activeElement===controls.at(-1)){e.preventDefault();controls[0]!.focus();}}});backdrop.querySelector<HTMLButtonElement>('[data-modal=cancel]')!.focus();
  });
 }
 async function mutate(path:string,body:any,method='POST',clearNote=true){
  if(s.busy||s.unknown)return;const owner=s.actor.id,g=identityGeneration,key=noteKey(),y=scrollY;s.busy=true;s.message='';s.failed=false;s.unknown=null;render();
  try{
   const result=await api(path,body,method,owner);await identity();if(g!==identityGeneration||s.actor.id!==owner)return;
   if(clearNote)notes.delete(key);s.message=body.approvePersonaRevisionId?l('指定角色资料已批准；当前固定送审版已发布。其他发言和后续草稿未发布。','The specified profile was approved and this fixed submission published. Other posts and later drafts were not published.'):l('服务器已完成本次操作。','The server completed this action.');s.busy=false;await load(y);return result;
  }catch(err:any){if(g!==identityGeneration||s.actor.id!==owner)return;s.busy=false;s.failed=true;if(!err.status||err.status>=500){s.unknown={path,body,method,owner,href:s.url.href};s.message=l('请求结果尚未确认，请先核对服务器当前状态，不要重复提交。','The outcome is unknown. Check the current server state before submitting again.');render();}else{s.message=s.errorText(err.code);if(err.code==='ACCOUNT_CHANGED'){purge();await load(y);}else await load(y);}}
  finally{if(g===identityGeneration&&s.actor.id===owner)s.busy=false;}
 }
 async function accountSubmit(form:HTMLFormElement){
  if(s.busy||s.accountAttempt)return;s.emailError=s.passwordError='';const email=(form.elements.namedItem('email') as HTMLInputElement),password=(form.elements.namedItem('password') as HTMLInputElement);
  if(!email.value||!email.validity.valid)s.emailError=l('请填写有效邮箱。','Enter a valid email.');if(password.value.length<12||password.value.length>200)s.passwordError=l('密码需要 12 至 200 位。','Use 12–200 characters.');if(s.emailError||s.passwordError){render();return;}
  const attempt={requestId:crypto.randomUUID(),email:email.value.trim(),owner:s.actor.id};const secret=password.value;const epoch=identityGeneration;s.accountAttempt=attempt;s.password='';password.value='';s.accountResult=null;s.busy=true;render();
  try{const result=await api('/moderation-workspace/accounts',{requestId:attempt.requestId,email:attempt.email,password:secret});await identity();if(epoch!==identityGeneration||s.actor.id!==attempt.owner)return;s.accountResult=result;s.accountAttempt=null;s.email='';s.message='';}
  catch(err:any){if(epoch!==identityGeneration||s.actor.id!==attempt.owner)return;if(err.status&&err.status<500){s.accountAttempt=null;s.emailError=s.errorText(err.code);if(err.code==='ACCOUNT_CHANGED'){purge();await load();}}else s.message=l('创建结果未知，请核对本次请求。','Account creation outcome is unknown. Check this request.');}
  finally{if(epoch===identityGeneration){s.busy=false;render();}}
 }
 async function checkAccount(){const attempt=s.accountAttempt;if(!attempt||s.busy)return;const epoch=identityGeneration;s.busy=true;render();try{const result=await api('/moderation-workspace/accounts/'+attempt.requestId+'?email='+encodeURIComponent(attempt.email));await identity();if(epoch!==identityGeneration)return;if(result.confirmed){s.accountResult=result.account;s.accountAttempt=null;s.email='';s.message='';}else s.message=l('目前仍未确认创建成功，请稍后再核对；暂不重复创建。','Creation is not confirmed yet. Check again later; do not submit a duplicate.');}catch(err:any){if(epoch===identityGeneration)s.message=s.errorText(err.code);}finally{if(epoch===identityGeneration){s.busy=false;render();}}}
 async function action(el:HTMLElement){
  const a=el.dataset.action,id=el.dataset.id,value=el.dataset.value;if(s.busy)return;
  if(a==='reload'){await load(scrollY);return;}
  if(a==='use-retained-note'){if(s.retainedNote?.id===s.detail?.id&&s.retainedNote.kind===s.detail.kind){notes.set(noteKey(),s.retainedNote.value);s.retainedNote=null;render();}return;}
  if(a==='content-language'){s.contentLang=value;render();return;}
  if(a==='version'){selectVersion(value!);return;}
  if(a==='tab'){tabs.set(view()+':'+tab(),s.url.href);const previous=tabs.get(view()+':'+value);await go(previous?new URL(previous):route({tab:value!,detail:null,version:null,q:null,status:null,page:1,enabled:null,entry:null}));return;}
  if(a==='page'){await go(route({page:value!}),0,true);return;}
  if(a==='reset'){await go(route({status:null,q:null,page:1,enabled:null}),0,true);return;}
  if(a==='open'){listSources.set(view()+':'+tab(),s.url.href);await go(route({detail:id!,version:el.dataset.revision?'revision:'+el.dataset.revision:null}),0,true);return;}
  if(a==='back'){const source=listSources.get(view()+':'+tab());const target=source?new URL(source):route({detail:null,version:null});await go(target,positions.get(target.href)??0);return;}
  if(a==='profile'){s.source=s.url.href;await go(route({view:'site',tab:'profiles',detail:id!,world:null,version:null}),0,true);return;}
  if(a==='source'){const source=new URL(s.source);await go(source,positions.get(source.href)??0,true);return;}
  if(a==='related'){await go(route({view:'moderation',tab:el.dataset.kind!,detail:id!,version:null}),0,true);return;}
  if(a==='show-password'){const input=root.querySelector<HTMLInputElement>('[name=password]')!;input.type=input.type==='password'?'text':'password';return;}
  if(a==='check-account'){await checkAccount();return;}
  if(a==='another-account'){s.accountResult=null;s.message='';render();return;}
  if(a==='check-result'){
   const unknown=s.unknown,epoch=identityGeneration;if(!unknown)return;if(unknown.href!==s.url.href)await go(new URL(unknown.href),0,true);else await load(scrollY);if(epoch!==identityGeneration||s.error)return;
   const b=unknown.body,d=s.detail;
   const confirmed=unknown.method==='PUT'?s.bindings?.entries.some((x:any)=>unknown.path.endsWith('/'+x.id)&&x.persona_id===b.personaId):
    typeof b.disabled==='boolean'?d?.disabled===b.disabled:b.decision?d?.fixed?.decision===b.decision:b.action==='publish'?d?.published&&d.current?.version?.id===b.revisionId:
    b.action==='reject'?d?.events.some((x:any)=>x.revision_id===b.revisionId&&['reject','rejected'].includes(x.action)):
    b.action==='hide'?(d?.kind==='reviews'?d?.guard.publicationId===null:d?.guard.hidden===true):b.action==='restore'?d?.current?.restored_from===b.restoreId:false;
   s.message=confirmed?l('已核对：服务器当前状态符合本次操作目标。','Verified: the current server state matches the requested result.'):l('已读取最新状态，但尚不能确认本次结果。请查看历史并稍后再核对，不要重复提交。','Latest state loaded, but this outcome is not confirmed. Inspect history and check again before submitting.');
   s.failed=false;s.unknown=confirmed?null:unknown;render();return;
  }
  const d=s.detail;
  if(s.unknown){s.message=l('上次结果尚未确认，请先核对。','Check the previous outcome first.');render();return;}
  if(a==='approve-profile'||a==='reject-profile'){await mutate('/moderation-workspace/profiles/'+d.fixed.id,{decision:a==='approve-profile'?'approved':'rejected',note:notes.get(noteKey())??''});return;}
  if(a==='availability'){
   if(!d.disabled&&!await confirmDialog(l('停用这个角色？','Disable this persona?'),`<p>${esc(d.fixed.body?.[s.contentLang]?.name??d.fixed.id)}</p><p>${l('停用不会自动隐藏已公开评价和回复，也不是封禁账号。','Disabling does not hide published reviews or replies and does not ban the account.')}</p>`,l('停用角色','Disable persona')))return;
   await mutate('/moderation-workspace/personas/'+d.fixed.persona_id+'/availability',{disabled:!d.disabled,expectedDisabled:d.disabled},'POST',false);return;
  }
  if(a==='bind'){
   const entry=s.bindings?.entries.find((x:any)=>x.id===s.entry),persona=s.bindings?.personas.find((x:any)=>x.id===s.persona);if(!entry||!persona||entry.reason)return;
   const nm=(p:any)=>p?.[s.zh?'zh-CN':'en']?.name??p?.en?.name??'';
   if(!await confirmDialog(l('保存这次提供者绑定？','Save this provider assignment?'),`<div class="effect-row"><strong>${esc(entry.title??entry.slug)}</strong><p>${esc(nm(entry.profiles))} → ${esc(nm(persona.profiles))}</p><small>${esc(entry.id)} · ${esc(persona.owner)}</small></div><p>${l('改变当前提供者及后续回复身份；不转移所有权，不改写历史署名。首次成功送审或发布后永久锁定。','Changes the current provider and subsequent reply identity. Ownership and historical signatures remain unchanged. Locks permanently on first successful submission or publication.')}</p>`,l('保存绑定','Save assignment')))return;
   await mutate('/moderation-workspace/providers/'+entry.id,{personaId:persona.id,expectedPersonaId:entry.persona_id,token:entry.draft_token},'PUT',false);return;
  }
  if(['publish','reject','hide','restore'].includes(a??'')){
   if(s.unknown){s.message=l('上次结果尚未确认，请先核对。','Check the previous outcome first.');render();return;}
   const body:any={...d.guard,action:a,note:notes.get(noteKey())??''};
   if(a==='publish'&&d.joint){body.approvePersonaRevisionId=d.profile.id;
    if(!await confirmDialog(l('批准角色资料并发布此发言？','Approve the profile and publish this post?'),`<div class="effect-row"><strong>${l('网站级资料批准','Site-wide profile approval')} · ${esc(d.submitted.profiles?.[s.contentLang]?.name??d.profile.persona_id)} v${d.profile.number}</strong><p>${esc(d.profile.id)}</p></div><div class="effect-row"><strong>${esc(d.world.names?.[s.contentLang]?.name??d.world.slug)} / ${esc(d.entry.title??d.entry.slug)}</strong><p>${l('仅发布固定送审版','Publish only fixed submission')} v${esc(d.submitted.number)} · ${esc(d.submitted.id)}</p></div><p>${l('资料批准在全站生效。只发布当前指定发言，其他评价、回复和后续草稿不会自动发布。','Profile approval applies site-wide. Only this post is published; other reviews, replies and later drafts are not published automatically.')}</p>`,l('确认两项操作','Confirm both decisions')))return;
   }
   if(a==='hide'&&!await confirmDialog(l('隐藏公开内容？','Hide this publication?'),`<p>${l('这条内容不再对外展示。历史记录保留，待审版本不会被退回。','This content will no longer be public. History is retained and the pending submission is not returned.')}</p>`,l('隐藏','Hide')))return;
   if(a==='restore'){const id=root.querySelector<HTMLSelectElement>('#moderation-restore')!.value,p=d.publications.find((x:any)=>x.id===id);if(!p)return;body.restoreId=id;
    if(!await confirmDialog(l('恢复历史公开版本？','Restore a historical publication?'),`<p>${esc(new Date(p.published_at).toLocaleString())} · ${esc(p.version?.id)}</p><p>${esc(p.version?.texts?.[s.contentLang]?.description??'')}</p><p>${l('恢复此版本的正文和署名；不会批准待审版或发布后续草稿。','Restore this version’s text and signature. Pending submissions and later drafts are not published.')}</p>`,l('恢复此版本','Restore this version')))return;
   }
   await mutate('/moderation-workspace/records/'+tab()+'/'+d.id,body,'POST',a==='publish'||a==='reject');
  }
 }
 root.addEventListener('click',e=>{const el=(e.target as Element).closest<HTMLElement>('[data-action]');if(!el)return;e.preventDefault();void action(el).catch(()=>{s.message=l('操作未完成，请重新核对。','The action did not complete. Please reload.');s.failed=true;render();});});
 root.addEventListener('input',e=>{const input=e.target as HTMLInputElement;if(input.id==='moderation-note')notes.set(noteKey(),input.value);if(input.closest('#moderation-create-account')){if(input.name==='email')s.email=input.value;if(input.name==='password')s.password=input.value;}});
 root.addEventListener('change',e=>{const el=e.target as HTMLSelectElement,key=el.dataset.select;if(s.busy||!key)return;if(key==='history-version'){selectVersion(el.value);return;}if(key==='persona'){s.persona=el.value;render();return;}if(key==='entry'){s.entry='';s.bindings=null;void go(route({entry:el.value}),0,true);return;}void go(route({[key==='binding-world'?'world':key]:el.value,page:1,...key==='world'||key==='binding-world'?{entry:null}:{}}),0,true);});
 root.addEventListener('submit',e=>{e.preventDefault();const form=e.target as HTMLFormElement;if(form.id==='moderation-search')void go(route({q:String(new FormData(form).get('q')??''),page:1}),0,true);if(form.id==='moderation-create-account')void accountSubmit(form);});
 document.addEventListener('click',e=>{
  const a=(e.target as Element).closest<HTMLAnchorElement>('a[href]');if(!a||e.defaultPrevented||e.ctrlKey||e.metaKey||e.shiftKey)return;const u=new URL(a.href);if(u.origin!==location.origin)return;
  if(a.closest('.ws-utility')){e.preventDefault();if(s.busy)return;remember();s.zh=u.pathname.startsWith('/zh/');s.url.pathname=u.pathname;history.replaceState(history.state,'',s.url);currentHref=s.url.href;render();return;}
  if(u.pathname.endsWith('/workspace')&&['moderation','site'].includes(u.searchParams.get('view')??'')){e.preventDefault();void go(u);return;}
  if(dirty()||s.accountAttempt||s.unknown){if(s.busy||!confirm(l('离开将丢弃未提交输入和本次页面的核对信息，是否离开？','Leave and discard unsaved input and this page’s pending outcome information?'))){e.preventDefault();return;}notes.clear();s.password='';}
 });
 window.addEventListener('beforeunload',e=>{if(dirty()||s.busy||s.accountAttempt||s.unknown){e.preventDefault();}});
 window.addEventListener('workspace:leave',e=>{if(s.busy||dirty()&&!confirm(l('放弃未提交输入并离开？','Discard unsaved input and leave?')))e.preventDefault();});
 window.addEventListener('popstate',()=>{
  if(restoringHistory){restoringHistory=false;return;}
  const target=Number(history.state?.moderationIndex??0),u=new URL(location.href);
  if(s.busy||dirty()&&!confirm(l('离开当前详情？审核说明仅在本页内存保留，账号表单会丢弃。','Leave this detail? Review notes remain in page memory; account form input is discarded.'))){if(target!==index){restoringHistory=true;history.go(index-target);}else history.replaceState({...history.state,moderationIndex:index},'',currentHref);return;}
  if(!['moderation','site'].includes(u.searchParams.get('view')??'')){location.reload();return;}
  positions.set(currentHref,scrollY);s.email=s.password='';s.url=u;s.zh=u.pathname.startsWith('/zh/');index=target;currentHref=u.href;s.version='submitted';modalClose?.();void load(history.state?.moderationScroll??positions.get(u.href)??0);
 });
 let checking=false;
 const revalidate=async()=>{if(checking||document.hidden)return;checking=true;const epoch=identityGeneration;try{await identity();if(epoch!==identityGeneration){await load();return;}const scopes=await api('/moderation-workspace/scopes');if(epoch!==identityGeneration)return;if(s.actor.siteRole!==scopes.actor.siteRole||view()==='site'&&scopes.actor.siteRole!=='admin'||JSON.stringify(s.worlds)!==JSON.stringify(scopes.worlds)){modalClose?.();s.actor=scopes.actor;await load(scrollY);}}catch(err:any){if(epoch!==identityGeneration)return;if(err.status===401||err.status===403||err.code==='ACCOUNT_CHANGED')purge();else{generation++;s.detail=s.list=s.bindings=null;}s.error=s.errorText(err.code);s.loading=false;render();}finally{checking=false;}};
 window.addEventListener('focus',()=>void revalidate());document.addEventListener('visibilitychange',()=>{if(!document.hidden)void revalidate();});const timer=setInterval(()=>void revalidate(),15000);window.addEventListener('pagehide',()=>{clearInterval(timer);history.scrollRestoration=originalScrollRestoration;},{once:true});
 window.addEventListener('moderation:reload',()=>void load());
 await load();
}
