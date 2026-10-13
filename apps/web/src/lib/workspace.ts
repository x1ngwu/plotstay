import {clearWorkspaceRevision} from './workspace-revision';
import {initOverview} from './workspace-overview';
import {recordWorldVisit} from './workspace-preferences';
const root = document.querySelector<HTMLElement>('#new-workspace');
if (root) {
  const zh = root.dataset.locale === 'zh-CN';
  const l = (a:string,b:string) => zh?a:b;
  const prefix = root.dataset.prefix!;
  const base = `/${prefix}/workspace`;
  const view = root.dataset.view ?? 'overview';
  const roles:Record<string,string>={owner:l('所有者','Owner'),admin:l('管理员','Administrator'),editor:l('编辑者','Editor')};
  const titles:Record<string,string> = {overview:l('今天，从这里继续','Today, pick up where you left off'),works:l('我管理的内容','Content I manage'),editor:l('内容编辑','Edit content'),personas:l('我的角色','My personas'),reviews:l('我的评价','My reviews'),replies:l('收到的评价','Received reviews'),worlds:l('我管理的世界','Worlds I manage'),'world-content':l('世界内容','World content'),'world-settings':l('世界设定','World settings'),'world-tools':l('管理工具','Management tools'),'world-review':l('世界审核','World moderation'),'shared-settings':l('共享资料','Shared settings'),'world-members':l('成员','Members'),moderation:l('评价与回复审核','Review moderation'),site:l('网站审核','Site moderation'),settings:l('账号设置','Account settings')};
  const q = new URLSearchParams(location.search);
  const wsLink = (v:string,world?:string) => base+'?'+new URLSearchParams({view:v,...world?{world}:{} });
  function editorReturn(world?:string){
    const fallback=world?wsLink('world-content',world):wsLink('works');
    const raw=new URLSearchParams(location.search).get('returnTo');if(!raw)return fallback;
    try{const url=new URL(raw,location.origin);const params=url.searchParams;return url.origin===location.origin&&url.pathname===base&&['overview','works','world-content','world-review'].includes(params.get('view')??'overview')&&(!params.get('view')?.startsWith('world-')||params.get('world')===world)?url.pathname+url.search:fallback;}catch{return fallback;}
  }
  function anchor(text:string,href:string) {const a=document.createElement('a');a.textContent=text;a.href=href;return a;}
  function route(v:string,world?:string,worldName?:string){
    root!.dataset.view=v;
    document.getElementById('ws-page-title')!.textContent=titles[v]??v;
    const tail=document.getElementById('ws-crumb-tail')!;tail.replaceChildren();
    const returnUrl=editorReturn(world);
    const returnView=new URL(returnUrl,location.origin).searchParams.get('view');
    if(v==='editor'){
      if(returnView?.startsWith('world-')&&world)tail.append(anchor(l('我管理的世界','Worlds I manage'),wsLink('worlds')),document.createTextNode(' / '),anchor(worldName??l('世界','World'),wsLink('world-content',world)),document.createTextNode(' / '),anchor(titles[returnView]??returnView,returnUrl));
      else tail.append(anchor(returnView==='overview'?titles.overview!:titles.works!,returnUrl));
      tail.append(document.createTextNode(' / '+titles.editor));
    }
    else if(world){tail.append(anchor(l('我管理的世界','Worlds I manage'),wsLink('worlds')),document.createTextNode(' / '));if(v==='world-content')tail.append(document.createTextNode(`${worldName??l('世界','World')} / ${titles[v]??v}`));else tail.append(anchor(worldName??l('世界','World'),wsLink('world-content',world)),document.createTextNode(' / '+(titles[v]??v)));}
    else tail.textContent=titles[v]??v;
    const back=document.getElementById('ws-back') as HTMLAnchorElement;
    back.href=v==='editor'?returnUrl:world?wsLink('worlds'):base;
    back.textContent='← '+(v==='editor'&&returnView==='overview'?l('返回工作台首页','Back to overview'):v==='editor'&&returnView==='world-content'?l('返回世界内容','Back to world content'):v==='editor'&&returnView==='world-review'?l('返回世界审核','Back to world moderation'):v==='editor'?l('返回内容列表','Back to content list'):world?l('返回世界管理','Back to worlds'):l('返回工作台','Back to workspace'));
    const requestedReturn=new URLSearchParams(location.search).get('returnTo');
    if(v!=='overview'&&requestedReturn)try{const url=new URL(requestedReturn,location.origin);if(url.origin===location.origin&&url.pathname===base&&(url.searchParams.get('view')??'overview')==='overview'){back.href=url.pathname+url.search;back.textContent=l('返回工作台首页','Back to overview');}}catch{}
    for(const a of root!.querySelectorAll<HTMLAnchorElement>('.ws-nav a'))a.removeAttribute('aria-current');
    const navView=v==='editor'?(returnView?.startsWith('world-')?'worlds':'works'):v.startsWith('world-')?'worlds':v;
    const selected=root!.querySelector<HTMLAnchorElement>(`.ws-nav a[href="${navView==='overview'?base:wsLink(navView)}"]`);
    selected?.setAttribute('aria-current','page');
    for(const a of root!.querySelectorAll<HTMLAnchorElement>('.ws-world-nav a'))a.setAttribute('aria-current',String(new URL(a.href).searchParams.get('view')===v));
    const listPanel=document.getElementById('content-list-panel');if(listPanel&&v==='editor')listPanel.hidden=true;
  }
  route(view,q.get('world')??undefined);
  const menu=root.querySelector<HTMLButtonElement>('.ws-menu')!;
  menu.onclick=()=>{const expanded=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(expanded));root.dataset.menu=String(expanded);};
  root.addEventListener('keydown',e=>{if(e.key==='Escape'&&root.dataset.menu==='true'){menu.click();menu.focus();}});
  window.addEventListener('workspace:world-context',((event:CustomEvent<{world:string;worldName:string}>)=>{
    const heading=document.getElementById('ws-page-title')!;const title=heading.textContent;
    const current=root!.dataset.view??view;route(current,event.detail.world,event.detail.worldName);
    if(current==='editor'){heading.textContent=title;document.getElementById('ws-context')!.textContent=event.detail.worldName;}
  }) as EventListener);
  window.addEventListener('workspace:editor',((event:CustomEvent<{id:string;title:string;world?:string;worldName?:string;returnTo?:string;returnY?:number}>)=>{
    const detail=event.detail;const current=new URL(location.href);
    if(root!.dataset.view!=='editor'&&detail.returnTo){current.searchParams.set('returnTo',detail.returnTo);sessionStorage.setItem('plotstay:workspace-scroll',JSON.stringify({href:detail.returnTo,y:detail.returnY??0,id:detail.id}));}
    current.searchParams.set('view','editor');current.searchParams.set('content',detail.id);
    if(detail.world)current.searchParams.set('world',detail.world);
    history.pushState({workspace:true},'',current);
    currentHref=location.href;
    route('editor',current.searchParams.get('world')??undefined,detail.worldName);
    document.getElementById('ws-page-title')!.textContent=l('编辑','Edit ')+detail.title;
  }) as EventListener);
  window.addEventListener('workspace:editor-context',((event:CustomEvent<{id:string;world:string;worldName:string;title:string}>)=>{const detail=event.detail;const url=new URL(location.href);url.searchParams.set('content',detail.id);url.searchParams.delete('new');url.searchParams.delete('parentId');history.replaceState(history.state,'',url);currentHref=location.href;route('editor',detail.world,detail.worldName);document.getElementById('ws-page-title')!.textContent=l('编辑','Edit ')+detail.title;}) as EventListener);
  let currentHref=location.href;
  window.addEventListener('popstate',()=>{if(root!.dataset.personaController==='true'||root!.dataset.reviewController==='true')return;const guard=new Event('workspace:leave',{cancelable:true});window.dispatchEvent(guard);if(guard.defaultPrevented){history.pushState({workspace:true},'',currentHref);return;}location.reload();});
  const overview=document.getElementById('ws-overview')!, worldsPanel=document.getElementById('ws-worlds')!, settings=document.getElementById('ws-settings')!,membersPanel=document.getElementById('ws-members')!;
  overview.hidden=view!=='overview';worldsPanel.hidden=view!=='worlds';settings.hidden=view!=='settings';membersPanel.hidden=view!=='world-members';
  async function get(path:string){const response=await (window.__plotstayWorkspace?.request(path,'shell')??fetch('/api'+path,{credentials:'same-origin'}));const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error?.message??l('无法载入工作台','Could not load workspace')),{code:data.error?.code,status:response.status});return data;}
  async function load(){
    const authRequest=get('/auth/me');
    const worldRequest=(['worlds','works','editor'].includes(view)||view.startsWith('world-'))?get('/admin/worlds').then(data=>({data,error:null}),(error:Error)=>({data:null,error})):null;

    const auth=await authRequest;
    document.getElementById('ws-account-name')!.textContent=auth.actor.email;
    root!.querySelector<HTMLElement>('.ws-site-link')!.hidden=auth.actor.siteRole!=='admin';
    root!.querySelector<HTMLElement>('.ws-moderation-link')!.hidden=!auth.capabilities?.canModerate;
    root!.dataset.moderator=String(Boolean(auth.capabilities?.canModerate));
    if(view==='overview'){await initOverview(root!,auth.actor);return;}
    if(view==='shared-settings'){
      const {settingsEditor}=await import('./settings-editor');let dirty=false;
      const guard=()=>!dirty||confirm(l('放弃配置未保存输入？','Discard unsaved configuration?'));
      window.addEventListener('workspace:leave',e=>{if(!guard())e.preventDefault();});
      window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();}});
      settingsEditor(document.getElementById('ws-shared-settings')!,'',zh,async(path,body,method='POST')=>{
        if(body===undefined)return get(path);const r=await (window.__plotstayWorkspace?.request(path,'settings',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})??fetch('/api'+path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));const data=await r.json();if(!r.ok)throw new Error(data.error?.message);clearWorkspaceRevision();return data;
      },v=>dirty=v);return;
    }
    let world=q.get('world');
    if(view==='works'&&!world){const result=await worldRequest!;if(result.error)throw result.error;world=(result.data.worlds.find((item:any)=>item.slug==='lathe-worlds')??result.data.worlds[0])?.id;}
    if(world&&(view.startsWith('world-')||view==='works'||view==='editor')){
      const result=await worldRequest!;if(result.error)throw result.error;
      const selected=result.data.worlds.find((item:any)=>item.id===world);
      if(!selected)throw Object.assign(new Error(l('无权访问这个世界。','This world is unavailable.')),{code:'WORLD_FORBIDDEN',status:403});
      const worldName=selected.translations?.[root!.dataset.locale!]?.name??selected.slug;
      if(view.startsWith('world-'))document.getElementById('ws-context')!.textContent=worldName;route(root!.dataset.view??view,world,worldName);
      recordWorldVisit(auth.actor.id,world);
      const canManage=auth.actor.siteRole==='admin'||['owner','admin'].includes(selected.role)||selected.owner_id===auth.actor.id;
      for(const a of root!.querySelectorAll<HTMLAnchorElement>('.ws-world-nav a'))if(['world-review','world-members'].includes(new URL(a.href).searchParams.get('view')??''))a.hidden=!canManage;
      if(['world-review','world-members'].includes(view)&&!canManage){document.getElementById('admin')?.setAttribute('hidden','');document.getElementById('ws-members')!.hidden=true;throw Object.assign(new Error(l('此账号只有内容编辑权限，不能审核或查看成员。','This account can edit content but cannot moderate or view members.')),{code:'WORLD_FORBIDDEN',status:403});}
    }
    if(!['overview','worlds','settings','world-members'].includes(view))return;
    if(view==='world-members'){
      if(!world)throw new Error(l('请选择世界。','Choose a world.'));
      const data=await get(`/admin/worlds/${world}/members`);const list=document.getElementById('ws-member-list')!;
      const title=document.createElement('h2');title.textContent=l('成员与现有权限（只读）','Members and existing permissions (read only)');const note=document.createElement('p');note.textContent=l('第一阶段仅展示现有关系；成员变更仍需另定规则。','This phase shows existing relationships only. Member changes need separate rules.');list.append(title,note);
      for(const member of [{...data.owner,role:'owner'},...data.members]){const card=document.createElement('article');card.className='ws-card';const h=document.createElement('h3');h.textContent=member.email;const p=document.createElement('p');p.textContent=roles[member.role]??member.role;card.append(h,p);list.append(card);}
      return;
    }
    if(view==='settings'){
      const box=document.getElementById('ws-account')!;
      box.replaceChildren();const card=document.createElement('article');card.className='ws-card';
      const h=document.createElement('h2');h.textContent=auth.actor.email;
      const p=document.createElement('p');p.textContent=l('账号资料与虚构角色分开管理。','Your account is separate from your fictional personas.');
      card.append(h,p,anchor(l('管理我的角色 →','Manage personas →'),wsLink('personas')),anchor(l('打开旧账号工具 →','Open previous account tools →'),`/${prefix}/account`));box.append(card);
      return;
    }
    const worldResult=await worldRequest!;if(worldResult.error)throw worldResult.error;const data=worldResult.data;
    if(view==='worlds'){
      const list=document.getElementById('ws-world-list')!;list.replaceChildren();
      if(!data.worlds.length){const p=document.createElement('p');p.textContent=l('当前账号没有可管理的世界。','This account does not manage a world.');list.append(p);}
      for(const world of data.worlds){const card=document.createElement('article');card.className='ws-card';const h=document.createElement('h2');h.textContent=world.translations?.[root!.dataset.locale!]?.name??world.slug;const status=document.createElement('p');status.textContent=roles[world.role]??l('管理者','Manager');const nav=document.createElement('nav');nav.className='ws-world-actions';for(const [v,label] of [['world-content',l('内容','Content')],['world-review',l('审核','Moderation')],['world-settings',l('设定与共享资料','Settings')],['world-tools',l('导入与翻译','Tools')],['world-members',l('成员','Members')]] as const)nav.append(anchor(label,wsLink(v,world.id)));card.append(h,status,nav);list.append(card);}
    }

  }
  const wsLogin=document.getElementById('ws-login') as HTMLFormElement;
  wsLogin.addEventListener('submit',async event=>{event.preventDefault();const body=Object.fromEntries(new FormData(wsLogin));try{const response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'same-origin'});const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error?.message??''),{code:data.error?.code});(wsLogin.elements.namedItem('password') as HTMLInputElement).value='';location.reload();}catch(error:any){document.getElementById('ws-message')!.textContent=error.code==='INVALID_CREDENTIALS'?l('邮箱或密码不正确。','Email or password is incorrect.'):l('登录未完成，请重试。','Sign in failed. Try again.');}});
  const showLoadError=(error:any)=>{
    const box=document.getElementById('ws-message')!;box.replaceChildren();
    const session=error.code==='SESSION_REQUIRED';
    if(view==='overview')overview.replaceChildren();
    const forbidden=error.status===403&&!session;
    box.append(document.createTextNode(session?l('请登录现有账号，之后会返回当前页面。','Sign in to continue on this page.'):forbidden?l('当前账号没有此操作的权限。','Your account cannot access this task.'):l('载入失败，请重试。','Could not load this page. Try again.')));
    if(session)wsLogin.hidden=Boolean(document.getElementById('admin')||document.getElementById('persona-workspace'));
    else box.append(document.createTextNode(' '),anchor(forbidden?l('返回工作台','Back to workspace'):l('重试','Retry'),forbidden?base:location.href));
    for(const id of ['ws-todo','ws-continue','ws-recent']){const target=document.getElementById(id);if(target?.querySelector('.ws-loading'))target.replaceChildren();}
  };
  window.addEventListener('workspace:authenticated',()=>{wsLogin.hidden=true;document.getElementById('ws-message')!.replaceChildren();void load().catch(showLoadError);});
  void load().catch(showLoadError);
}
