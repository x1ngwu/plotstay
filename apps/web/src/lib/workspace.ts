const root = document.querySelector<HTMLElement>('#new-workspace');
if (root) {
  const zh = root.dataset.locale === 'zh-CN';
  const l = (a:string,b:string) => zh?a:b;
  const prefix = root.dataset.prefix!;
  const base = `/${prefix}/workspace`;
  const view = root.dataset.view ?? 'overview';
  const titles:Record<string,string> = {overview:l('今天，从这里继续','Today, pick up where you left off'),works:l('我的作品','My works'),editor:l('作品编辑','Edit work'),personas:l('我的角色','My personas'),reviews:l('评价与回复','Reviews and replies'),replies:l('评价与回复','Reviews and replies'),worlds:l('我管理的世界','Worlds I manage'),'world-content':l('世界内容','World content'),'world-settings':l('世界设定','World settings'),'world-tools':l('管理工具','Management tools'),'world-review':l('世界审核','World moderation'),'world-members':l('成员','Members'),moderation:l('世界审核','World moderation'),site:l('网站审核','Site moderation'),settings:l('账号设置','Account settings')};
  const q = new URLSearchParams(location.search);
  const wsLink = (v:string,world?:string) => base+'?'+new URLSearchParams({view:v,...world?{world}:{} });
  function anchor(text:string,href:string) {const a=document.createElement('a');a.textContent=text;a.href=href;return a;}
  function route(v:string,world?:string){
    root!.dataset.view=v;
    document.getElementById('ws-page-title')!.textContent=titles[v]??v;
    const tail=document.getElementById('ws-crumb-tail')!;tail.replaceChildren();
    const returnUrl=sessionStorage.getItem('plotstay:works-return')??wsLink('works');
    const returnView=new URL(returnUrl,location.origin).searchParams.get('view');
    if(v==='editor'){
      if(returnView==='world-content'&&world)tail.append(anchor(l('我管理的世界','Worlds I manage'),wsLink('worlds')),document.createTextNode(' / '),anchor(l('世界内容','World content'),returnUrl));
      else tail.append(anchor(titles.works!,returnUrl));
      tail.append(document.createTextNode(' / '+titles.editor));
    }
    else if(world){tail.append(anchor(l('我管理的世界','Worlds I manage'),wsLink('worlds')),document.createTextNode(' / '));if(v==='world-content')tail.append(document.createTextNode(titles[v]??v));else tail.append(anchor(l('世界内容','World content'),wsLink('world-content',world)),document.createTextNode(' / '+(titles[v]??v)));}
    else tail.textContent=titles[v]??v;
    const back=document.getElementById('ws-back') as HTMLAnchorElement;
    back.href=v==='editor'?returnUrl:world?wsLink('worlds'):base;
    back.textContent='← '+(v==='editor'&&returnView==='world-content'?l('返回世界内容','Back to world content'):v==='editor'?l('返回作品列表','Back to works'):world?l('返回世界管理','Back to worlds'):l('返回工作台','Back to workspace'));
    for(const a of root!.querySelectorAll<HTMLAnchorElement>('.ws-nav a'))a.removeAttribute('aria-current');
    const selected=root!.querySelector<HTMLAnchorElement>(`.ws-nav a[href="${v==='editor'?wsLink('works'):v.startsWith('world-')?wsLink('worlds'):wsLink(v)}"]`);
    selected?.setAttribute('aria-current','page');
    for(const a of root!.querySelectorAll<HTMLAnchorElement>('.ws-world-nav a'))a.setAttribute('aria-current',String(new URL(a.href).searchParams.get('view')===v));
  }
  route(view,q.get('world')??undefined);
  window.addEventListener('workspace:editor',((event:CustomEvent<{id:string;title:string;world?:string}>)=>{
    const detail=event.detail;const current=new URL(location.href);
    if(root!.dataset.view!=='editor')sessionStorage.setItem('plotstay:works-return',current.pathname+current.search);
    current.searchParams.set('view','editor');current.searchParams.set('content',detail.id);
    if(detail.world)current.searchParams.set('world',detail.world);
    history.pushState({workspace:true},'',current);
    route('editor',current.searchParams.get('world')??undefined);
    document.getElementById('ws-page-title')!.textContent=l('编辑','Edit ')+detail.title;
  }) as EventListener);
  window.addEventListener('popstate',()=>{const current=new URL(location.href);if(current.searchParams.get('view')==='editor')return;const guard=new Event('workspace:leave',{cancelable:true});window.dispatchEvent(guard);if(guard.defaultPrevented){history.forward();return;}location.reload();});
  const overview=document.getElementById('ws-overview')!, worldsPanel=document.getElementById('ws-worlds')!, settings=document.getElementById('ws-settings')!,membersPanel=document.getElementById('ws-members')!;
  overview.hidden=view!=='overview';worldsPanel.hidden=view!=='worlds';settings.hidden=view!=='settings';membersPanel.hidden=view!=='world-members';
  async function get(path:string){const response=await fetch('/api'+path,{credentials:'same-origin'});const data=await response.json();if(!response.ok)throw new Error(data.error?.message??l('无法载入工作台','Could not load workspace'));return data;}
  async function load(){
    const worldRequest=['overview','worlds'].includes(view)?get('/admin/worlds').then(data=>({data,error:null}),(error:Error)=>({data:null,error})):null;
    const overviewRequests=view==='overview'?Promise.allSettled([get('/me/personas'),get('/me/reviews?page=1'),get('/me/provider-reviews?page=1')]):null;
    if(!['overview','worlds','settings','world-members'].includes(view)){
      const auth=await get('/auth/me').catch(()=>null);
      if(auth?.actor?.email)document.getElementById('ws-account-name')!.textContent=auth.actor.email;
      root!.querySelector<HTMLElement>('.ws-site-link')!.hidden=auth?.actor?.siteRole!=='admin';
      const world=q.get('world');if(world&&view.startsWith('world-')){const worlds=(await get('/admin/worlds')).worlds;const selected=worlds.find((item:any)=>item.id===world);if(!selected)throw new Error(l('无权访问这个世界。','This world is unavailable.'));document.getElementById('ws-context')!.textContent=selected.translations?.[root!.dataset.locale!]?.name??selected.slug;const canManage=auth?.actor?.siteRole==='admin'||['owner','admin'].includes(selected.role)||selected.owner_id===auth?.actor?.id;for(const a of root!.querySelectorAll<HTMLAnchorElement>('.ws-world-nav a'))if(['world-review','world-members'].includes(new URL(a.href).searchParams.get('view')??''))a.hidden=!canManage;if(view==='world-review'&&!canManage){document.getElementById('admin')!.hidden=true;document.getElementById('ws-message')!.textContent=l('此账号只有内容编辑权限，不能审核。','This account can edit content but cannot review it.');}}
      return;
    }
    const auth=await get('/auth/me');
    document.getElementById('ws-account-name')!.textContent=auth.actor.email;
    root!.querySelector<HTMLElement>('.ws-site-link')!.hidden=auth.actor.siteRole!=='admin';
    if(view==='world-members'){
      const world=q.get('world');if(!world)throw new Error(l('请选择世界。','Choose a world.'));
      const data=await get(`/admin/worlds/${world}/members`);const list=document.getElementById('ws-member-list')!;
      const title=document.createElement('h2');title.textContent=l('管理成员与权限','Management members and permissions');list.append(title);
      for(const member of [{...data.owner,role:'owner'},...data.members]){const card=document.createElement('article');card.className='ws-card';const h=document.createElement('h3');h.textContent=member.email;const p=document.createElement('p');p.textContent=member.role;card.append(h,p);list.append(card);}
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
      for(const world of data.worlds){const card=document.createElement('article');card.className='ws-card';const h=document.createElement('h2');h.textContent=world.translations?.[root!.dataset.locale!]?.name??world.slug;const status=document.createElement('p');status.textContent=world.role??l('管理者','Manager');const nav=document.createElement('nav');nav.className='ws-world-actions';for(const [v,label] of [['world-content',l('内容','Content')],['world-review',l('审核','Moderation')],['world-settings',l('设定与共享资料','Settings')],['world-tools',l('导入与翻译','Tools')],['world-members',l('成员','Members')]] as const)nav.append(anchor(label,wsLink(v,world.id)));card.append(h,status,nav);list.append(card);}
    }
    if(view==='overview'){
      const todo=document.getElementById('ws-todo')!,continueBox=document.getElementById('ws-continue')!,recent=document.getElementById('ws-recent')!;
      const [profiles,reviews,inbox]=(await overviewRequests!).map(result=>{if(result.status==='rejected')throw result.reason;return result.value;});
      todo.replaceChildren();continueBox.replaceChildren();recent.replaceChildren();
      const row=(titleText:string,description:string,action:string,href:string,attention=false)=>{const item=document.createElement('div');item.className='ws-list-row';if(attention){const dot=document.createElement('i');dot.className='ws-dot';dot.setAttribute('aria-hidden','true');item.append(dot);}const copy=document.createElement('div');copy.className='ws-list-copy';const h=document.createElement('h3');h.textContent=titleText;const p=document.createElement('p');p.textContent=description;copy.append(h,p);const a=anchor(action,href);a.className='ws-row-action';item.append(copy,a);return item;};
      for(const p of profiles.personas.slice(0,5)){
        const name=p.draft?.[root!.dataset.locale!]?.name??(Object.values(p.draft??{})[0] as any)?.name??l('未命名角色','Unnamed persona');
        if(p.decision==='rejected')todo.append(row(name,l('角色资料已退回，请查看意见。','Profile returned; review the feedback.'),l('查看意见','View feedback'),wsLink('personas'),true));
        else if(p.head_revision_id!==p.submitted_revision_id&&p.head_revision_id!==p.published_revision_id)continueBox.append(row(name,l('角色草稿已保存，尚未提交。','Profile draft saved but not submitted.'),l('编辑资料','Edit profile'),wsLink('personas')));
        else if(p.published_revision_id)recent.append(row(name,l('角色资料已批准。','Profile approved.'),l('查看角色','View persona'),wsLink('personas')));
      }
      for(const r of reviews.items.slice(0,5)){
        const href=wsLink('reviews')+'&review='+encodeURIComponent(r.id);
        if(r.status==='rejected')todo.append(row(r.title??l('评价','Review'),l('评价已退回，请查看意见。','Review returned; check the feedback.'),l('查看意见','View feedback'),href,true));
        else if(r.status==='draft')continueBox.append(row(r.title??l('评价草稿','Review draft'),l('评价草稿尚未提交。','Review draft not yet submitted.'),l('继续编辑','Continue'),href));
      }
      for(const r of inbox.items?.slice(0,3)??[])todo.append(row(r.title??r.target_slug,l('作品收到一条评价。','A review arrived for your work.'),l('去回复','Reply'),wsLink('replies')+'&reply='+encodeURIComponent(r.id),true));
      const todoLoading=document.createElement('p'),workLoading=document.createElement('p');
      for(const p of [todoLoading,workLoading]){p.className='ws-loading';p.textContent=l('正在载入世界内容…','Loading world content…');}
      if(data.worlds.length){todo.append(todoLoading);continueBox.append(workLoading);}
      let failedWorlds=0;
      await Promise.all(data.worlds.map(async(world:any)=>{
        const results=await Promise.allSettled([get(`/admin/worlds/${world.id}/contents?status=submitted&page=1`),get(`/admin/worlds/${world.id}/contents?page=1`)]);
        if(results.some(result=>result.status==='rejected'))failedWorlds++;
        const [pendingResult,contentsResult]=results;const pending=pendingResult.status==='fulfilled'?pendingResult.value:{total:0};const contents=contentsResult.status==='fulfilled'?contentsResult.value:{contents:[]};
        const worldName=world.translations?.[root!.dataset.locale!]?.name??world.slug;
        if(pending.total)todo.append(row(worldName,l(`${pending.total} 件作品待审核`,`${pending.total} works await review`),l('去审核','Review'),wsLink('world-review',world.id),true));
        for(const content of contents.contents.slice(0,2))continueBox.append(row(content.title,`${worldName} · ${content.kind} · ${content.status}`,l('继续编辑','Continue editing'),wsLink('editor',world.id)+'&content='+encodeURIComponent(content.id)));
      }));
      todoLoading.remove();workLoading.remove();
      if(failedWorlds){const notice=document.createElement('p');notice.className='ws-empty';notice.textContent=l(`${failedWorlds} 个世界的内容暂未载入，请刷新重试。`,`${failedWorlds} world summaries could not load. Refresh to retry.`);todo.append(notice);}
      document.getElementById('ws-todo-count')!.textContent=l(`${todo.children.length} 项`,`${todo.children.length} items`);
      if(!todo.children.length){const p=document.createElement('p');p.className='ws-empty';p.textContent=l('目前没有需要处理的事。','Nothing needs your attention right now.');todo.append(p);}
      if(!continueBox.children.length){const p=document.createElement('p');p.className='ws-empty';p.textContent=l('还没有正在编辑的内容。可以从角色或已有世界开始。','No work in progress. Start with a persona or an existing world.');continueBox.append(p);}
      if(!recent.children.length){const p=document.createElement('p');p.className='ws-empty';p.textContent=l('审核和发布状态会显示在这里。','Review and publication updates will appear here.');recent.append(p);}
    }
  }
  void load().catch(error=>{const box=document.getElementById('ws-message')!;box.textContent=error.message+' ';box.append(anchor(l('前往旧版登录','Sign in through previous account'),`/${prefix}/account`));for(const id of ['ws-todo','ws-continue','ws-recent']){const target=document.getElementById(id);if(target?.querySelector('.ws-loading')){const p=document.createElement('p');p.className='ws-empty';p.textContent=l('载入失败，请刷新重试。','Could not load this section. Refresh to retry.');target.replaceChildren(p);}}});
}
