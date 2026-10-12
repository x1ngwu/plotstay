// A stale task link must never silently operate on a newer version.
export function workspaceRevision(container:HTMLElement,current:string|undefined,revisions:any[],locale:string){
 if(!document.getElementById('new-workspace'))return false;
 const q=new URLSearchParams(location.search),requested=q.get('revision');
 if(!requested||requested===current)return false;
 const zh=locale==='zh-CN',l=(a:string,b:string)=>zh?a:b;
 const selected=revisions.find(r=>r.id===requested),box=document.createElement('section');box.className='ws-panel';
 const h=document.createElement('h2');h.textContent=l('查看指定版本','Viewing the linked version');
 const note=document.createElement('p');note.textContent=selected?l('这条事项指向历史版本。下方仅供查看；继续操作前请打开当前版本。','This item links to a previous version. It is read only. Open the current version to continue.'):l('指定版本已不可用，请重新核对当前状态。','The linked version is unavailable. Check the current state.');
 box.append(h,note);
 if(selected){const body=selected.translations?.[locale]??selected.source_text??selected.body?.[locale]??selected.body??{};const title=document.createElement('h3');title.textContent=body.title??body.name??'';const text=document.createElement('p');text.style.whiteSpace='pre-wrap';text.textContent=typeof body==='string'?body:body.description??body.bio??'';box.append(title,text);if(selected.created_at){const time=document.createElement('time');time.textContent=new Date(selected.created_at).toLocaleString(locale);box.append(time);}}
 const a=document.createElement('a');const url=new URL(location.href);url.searchParams.delete('revision');url.searchParams.delete('event');a.href=url.pathname+url.search;a.textContent=l('打开当前版本','Open current version');box.append(a);container.replaceChildren(box);return true;
}
export function clearWorkspaceRevision(){
 if(!document.getElementById('new-workspace'))return;
 const url=new URL(location.href);if(!url.searchParams.has('revision')&&!url.searchParams.has('event'))return;
 url.searchParams.delete('revision');url.searchParams.delete('event');history.replaceState(history.state,'',url);
}
