// Runs inline before the editor bundles download. Responses belong to this document.
(() => {
  const entries = new Map();
  let active = true;
  const key = path => {
    const url = new URL('/api' + path, location.origin);
    url.searchParams.sort();
    return url.pathname + url.search;
  };
  const start = path => {
    if (!active) return Promise.resolve(null);
    const id = key(path);
    if (!entries.has(id)) entries.set(id, {
      readers: new Set(),
      response: fetch('/api' + path, { credentials: 'same-origin', cache: 'no-store' }).catch(() => null),
    });
    return entries.get(id).response;
  };
  const clear = () => { active = false; entries.clear(); };
  window.__plotstayWorkspace = {
    clear,
    async request(path, consumer, init = {}) {
      if (init.method && init.method !== 'GET') clear();
      else {
        const entry = entries.get(key(path));
        if (entry && !entry.readers.has(consumer)) {
          entry.readers.add(consumer);
          const response = await entry.response;
          if (response) return response.clone();
        }
      }
      return fetch('/api' + path, { credentials: 'same-origin', ...init });
    },
  };
  // Release unused responses even if initialization fails or an optional module never loads.
  setTimeout(clear, 30000);
  const json = async promise => {
    const response = await promise;
    return response?.ok ? response.clone().json().catch(() => null) : null;
  };
  const query = new URLSearchParams(location.search);
  const view = query.get('view') || 'overview';
  const authorEditor=view==='editor'&&query.get('author')==='1';
  const admin = ['editor', 'world-content', 'world-review', 'world-settings', 'world-tools'].includes(view)&&!authorEditor;
  const account = ['personas', 'reviews', 'replies', 'moderation', 'site'].includes(view);
  start('/auth/me');
  if (admin) start('/locales');
  const worlds = admin || account || ['worlds', 'world-members'].includes(view)
    ? json(start('/admin/worlds')) : null;
  if (view === 'overview') { const prefix = location.pathname.split('/')[1]; start('/me/workspace' + (query.has('section') ? '/items' : '') + '?' + new URLSearchParams({locale: prefix === 'zh' ? 'zh-CN' : 'en', ...query.has('section') ? Object.fromEntries(['section','scope','group','page'].filter(k=>query.has(k)).map(k=>[k,query.get(k)])) : {}})); }
  if (view === 'personas') start('/me/personas');
  if (view === 'reviews' || view === 'replies') start('/me/personas');
  const loadWorld = world => {
    if (!world || !active) return;
    const base = '/admin/worlds/' + encodeURIComponent(world);
    if (['works', 'world-content', 'world-review'].includes(view)) {
      const params = new URLSearchParams({ page: String(Math.max(1, Number(query.get('page')) || 1)) });
      for (const name of ['kind', 'q', 'status', 'parentId']) if (query.get(name)) params.set(name, query.get(name));
      if (view === 'world-review' && !query.has('status')) params.set('status', 'submitted');
      start(base + '/contents?' + params);
    }
    if (view === 'editor') {
      start(base + '/options');
      if (query.get('content')) start('/admin/contents/' + encodeURIComponent(query.get('content')));
    }
    if (view === 'world-members') start(base + '/members');
    if (view === 'world-tools') start(base + '/imports');
    if (view === 'world-settings') {
      start(base + '/options');
      void json(start(base + '/settings')).then(data => {
        const setting=query.get('setting');
        if(setting==='home')start(base+'/home');
        else if(setting&&data?.settings?.some(s=>s.id===setting))start('/admin/settings/'+setting);
        else if(!setting&&data?.settings?.length)start('/admin/settings/'+data.settings[0].id);
      });
    }
  };
  if (query.get('world')&&admin) loadWorld(query.get('world'));
  else if (admin && worlds) void worlds.then(data => loadWorld((data?.worlds?.find(world => world.slug === 'lathe-worlds') || data?.worlds?.[0])?.id));
})();
