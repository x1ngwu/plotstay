const root = document.querySelector<HTMLElement>('#new-workspace');
if (root) {
  const zh = root.dataset.locale === 'zh-CN';
  const l = (a:string,b:string) => zh?a:b;
  const prefix = root.dataset.prefix!;
  const base = `/${prefix}/workspace`;
  const view = root.dataset.view ?? 'overview';
  const titles:Record<string,string> = {overview:l('概览','Overview'),works:l('我的作品','My works'),editor:l('作品编辑','Edit work'),personas:l('我的角色','My personas'),reviews:l('评价与回复','Reviews and replies'),replies:l('评价与回复','Reviews and replies'),worlds:l('我管理的世界','Worlds I manage'),'world-content':l('世界内容','World content'),'world-settings':l('世界设定','World settings'),'world-tools':l('管理工具','Management tools'),'world-review':l('世界审核','World moderation'),'world-members':l('成员','Members'),moderation:l('世界审核','World moderation'),site:l('网站审核','Site moderation'),settings:l('账号设置','Account settings')};
  const q = new URLSearchParams(location.search);
  const wsLink = (v:string,world?:string) => base+'?'+new URLSearchParams({view:v,...world?{world}:{} });
  function anchor(text:string,href:string) {const a=document.createElement('a');a.textContent=text;a.href=href;return a;}
  function route(v:string,world?:string){
    root!.dataset.view=v;
    document.getElementById('ws-page-title')!.textContent=titles[v]??v;
    const tail=document.getElementById('ws-crumb-tail')!;tail.replaceChildren();
    if(world){tail.append(anchor(l('我管理的世界','Worlds I manage'),wsLink('worlds')),document.createTextNode(' / '));if(v==='world-content')tail.append(document.createTextNode(titles[v]??v));else tail.append(anchor(l('世界内容','World content'),wsLink('world-content',world)),document.createTextNode(' / '+(titles[v]??v)));}
    else if(v==='editor'){tail.append(anchor(titles.works!,sessionStorage.getItem('plotstay:works-return')??wsLink('works')),document.createTextNode(' / '+titles.editor));}
    else tail.textContent=titles[v]??v;
    const back=document.getElementById('ws-back') as HTMLAnchorElement;
    back.href=v==='editor'?sessionStorage.getItem('plotstay:works-return')??wsLink('works'):world?wsLink('worlds'):base;
    back.textContent='← '+(v==='editor'?l('返回作品列表','Back to works'):world?l('返回世界管理','Back to worlds'):l('返回工作台','Back to workspace'));
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
    document.getElementById('ws-context')!.textContent=detail.title;
  }) as EventListener);
  window.addEventListener('popstate',()=>{const current=new URL(location.href);if(current.searchParams.get('view')==='editor')return;const guard=new Event('workspace:leave',{cancelable:true});window.dispatchEvent(guard);if(guard.defaultPrevented){history.forward();return;}location.reload();});
  const overview=document.getElementById('ws-overview')!, worldsPanel=document.getElementById('ws-worlds')!, settings=document.getElementById('ws-settings')!,membersPanel=document.getElementById('ws-members')!;
  overview.hidden=view!=='overview';worldsPanel.hidden=view!=='worlds';settings.hidden=view!=='settings';membersPanel.hidden=view!=='world-members';
  async function get(path:string){const response=await fetch('/api'+path,{credentials:'same-origin'});const data=await response.json();if(!response.ok)throw new Error(data.error?.message??l('无法载入工作台','Could not load workspace'));return data;}
  async function load(){
    if(!['overview','worlds','settings','world-members'].includes(view)){
      const auth=await get('/auth/me').catch(()=>null);
      root!.querySelector<HTMLElement>('.ws-site-link')!.hidden=auth?.actor?.siteRole!=='admin';
      const world=q.get('world');if(world&&view.startsWith('world-')){const worlds=(await get('/admin/worlds')).worlds;const selected=worlds.find((item:any)=>item.id===world);if(!selected)throw new Error(l('无权访问这个世界。','This world is unavailable.'));document.getElementById('ws-context')!.textContent=selected.translations?.[root!.dataset.locale!]?.name??selected.slug;const canManage=auth?.actor?.siteRole==='admin'||['owner','admin'].includes(selected.role)||selected.owner_id===auth?.actor?.id;for(const a of root!.querySelectorAll<HTMLAnchorElement>('.ws-world-nav a'))if(['world-review','world-members'].includes(new URL(a.href).searchParams.get('view')??''))a.hidden=!canManage;if(view==='world-review'&&!canManage){document.getElementById('admin')!.hidden=true;document.getElementById('ws-message')!.textContent=l('此账号只有内容编辑权限，不能审核。','This account can edit content but cannot review it.');}}
      return;
    }
    const auth=await get('/auth/me');
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
    }
    const data=await get('/admin/worlds');
    if(view==='worlds'){
      const list=document.getElementById('ws-world-list')!;list.replaceChildren();
      if(!data.worlds.length){const p=document.createElement('p');p.textContent=l('当前账号没有可管理的世界。','This account does not manage a world.');list.append(p);}
      for(const world of data.worlds){const card=document.createElement('article');card.className='ws-card';const h=document.createElement('h2');h.textContent=world.translations?.[root!.dataset.locale!]?.name??world.slug;const status=document.createElement('p');status.textContent=world.role??l('管理者','Manager');const nav=document.createElement('nav');nav.className='ws-world-actions';for(const [v,label] of [['world-content',l('内容','Content')],['world-review',l('审核','Moderation')],['world-settings',l('设定与共享资料','Settings')],['world-tools',l('导入与翻译','Tools')],['world-members',l('成员','Members')]] as const)nav.append(anchor(label,wsLink(v,world.id)));card.append(h,status,nav);list.append(card);}
    }
    if(view==='overview'){
      const recent=document.getElementById('ws-recent')!;recent.replaceChildren();
      const [profiles,reviews,inbox]=await Promise.all([get('/me/personas'),get('/me/reviews?page=1'),get('/me/provider-reviews?page=1')]);
      const h=document.createElement('h2');h.textContent=l('待处理与最近状态','Tasks and recent status');recent.append(h);
      const items=document.createElement('div');items.className='ws-card-grid';recent.append(items);
      for(const p of profiles.personas.filter((p:any)=>p.decision==='rejected'||p.head_revision_id!==p.submitted_revision_id&&p.head_revision_id!==p.published_revision_id).slice(0,4)){
        const card=document.createElement('article');card.className='ws-card';const title=document.createElement('h3');title.textContent=p.draft?.[root!.dataset.locale!]?.name??(Object.values(p.draft??{})[0] as any)?.name??l('未命名角色','Unnamed persona');const status=document.createElement('p');status.textContent=p.decision==='rejected'?l('资料已退回','Profile returned'):l('有未提交的角色草稿','Unsubmitted profile draft');card.append(title,status,anchor(l('继续编辑 →','Continue →'),wsLink('personas')));items.append(card);
      }
      for(const r of reviews.items.filter((r:any)=>['draft','rejected'].includes(r.status)).slice(0,4)){const card=document.createElement('article');card.className='ws-card';const title=document.createElement('h3');title.textContent=r.title??l('评价草稿','Review draft');const status=document.createElement('p');status.textContent=r.status==='rejected'?l('评价已退回','Review returned'):l('评价草稿','Review draft');card.append(title,status,anchor(l('继续编辑 →','Continue →'),wsLink('reviews')+'&review='+encodeURIComponent(r.id)));items.append(card);}
      for(const r of inbox.items?.slice(0,2)??[]){const card=document.createElement('article');card.className='ws-card';const title=document.createElement('h3');title.textContent=r.title??r.target_slug;const status=document.createElement('p');status.textContent=l('作品收到评价','Review received on your work');card.append(title,status,anchor(l('查看回复 →','View reply →'),wsLink('replies')+'&reply='+encodeURIComponent(r.id)));items.append(card);}
      for(const world of data.worlds){const pending=await get(`/admin/worlds/${world.id}/contents?status=submitted&page=1`);const card=document.createElement('article');card.className='ws-card';const title=document.createElement('h3');title.textContent=world.translations?.[root!.dataset.locale!]?.name??world.slug;const status=document.createElement('p');status.textContent=pending.total?l(`${pending.total} 件作品待审核`,`${pending.total} works awaiting review`):l('当前没有待审作品','No works awaiting review');card.append(title,status,anchor(l('进入世界 →','Open world →'),wsLink('world-content',world.id)));items.append(card);}
      if(!items.children.length){const p=document.createElement('p');p.textContent=l('目前没有待办；可以创建角色，或从公开作品开始写评价。','No tasks right now. Create a persona or start a review from a published entry.');recent.append(p);}
    }
  }
  void load().catch(error=>{const box=document.getElementById('ws-message')!;box.textContent=error.message+' ';box.append(anchor(l('前往旧版登录','Sign in through previous account'),`/${prefix}/account`));});
}
