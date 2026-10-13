import { PERSONA_NOTES_LIMIT } from '@plotstay/contracts';
type Profile = {
    name: string;
    bio: string;
    avatar?: string;
};
type Profiles = Record<string, Profile>;
type Persona = {
    id: string;
    disabled: boolean;
    approved: boolean;
    setting_id: string | null;
    head_revision_id: string | null;
    submitted_revision_id: string | null;
    published_revision_id: string | null;
    draft: Profiles | null;
    published: Profiles;
    updated_at: string;
    created_at: string;
    decision?: string;
    last_rejection?: {
        revisionId: string;
        note: string;
        createdAt: string;
    };
};
type Note = {
    body: string;
    version: string | null;
    updatedAt: string | null;
};
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const clone = <T>(v: T): T => structuredClone(v);
const colors: Record<string, string> = { mint: '#b8f264', amber: '#ffd36e', violet: '#c9b0ff', sky: '#a4ddf5' };
const avatar = (value?: string) => `<svg aria-hidden="true" viewBox="0 0 64 64"><rect width="64" height="64" fill="${colors[value ?? 'mint'] ?? colors.mint}"/><circle cx="32" cy="23" r="11" fill="#26332b"/><path d="M12 58V46q20-23 40 0v12" fill="#26332b"/></svg>`;
const emptyProfiles = (): Profiles => ({ 'zh-CN': { name: '', bio: '', avatar: 'mint' }, en: { name: '', bio: '', avatar: 'mint' } });
// Compare editable values in a stable order, including the form's defaults.
const profileSnapshot = (value: Profiles) => JSON.stringify(Object.entries({ ...emptyProfiles(), ...value })
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([locale, p]) => [locale, p.name, p.bio, p.avatar ?? 'mint']));
export async function initWorkspacePersonas(root: HTMLElement) {
    const shell = document.getElementById('new-workspace')!;
    shell.dataset.personaController = 'true';
    const view = document.getElementById('account-view')!, content = document.getElementById('account-content')!, message = document.getElementById('persona-message')!;
    const login = document.getElementById('account-login') as HTMLFormElement;
    const head = document.getElementById('ws-page-title')!, context = document.getElementById('ws-context')!, back = document.getElementById('ws-back') as HTMLAnchorElement, action = document.getElementById('ws-head-action') as HTMLAnchorElement;
    view.classList.add('wp-personas');
    let zh = root.dataset.locale === 'zh-CN', editLocale = zh ? 'zh-CN' : 'en', tab = 'public';
    let actor: any, personas: Persona[] = [], current: Persona | undefined, editing = false, historical: any = null, historyData: any = null;
    let profiles = emptyProfiles(), savedProfiles = profileSnapshot(profiles), note: Note = { body: '', version: null, updatedAt: null }, noteText = '', notesReady = false;
    let publicBusy = false, notesBusy = false, notesLoading = false, publicStatus = '', notesStatus = '', notesError = false, publicError = false;
    let notesLoadRequest = 0, navigationRequest = 0;
    let lastPublic: {
        key: string;
        body: any;
    } | undefined, lastNotes: {
        key: string;
        body: any;
    } | undefined;
    let href = location.href, index = Number(history.state?.personaIndex ?? 0), sequence = 0, popRestoring = false;
    history.replaceState({ ...history.state, personaIndex: index }, '', href);
    const l = (a: string, b: string) => zh ? a : b;
    const prefix = () => zh ? 'zh' : 'en';
    const listUrl = () => `/${prefix()}/workspace?view=personas`;
    const dirtyPublic = () => editing && !historical && profileSnapshot(profiles) !== savedProfiles;
    const dirtyNotes = () => editing && !historical && noteText !== note.body;
    const dirty = () => dirtyPublic() || dirtyNotes();
    const guard = () => !publicBusy && !notesBusy && (!dirty() || confirm(l('对外资料或角色笔记有未保存输入。离开并放弃这些修改？', 'Public profile or private notes have unsaved changes. Leave and discard them?')));
    const date = (value: string) => new Date(value).toLocaleString(zh ? 'zh-CN' : 'en', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const short = (value: string | null | undefined) => value ? value.slice(0, 8) : '—';
    const status = (p: Persona) => ({ live: Boolean(p.published_revision_id || p.approved), pending: Boolean(p.submitted_revision_id), draft: Boolean(p.head_revision_id && p.head_revision_id !== p.submitted_revision_id && p.head_revision_id !== p.published_revision_id && p.decision !== 'rejected' && p.decision !== 'approved'), returned: p.decision === 'rejected', disabled: p.disabled });
    const statusLabels = () => ({ live: l('已生效', 'Published'), pending: l('待审核', 'In review'), draft: l('有草稿', 'Draft'), returned: l('已退回', 'Returned'), disabled: l('已停用', 'Disabled') });
    const badges = (p: Persona) => Object.entries(status(p)).filter(([, yes]) => yes).map(([key]) => `<span class="wp-badge wp-${key}">${statusLabels()[key as keyof ReturnType<typeof statusLabels>]}</span>`).join('');
    const profile = (p: Persona) => { const data = p.draft ?? p.published; return data[zh ? 'zh-CN' : 'en'] ?? data.en ?? data['zh-CN'] ?? { name: l('未命名角色', 'Unnamed persona'), bio: '' }; };
    function fail(error: any) {
        const messages: Record<string, string> = { SESSION_REQUIRED: l('会话已过期。请重新登录；私人笔记已从当前页面清除。', 'Session expired. Sign in again; private notes have been cleared from this page.'), INVALID_CREDENTIALS: l('邮箱或密码不正确。', 'Email or password is incorrect.'), REVISION_CONFLICT: l('已有更新版本。输入仍保留，请核对最新资料后重试。', 'A newer version exists. Your input is preserved. Compare the latest profile before retrying.'), SUBMISSION_CONFLICT: l('待审版本已变化。输入仍保留，请核对当前待审稿。', 'The pending version changed. Your input is preserved; check the current submission.'), NOTES_CONFLICT: l('笔记已在另一个窗口更新。输入仍保留，请核对最新笔记。', 'Notes changed in another window. Your input is preserved; compare the latest notes.'), PERSONA_FORBIDDEN: l('只能访问本人角色。', 'You can only access your own personas.'), PERSONA_DISABLED: l('角色已停用，对外资料不能保存；仍可保存自己的笔记。', 'This persona is disabled. Public changes are unavailable; you can still save your notes.'), TRANSLATIONS_REQUIRED: l('请填写中文和英文名字；也可先暂存草稿。', 'Complete the Chinese and English names, or save a draft first.'), INVALID_INPUT: l('资料不符合现有长度或格式要求，请检查输入。', 'Check the existing field length and format requirements.'), REQUEST_CONFLICT: l('重试请求与原操作不同，请重新保存。', 'The retry differs from the original request. Save again.') };
        return messages[error.code] ?? l('操作未完成。输入仍保留，请重试。', 'The operation did not complete. Your input is preserved; try again.');
    }
    function clearPrivate() { notesLoadRequest++; notesLoading = false; note = { body: '', version: null, updatedAt: null }; noteText = ''; notesReady = false; lastNotes = undefined; const input = view.querySelector<HTMLTextAreaElement>('#wp-notes'); if (input)
        input.value = ''; view.querySelector('#wp-notes-conflict')?.replaceChildren(); document.querySelectorAll('.wp-compare').forEach(el => el.remove()); }
    async function api(path: string, body?: unknown, method = 'POST') {
        const init = body === undefined ? {} : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
        const response = await (window.__plotstayWorkspace?.request(path, 'account', init) ?? fetch('/api' + path, { ...init, credentials: 'same-origin', cache: 'no-store' }));
        const data = await response.json();
        if (!response.ok) {
            if (data.error?.code === 'SESSION_REQUIRED') {
                sequence++;
                clearPrivate();
                content.inert = true;
                login.hidden = false;
                message.textContent = fail(data.error);
            }
            if (data.error?.code === 'PERSONA_FORBIDDEN' && path.endsWith('/notes')) {
                sequence++;
                clearPrivate();
                message.textContent = fail(data.error);
                void refreshIdentity();
            }
            throw Object.assign(new Error(data.error?.message), { code: data.error?.code });
        }
        return data;
    }
    function returnUrl() {
        const raw = new URL(location.href).searchParams.get('returnTo');
        if (raw)
            try {
                const u = new URL(raw, location.origin);
                if (u.origin === location.origin && /^\/(zh|en)\/workspace$/.test(u.pathname) && ['overview', 'personas'].includes(u.searchParams.get('view') ?? 'overview'))
                    return u.pathname + u.search;
            }
            catch { }
        return listUrl();
    }
    function header() {
        const title = editing ? historical ? l('查看历史版本', 'View previous version') : current ? l('编辑角色', 'Edit persona') : l('创建角色', 'Create persona') : l('我的角色', 'My personas');
        head.textContent = title;
        document.title = title + ' · Plotstay';
        context.textContent = editing ? l('对外资料与私人笔记分别保存。角色可以跨世界使用。', 'Save public profiles and private notes separately. A persona can travel across worlds.') : l('管理你在不同世界中使用的角色。创建新角色，编辑资料，开始新的故事。', 'Manage the personas you use across worlds. Create a persona, update a profile, begin a new story.');
        back.href = editing ? returnUrl() : `/${prefix()}/workspace`;
        back.textContent = '← ' + (editing ? new URL(back.href).searchParams.get('view') === 'personas' ? l('返回角色列表', 'Back to personas') : l('返回工作台首页', 'Back to overview') : l('返回工作台', 'Back to workspace'));
        document.getElementById('ws-crumb-tail')!.innerHTML = editing ? `<a href="${listUrl()}">${l('我的角色', 'My personas')}</a> / ${esc(title)}` : esc(title);
        action.hidden = editing;
        action.href = listUrl() + '&new=1&returnTo=' + encodeURIComponent(location.pathname + location.search);
        action.textContent = '+ ' + l('创建角色', 'Create persona');
    }
    function list() {
        header();
        const q = new URL(location.href).searchParams;
        view.innerHTML = `<div class="wp-toolbar"><div class="wp-filters" aria-label="${l('资料状态', 'Profile status')}"></div><div class="wp-tools"><label><span class="wp-sr">${l('搜索角色', 'Search personas')}</span><input id="wp-search" type="search" placeholder="${l('搜索名字或简介…', 'Search names or bios…')}" value="${esc(q.get('q') ?? '')}"></label><label><span class="wp-sr">${l('排序', 'Sort')}</span><select id="wp-sort"><option value="updated">${l('最近更新', 'Recently updated')}</option><option value="created">${l('最近创建', 'Recently created')}</option><option value="name">${l('名字', 'Name')}</option></select></label></div></div><p class="wp-sr" id="wp-results" role="status"></p><div class="wp-grid" id="wp-list"></div>`;
        (view.querySelector('#wp-sort') as HTMLSelectElement).value = q.get('sort') ?? 'updated';
        view.querySelector('#wp-search')!.addEventListener('input', () => updateListState());
        view.querySelector('#wp-sort')!.addEventListener('change', () => updateListState());
        listResults();
    }
    function updateListState(filter?: string) { const u = new URL(location.href); u.searchParams.set('q', (view.querySelector('#wp-search') as HTMLInputElement).value); u.searchParams.set('sort', (view.querySelector('#wp-sort') as HTMLSelectElement).value); if (filter)
        u.searchParams.set('filter', filter); history.replaceState(history.state, '', u); href = location.href; listResults(); }
    function listResults() {
        const q = new URL(location.href).searchParams, filter = q.get('filter') ?? 'all', search = (q.get('q') ?? '').trim().toLocaleLowerCase(), sort = q.get('sort') ?? 'updated';
        view.querySelector('.wp-filters')!.innerHTML = [['all', l('全部', 'All')], ...Object.entries(statusLabels())].map(([key, label]) => `<button type="button" data-filter="${key}" aria-pressed="${filter === key}">${label} <span>${personas.filter(p => key === 'all' || status(p)[key as keyof ReturnType<typeof status>]).length}</span></button>`).join('');
        for (const b of view.querySelectorAll<HTMLButtonElement>('[data-filter]'))
            b.onclick = () => updateListState(b.dataset.filter);
        const items = personas.filter(p => (filter === 'all' || status(p)[filter as keyof ReturnType<typeof status>]) && Object.values(p.draft ?? p.published).some(v => (v.name + ' ' + v.bio).toLocaleLowerCase().includes(search))).sort((a, b) => (sort === 'name' ? profile(a).name.localeCompare(profile(b).name, zh ? 'zh-CN' : 'en') : Date.parse(sort === 'created' ? b.created_at : b.updated_at) - Date.parse(sort === 'created' ? a.created_at : a.updated_at)) || a.id.localeCompare(b.id));
        view.querySelector('#wp-results')!.textContent = l(`${items.length} 个角色`, `${items.length} personas`);
        view.querySelector('#wp-list')!.innerHTML = items.map(p => { const v = profile(p); const url = new URL(location.href); url.searchParams.set('persona', p.id); url.searchParams.set('returnTo', location.pathname + location.search); return `<article class="wp-card" data-persona="${p.id}"><div class="wp-avatar">${avatar(v.avatar)}</div><div class="wp-card-copy"><h2>${esc(v.name)}</h2><p class="wp-bio">${esc(v.bio || l('还没有简介', 'No bio yet'))}</p><div class="wp-badges">${badges(p)}</div><time datetime="${esc(p.updated_at)}">${l('更新于 ', 'Updated ')}${esc(date(p.updated_at))}</time><a class="wp-edit" href="${esc(url.pathname + url.search)}">${l('编辑角色', 'Edit persona')}</a></div></article>`; }).join('') + `<a class="wp-create-card" href="${listUrl()}&new=1&returnTo=${encodeURIComponent(location.pathname + location.search)}"><span aria-hidden="true">＋</span><strong>${l('创建新角色', 'Create a persona')}</strong><span>${l('开始一个新的角色，在更多世界中相遇。', 'A new persona, and more worlds to discover.')}</span></a>`;
        if (!items.length) {
            view.querySelector('#wp-list')!.insertAdjacentHTML('afterbegin', `<div class="wp-empty"><p>${personas.length ? l('没有符合条件的角色。调整搜索或筛选试试。', 'No matches. Try a different search or filter.') : l('还没有角色。创建你的第一个角色。', 'No personas yet. Create your first one.')}</p>${personas.length ? `<button id="wp-clear-filters">${l('清除筛选', 'Clear filters')}</button>` : ''}</div>`);
            const clear = view.querySelector<HTMLButtonElement>('#wp-clear-filters');
            if (clear)
                clear.onclick = () => { (view.querySelector('#wp-search') as HTMLInputElement).value = ''; updateListState('all'); };
        }
    }
    function form() {
        header();
        if (historical) {
            renderHistorical();
            return;
        }
        view.innerHTML = `<div class="wp-editor"><nav class="wp-local" aria-label="${l('角色编辑栏目', 'Persona sections')}"><button data-tab="public" aria-pressed="${tab === 'public'}">${l('对外资料', 'Public profile')}</button><button data-tab="notes" aria-pressed="${tab === 'notes'}">${l('角色笔记', 'Private notes')}</button></nav><section class="wp-form-area"></section></div>`;
        for (const b of view.querySelectorAll<HTMLButtonElement>('[data-tab]'))
            b.onclick = () => { tab = b.dataset.tab!; form(); };
        if (tab === 'notes')
            notesForm();
        else
            publicForm();
    }
    function publicForm() {
        const area = view.querySelector('.wp-form-area')!, p = profiles[editLocale]!;
        const readonly = Boolean(current?.disabled);
        area.innerHTML = `${readonly ? `<p class="wp-notice">${l('角色已停用；对外资料不可修改，仍可保存仅自己可见的角色笔记。', 'This persona is disabled. You can still save your private notes.')}</p>` : ''}${current?.last_rejection ? `<p class="wp-notice">${l('版本 ', 'Version ')}${short(current.last_rejection.revisionId)} ${l('曾被退回。原因：', 'was returned. Reason: ')}${esc(current.last_rejection.note || l('未附加说明', 'No reason provided'))} ${current.last_rejection.revisionId !== current.head_revision_id ? l('该结论对应旧稿，当前新稿尚未沿用此结论。', 'This decision belongs to the earlier version.') : ''}</p>` : ''}<div class="wp-public-layout"><form id="wp-profile" class="wp-surface"><div class="wp-form-heading"><h2>${l('对外资料', 'Public profile')}</h2><label>${l('资料语言', 'Content language')}<select id="wp-language"><option value="zh-CN">中文</option><option value="en">English</option></select></label></div><p class="wp-muted">${l('只公开头像、名字和简介；无需指定唯一世界或房东／租客类型。', 'Only your avatar, name and bio are public. No single world or host/guest type is required.')}</p><fieldset ${readonly || publicBusy ? 'disabled' : ''}><legend class="wp-sr">${l('资料字段', 'Profile fields')}</legend><div class="wp-avatar-row"><div class="wp-avatar" id="wp-avatar">${avatar(p.avatar)}</div><label>${l('头像', 'Avatar')}<select name="${editLocale}.avatar" id="wp-avatar-choice">${[['mint', l('薄荷', 'Mint')], ['amber', l('琥珀', 'Amber')], ['violet', l('紫罗兰', 'Violet')], ['sky', l('天空', 'Sky')]].map(([v, label]) => `<option value="${v}">${label}</option>`).join('')}</select><small>${l('沿用现有头像样式', 'Choose an existing avatar style')}</small></label></div><label>${l('名字／昵称', 'Name / nickname')}<input name="${editLocale}.name" id="wp-name" value="${esc(p.name)}" autocomplete="off"></label><label>${l('个人简介', 'Bio / signature')}<textarea name="${editLocale}.bio" id="wp-bio" rows="5">${esc(p.bio)}</textarea><small>${l('这里的内容会对外展示。扮演时参考的私人内容请写入角色笔记。', 'This is public. Keep private roleplaying references in Private notes.')}</small></label></fieldset><p class="wp-save-state" id="wp-public-state" role="status"></p><div class="wp-actions"><button type="button" id="wp-draft" ${readonly || publicBusy ? 'disabled' : ''}>${l('暂存草稿', 'Save draft')}</button><button type="submit" class="wp-primary" id="wp-complete" ${readonly || publicBusy ? 'disabled' : ''}>${actor.siteRole === 'admin' ? l('保存并生效', 'Save and publish') : l('保存并提交', 'Save and submit')}</button></div><small>${actor.siteRole === 'admin' ? l('作为网站管理员，你提交的本人资料会直接生效。', 'As a site administrator, your own profile becomes effective immediately.') : l('提交后等待网站审核；已生效的旧资料继续使用。', 'Submissions await site review; the current published profile stays in use.')}</small></form><aside class="wp-surface wp-preview"><h2>${l('对外资料预览', 'Public profile preview')}</h2><div id="wp-preview"></div><small>${l('仅展示当前所选资料语言', 'Shows the selected content language')}</small></aside></div><details class="wp-history wp-surface"><summary>${l('资料状态与历史', 'Profile status and history')}</summary><div id="wp-version-state"></div><div id="wp-history"></div></details>`;
        (view.querySelector('#wp-language') as HTMLSelectElement).value = editLocale;
        view.querySelector('#wp-language')!.addEventListener('change', e => { editLocale = (e.target as HTMLSelectElement).value; publicForm(); });
        (view.querySelector('#wp-avatar-choice') as HTMLSelectElement).value = p.avatar ?? 'mint';
        const change = () => { profiles[editLocale] = { name: (view.querySelector('#wp-name') as HTMLInputElement).value, bio: (view.querySelector('#wp-bio') as HTMLTextAreaElement).value, avatar: (view.querySelector('#wp-avatar-choice') as HTMLSelectElement).value }; publicStatus = ''; publicError = false; preview(); states(); };
        view.querySelector('#wp-profile')!.addEventListener('input', change);
        view.querySelector('#wp-avatar-choice')!.addEventListener('change', change);
        view.querySelector<HTMLButtonElement>('#wp-draft')!.onclick = () => void savePublic('draft');
        view.querySelector<HTMLFormElement>('#wp-profile')!.onsubmit = e => { e.preventDefault(); void savePublic('complete'); };
        view.querySelector('details')!.addEventListener('toggle', e => { if ((e.target as HTMLDetailsElement).open)
            void loadHistory(); });
        versionState();
        preview();
        states();
    }
    function preview() { const p = profiles[editLocale]!; const a = view.querySelector('#wp-avatar'); if (a)
        a.innerHTML = avatar(p.avatar); const box = view.querySelector('#wp-preview'); if (box)
        box.innerHTML = `<div class="wp-avatar">${avatar(p.avatar)}</div><h3>${esc(p.name || l('你的名字', 'Your name'))}</h3><p>${esc(p.bio || l('写一句介绍自己的话。', 'A few words about your persona.'))}</p>`; }
    function versionState() {
        const box = view.querySelector('#wp-version-state');
        if (!box)
            return;
        if (!current) {
            box.innerHTML = `<p>${l('新角色尚未保存。任一语言填写名字后即可暂存草稿。', 'This persona has not been saved. Add a name in either language to save a draft.')}</p>`;
            return;
        }
        box.innerHTML = `<div class="wp-badges">${badges(current)}</div>${current.disabled ? `<p>${l('角色已停用；仅本人笔记可继续保存。', 'This persona is disabled. Your private notes can still be saved.')}</p>` : ''}<dl><dt>${l('当前资料版本', 'Current profile version')}</dt><dd>${short(current.head_revision_id)}</dd><dt>${l('待审版本', 'Pending version')}</dt><dd>${short(current.submitted_revision_id)}</dd><dt>${l('已生效版本', 'Published version')}</dt><dd>${short(current.published_revision_id)}</dd></dl><p>${l('暂存新草稿不撤回待审版本。再次提交才会替换待审稿；旧版已生效资料及历史署名保持不变。', 'Saving a draft keeps the pending version. Submitting replaces it; published profiles and historical signatures stay unchanged.')}</p>${current.last_rejection ? `<div class="wp-returned-note"><strong>${l('最近退回的版本 ', 'Last returned version ')}${short(current.last_rejection.revisionId)}</strong><p>${esc(current.last_rejection.note || l('未附加说明', 'No reason provided'))}</p><small>${esc(date(current.last_rejection.createdAt))} · ${current.last_rejection.revisionId === current.head_revision_id ? l('对应当前版本', 'Applies to the current version') : l('这是旧版本的审核结论，不代表当前新稿。', 'This decision applies to an earlier version, not the new draft.')}</small></div>` : ''}`;
    }
    async function loadHistory() { const box = view.querySelector('#wp-history'); if (!box || !current?.setting_id)
        return; const id = current.id; box.textContent = l('正在载入历史…', 'Loading history…'); try {
        historyData ??= await api('/admin/settings/' + current.setting_id);
        if (current?.id !== id || !box.isConnected)
            return;
        box.innerHTML = `<h3>${l('只读版本记录', 'Read-only versions')}</h3>` + historyData.revisions.map((r: any) => { const url = new URL(location.href); url.searchParams.set('revision', r.id); return `<p><a href="${esc(url.pathname + url.search)}">${short(r.id)} · ${esc(date(r.created_at))}</a></p>`; }).join('');
    }
    catch (error) {
        if (box.isConnected) {
            box.textContent = fail(error);
            const b = document.createElement('button');
            b.textContent = l('重试', 'Retry');
            b.onclick = () => void loadHistory();
            box.append(b);
        }
    } }
    function notesForm() {
        const area = view.querySelector('.wp-form-area')!;
        area.innerHTML = `<form id="wp-note-form" class="wp-surface wp-notes-form"><div class="wp-form-heading"><h2>${l('角色笔记', 'Private notes')}</h2><strong class="wp-private">${l('仅自己可见', 'Only you can see this')}</strong></div><p class="wp-muted">${l('记录性格、习惯或故事线索，作为扮演时的参考。不公开，不送审，无需双语。', 'Keep personality, habits and story references for roleplaying. Private, never reviewed; no bilingual requirement.')}</p>${!current ? `<p class="wp-notice">${l('可以先写笔记。请先在对外资料中填写任一语言的名字并暂存角色，再独立保存笔记。', 'You can write now. Save a persona draft with a name in either language before saving notes separately.')}</p>` : ''}<label for="wp-notes">${l('自由记录 · 仅自己可见', 'Your notes · private')}</label><textarea id="wp-notes" rows="14" ${notesBusy || notesLoading || (!notesReady && current) ? 'disabled' : ''}>${esc(noteText)}</textarea><div class="wp-note-meta"><small>${l('按字符计数，包含标点、空格与换行', 'Counts characters, including punctuation, spaces and newlines')}</small><span id="wp-count"></span></div><p id="wp-notes-state" class="wp-save-state" role="status"></p><div class="wp-actions"><button id="wp-save-notes" class="wp-primary" type="submit">${l('保存笔记', 'Save notes')}</button>${!notesReady && current ? `<button type="button" id="wp-load-notes">${l('重新载入', 'Reload notes')}</button>` : ''}</div><div id="wp-notes-conflict"></div></form>`;
        view.querySelector<HTMLTextAreaElement>('#wp-notes')!.oninput = e => { noteText = (e.target as HTMLTextAreaElement).value; notesStatus = ''; notesError = false; states(); };
        view.querySelector<HTMLFormElement>('#wp-note-form')!.onsubmit = e => { e.preventDefault(); void saveNotes(); };
        const retry = view.querySelector<HTMLButtonElement>('#wp-load-notes');
        if (retry)
            retry.onclick = () => void loadNotes();
        states();
        if (current && !notesReady && !notesLoading && !notesError)
            void loadNotes();
    }
    async function loadNotes() { if (!current || notesLoading)
        return; notesLoading = true; notesStatus = l('正在载入笔记…', 'Loading notes…'); states(); const id = current.id, seq = sequence, request = ++notesLoadRequest;
        const isCurrent = () => current?.id === id && seq === sequence && request === notesLoadRequest;
        try {
        const data = await api('/me/personas/' + id + '/notes');
        if (!isCurrent())
            return;
        note = data;
        noteText = data.body;
        notesReady = true;
        notesError = false;
        notesStatus = '';
    }
    catch (error) {
        if (isCurrent()) {
            notesStatus = fail(error);
            notesError = true;
        }
    }
    finally {
        if (isCurrent()) {
            notesLoading = false;
            if (tab === 'notes') notesForm();
        }
    } }
    function states() {
        const publicBox = view.querySelector('#wp-public-state');
        if (publicBox) {
            publicBox.textContent = publicBusy ? l('正在保存对外资料…', 'Saving public profile…') : publicStatus || (dirtyPublic() ? l('对外资料有未保存修改', 'Public profile has unsaved changes') : l('对外资料没有未保存修改', 'No unsaved public changes'));
            publicBox.classList.toggle('wp-error', publicError);
        }
        const notesBox = view.querySelector('#wp-notes-state');
        const count = Array.from(noteText).length;
        if (notesBox) {
            notesBox.textContent = notesBusy ? l('正在保存笔记…', 'Saving notes…') : count > PERSONA_NOTES_LIMIT ? l('笔记超过 2000 字，完整输入已保留。请缩短后保存。', 'Notes exceed 2000 characters. Your full input is preserved; shorten it to save.') : notesStatus || (dirtyNotes() ? l('笔记有未保存修改', 'Notes have unsaved changes') : notesReady ? l('笔记已保存', 'Notes saved') : l('笔记尚未保存', 'Notes not saved yet'));
            notesBox.classList.toggle('wp-error', notesError || count > PERSONA_NOTES_LIMIT);
        }
        const counter = view.querySelector('#wp-count');
        if (counter) {
            counter.textContent = `${count} / ${PERSONA_NOTES_LIMIT}`;
            counter.classList.toggle('wp-error', count > PERSONA_NOTES_LIMIT);
        }
        const save = view.querySelector<HTMLButtonElement>('#wp-save-notes');
        if (save)
            save.disabled = !current || !notesReady || notesBusy || notesLoading || count > PERSONA_NOTES_LIMIT || !dirtyNotes();
        const complete = view.querySelector<HTMLButtonElement>('#wp-complete');
        if (complete)
            complete.disabled = publicBusy || Boolean(current?.disabled) || Boolean(current && !dirtyPublic() && (current.head_revision_id === current.submitted_revision_id || current.head_revision_id === current.published_revision_id));
        for (const b of view.querySelectorAll<HTMLButtonElement>('[data-tab]'))
            b.classList.toggle('wp-unsaved', b.dataset.tab === 'public' ? dirtyPublic() : dirtyNotes());
    }
    async function savePublic(kind: 'draft' | 'complete') {
        if (publicBusy || current?.disabled)
            return;
        const payload: Profiles = {};
        for (const [locale, p] of Object.entries(profiles)) {
            if (p.name.trim())
                payload[locale] = { ...p, name: p.name.trim() };
            else if (p.bio) {
                publicStatus = l('有简介的语言也需要填写名字。', 'Add a name for each language containing a bio.');
                publicError = true;
                states();
                return;
            }
        }
        if (!Object.keys(payload).length || kind === 'complete' && (!payload.en || !payload['zh-CN'])) {
            publicStatus = kind === 'complete' ? fail({ code: 'TRANSLATIONS_REQUIRED' }) : l('请至少填写一个语言的名字。', 'Add a name in at least one language.');
            publicError = true;
            states();
            return;
        }
        if (Object.values(payload).some(p => p.name.length > 20000 || p.bio.length > 6000)) {
            publicStatus = fail({ code: 'INVALID_INPUT' });
            publicError = true;
            states();
            return;
        }
        if (kind === 'complete' && current?.submitted_revision_id && !confirm(l(`提交后会替换待审版本 ${short(current.submitted_revision_id)}。继续？`, `This will replace pending version ${short(current.submitted_revision_id)}. Continue?`)))
            return;
        const input = { ...(current ? { personaId: current.id } : {}), baseRevisionId: current?.head_revision_id ?? null, profiles: payload, action: kind, expectedSubmittedRevisionId: current?.submitted_revision_id ?? null };
        const key = JSON.stringify(input);
        if (lastPublic?.key !== key)
            lastPublic = { key, body: { ...input, requestId: crypto.randomUUID() } };
        publicBusy = true;
        navigationRequest++;
        publicError = false;
        publicForm();
        const saveSequence = sequence;
        try {
            const result = await api('/me/personas/save', lastPublic!.body);
            if (saveSequence !== sequence) return;
            savedProfiles = profileSnapshot(profiles);
            historyData = null;
            lastPublic = undefined;
            const created = !current;
            current = { ...current, id: result.id, head_revision_id: result.revisionId, setting_id: result.settingId, disabled: false, approved: current?.approved || result.outcome === 'published', draft: clone(payload), published: result.outcome === 'published' ? clone(payload) : current?.published ?? {}, submitted_revision_id: result.outcome === 'submitted' ? result.revisionId : result.outcome === 'published' ? null : current?.submitted_revision_id ?? null, published_revision_id: result.outcome === 'published' ? result.revisionId : current?.published_revision_id ?? null, updated_at: result.updatedAt, created_at: result.createdAt, decision: undefined };
            if (created) {
                notesReady = true;
                note = { body: '', version: null, updatedAt: null };
            }
            const u = new URL(location.href);
            u.searchParams.set('persona', result.id);
            u.searchParams.delete('new');
            u.searchParams.delete('revision');
            u.searchParams.delete('event');
            history.replaceState(history.state, '', u);
            href = location.href;
            publicStatus = result.outcome === 'published' ? l('对外资料已保存并生效。', 'Public profile saved and published.') : result.outcome === 'submitted' ? l('对外资料已保存并提交，等待网站审核。', 'Public profile saved and submitted for site review.') : l('草稿已保存；待审版本和已生效资料保持。', 'Draft saved; pending and published versions remain.');
            message.textContent = publicStatus;
            try {
                const refreshed = (await api('/me/personas')).personas;
                if (saveSequence !== sequence) return;
                personas = refreshed;
                const fresh = personas.find(p => p.id === result.id);
                // The form still represents the version this request saved. Do not
                // silently rebase its next write onto another window's changes.
                if (fresh?.head_revision_id === result.revisionId) current = fresh;
                else if (fresh) {
                    publicError = true;
                    publicStatus += ' ' + fail({ code: 'REVISION_CONFLICT' });
                    message.textContent = publicStatus;
                }
            }
            catch {
                publicStatus += ' ' + l('状态刷新失败，可返回列表重试。', 'Status refresh failed. Return to the list to retry.');
            }
        }
        catch (error: any) {
            publicStatus = fail(error);
            publicError = true;
            message.textContent = publicStatus;
            if (['REVISION_CONFLICT', 'SUBMISSION_CONFLICT'].includes(error.code))
                showPublicConflict();
        }
        finally {
            publicBusy = false;
            if (!content.inert && saveSequence === sequence) {
                form();
                if (publicError)
                    showPublicConflict();
            }
        }
    }
    function showPublicConflict() { if (!current || !publicError)
        return; const box = view.querySelector('#wp-public-state'); if (!box)
        return; const b = document.createElement('button'); b.type = 'button'; b.textContent = l('核对最新资料', 'Compare latest profile'); b.onclick = async () => { try {
        personas = (await api('/me/personas')).personas;
        const fresh = personas.find(p => p.id === current?.id);
        if (!fresh)
            return;
        const dialog = document.createElement('dialog');
        dialog.className = 'wp-compare';
        dialog.innerHTML = `<h2>${l('服务器最新资料', 'Latest server profile')}</h2><pre>${esc(JSON.stringify(fresh.draft ?? fresh.published, null, 2))}</pre><p>${l('采用最新版本作为保存基准会保留你当前输入。请核对后再保存。', 'Using this version as the save base keeps your input. Compare it before saving again.')}</p><button data-use>${l('已核对，保留我的输入', 'Compared; keep my input')}</button><button data-close>${l('关闭', 'Close')}</button>`;
        document.body.append(dialog);
        dialog.querySelector<HTMLButtonElement>('[data-close]')!.onclick = () => dialog.close();
        dialog.querySelector<HTMLButtonElement>('[data-use]')!.onclick = () => {
            current = fresh;
            // The retained input must now be compared with the server version
            // the user accepted, rather than this window's earlier saved input.
            savedProfiles = profileSnapshot(fresh.draft ?? fresh.published);
            lastPublic = undefined;
            publicStatus = dirtyPublic()
                ? l('已更新版本基准；当前输入尚未保存。', 'Save base updated; your input is still unsaved.')
                : l('已更新版本基准；当前输入与最新资料一致。', 'Save base updated; your input matches the latest profile.');
            publicError = false;
            dialog.close();
            form();
        };
        dialog.onclose = () => dialog.remove();
        dialog.showModal();
    }
    catch (error) {
        message.textContent = fail(error);
    } }; box.after(b); }
    async function saveNotes() {
        if (!current || !notesReady || notesBusy || Array.from(noteText).length > PERSONA_NOTES_LIMIT)
            return;
        const body = noteText, id = current.id, key = JSON.stringify({ body, baseVersion: note.version });
        if (lastNotes?.key !== key)
            lastNotes = { key, body: { body, baseVersion: note.version, requestId: crypto.randomUUID() } };
        notesBusy = true;
        navigationRequest++;
        notesError = false;
        notesForm();
        const saveSequence = sequence;
        try {
            const savedNote = await api('/me/personas/' + id + '/notes', lastNotes!.body, 'PUT');
            if (saveSequence !== sequence) return;
            note = savedNote;
            lastNotes = undefined;
            notesStatus = l('笔记已保存。对外资料状态不变。', 'Notes saved. Public profile status is unchanged.');
        }
        catch (error: any) {
            notesError = true;
            notesStatus = fail(error);
            if (error.code === 'NOTES_CONFLICT')
                notesStatus += ' ' + l('可核对服务器最新笔记后再次保存。', 'Compare the latest server notes before saving again.');
        }
        finally {
            notesBusy = false;
            if (!content.inert && saveSequence === sequence) {
                form();
                if (tab === 'notes' && notesError && notesReady)
                    noteConflict();
            }
        }
    }
    function noteConflict() { const box = view.querySelector('#wp-notes-conflict'); if (!box || !current)
        return; const b = document.createElement('button'); b.type = 'button'; b.textContent = l('核对最新笔记', 'Compare latest notes'); b.onclick = async () => { try {
        const compareSequence = sequence;
        const fresh = await api('/me/personas/' + current!.id + '/notes');
        if (compareSequence !== sequence) return;
        const dialog = document.createElement('dialog');
        dialog.className = 'wp-compare';
        dialog.innerHTML = `<h2>${l('最新笔记 · 仅自己可见', 'Latest notes · only you')}</h2><pre>${esc(fresh.body)}</pre><button data-use>${l('已核对，保留我的输入', 'Compared; keep my input')}</button><button data-close>${l('关闭', 'Close')}</button>`;
        document.body.append(dialog);
        dialog.querySelector<HTMLButtonElement>('[data-close]')!.onclick = () => dialog.close();
        dialog.querySelector<HTMLButtonElement>('[data-use]')!.onclick = () => { note = fresh; notesError = false; notesStatus = ''; lastNotes = undefined; dialog.close(); notesForm(); };
        dialog.onclose = () => dialog.remove();
        dialog.showModal();
    }
    catch (error) {
        notesStatus = fail(error);
        states();
    } }; box.append(b); }
    function renderHistorical() { const r = historical; const p = r.body?.[editLocale] ?? r.body?.en ?? r.body?.['zh-CN']; const u = new URL(location.href); u.searchParams.delete('revision'); u.searchParams.delete('event'); view.innerHTML = `<section class="wp-surface wp-history-view"><h2>${l('历史版本 · 只读', 'Previous version · read only')}</h2><p>${l('此入口指向固定历史版本，不会自动改为编辑新稿。', 'This link points to a fixed historical version. It will not silently edit the newer draft.')}</p>${p ? `<div class="wp-avatar">${avatar(p.avatar)}</div><h3>${esc(p.name)}</h3><p class="wp-full-text">${esc(p.bio)}</p><time>${esc(date(r.created_at))}</time>` : l('指定版本不可用。', 'This version is unavailable.')}<p><a href="${esc(u.pathname + u.search)}">${l('打开当前版本', 'Open current version')}</a></p></section>`; }
    async function route() {
        const seq = ++sequence;
        clearPrivate();
        profiles = emptyProfiles();
        savedProfiles = profileSnapshot(profiles);
        publicStatus = notesStatus = '';
        publicError = notesError = false;
        lastPublic = undefined;
        current = undefined;
        historyData = null;
        historical = null;
        tab = 'public';
        const q = new URL(location.href).searchParams;
        editing = q.has('persona') || q.get('new') === '1';
        if (!editing) {
            list();
            requestAnimationFrame(() => scrollTo(0, history.state?.listY ?? 0));
            return;
        }
        if (q.has('persona')) {
            current = personas.find(p => p.id === q.get('persona'));
            if (!current) {
                view.innerHTML = `<p class="wp-surface">${l('角色不可用或不属于当前账号。', 'This persona is unavailable or belongs to another account.')}</p>`;
                header();
                return;
            }
            profiles = { ...emptyProfiles(), ...clone(current.draft ?? current.published) };
            savedProfiles = profileSnapshot(profiles);
            if (q.has('revision') && q.get('revision') !== current.head_revision_id) {
                view.textContent = l('正在核对历史版本…', 'Checking the linked version…');
                const detail = await api('/admin/settings/' + current.setting_id);
                if (seq !== sequence)
                    return;
                historyData = detail;
                historical = detail.revisions.find((r: any) => r.id === q.get('revision')) ?? {};
            }
        }
        else
            notesReady = true;
        form();
        scrollTo(0, 0);
    }
    async function navigate(url: URL, replace = false) {
        if (!guard()) return;
        const request = ++navigationRequest, seq = sequence, from = location.href;
        const inputs = JSON.stringify([profiles, noteText]);
        const isCurrent = () => request === navigationRequest && seq === sequence && from === location.href;
        message.textContent = '';
        try {
            const refreshed = (await api('/me/personas')).personas;
            if (!isCurrent() || publicBusy || notesBusy) return;
            // The editor remains usable during the read. Confirm any new input
            // before changing the URL or clearing either independent buffer.
            if (inputs !== JSON.stringify([profiles, noteText]) && !guard()) return;
            history.replaceState({ ...history.state, ...!editing ? { listY: scrollY } : {} }, '', location.href);
            if (replace) history.replaceState({ ...history.state, personaIndex: index }, '', url);
            else {
                index++;
                history.pushState({ personaIndex: index, listY: editing ? (history.state?.returnY ?? 0) : 0, returnY: editing ? history.state?.returnY : scrollY }, '', url);
            }
            href = location.href;
            personas = refreshed;
            await route();
        }
        catch (error) {
            if (request === navigationRequest) message.textContent = fail(error);
        }
    }
    function switchLanguage(next: boolean) {
        zh = next;
        if (!publicError)
            publicStatus = '';
        if (!notesError)
            notesStatus = '';
        root.dataset.locale = shell.dataset.locale = zh ? 'zh-CN' : 'en';
        root.dataset.prefix = shell.dataset.prefix = prefix();
        document.documentElement.lang = zh ? 'zh-CN' : 'en';
        const translations: Record<string, [
            string,
            string
        ]> = { overview: ['概览', 'Overview'], personas: ['我的角色', 'My personas'], reviews: ['我的评价', 'My reviews'], replies: ['收到的评价', 'Received reviews'], works: ['我管理的内容', 'Content I manage'], worlds: ['我管理的世界', 'Worlds I manage'], settings: ['账号设置', 'Account settings'], moderation: ['评价与回复审核', 'Review moderation'], site: ['网站审核', 'Site moderation'] };
        for (const a of shell.querySelectorAll<HTMLAnchorElement>('a')) {
            const u = new URL(a.href);
            if (u.origin !== location.origin || !/^\/(zh|en)\//.test(u.pathname))
                continue;
            u.pathname = u.pathname.replace(/^\/(zh|en)\//, `/${prefix()}/`);
            a.href = u.pathname + u.search;
            const label = translations[u.searchParams.get('view') ?? 'overview'];
            if (a.closest('.ws-nav') && label) {
                const icon = a.querySelector('span');
                a.replaceChildren(...icon ? [icon] : [], document.createTextNode(zh ? label[0] : label[1]));
            }
        }
        const utility = shell.querySelector('.ws-utility strong');
        if (utility)
            utility.textContent = l('Plotstay · 私人工作台', 'Plotstay · Private workspace');
        const utilityCaption = shell.querySelector('.ws-utility>span');
        if (utilityCaption)
            utilityCaption.textContent = l('创作与管理', 'Create and manage');
        const groups = shell.querySelectorAll('.ws-nav-group');
        groups[0]!.textContent = l('我的内容', 'My content');
        groups[1]!.textContent = l('审核管理', 'Moderation');
        shell.querySelector('.ws-nav-label')!.textContent = l('我的工作台', 'My workspace');
        shell.querySelector('.ws-crumbs>a')!.textContent = l('我的工作台', 'My workspace');
        shell.querySelector('.ws-legacy')!.textContent = l('旧版 ↗', 'Previous ↗');
        shell.querySelector('.ws-menu')!.textContent = '☰ ' + l('导航', 'Menu');
        for (const a of shell.querySelectorAll<HTMLAnchorElement>('.ws-utility nav a')) {
            const chinese = a.lang.startsWith('zh');
            const u = new URL(location.href);
            u.pathname = `/${chinese ? 'zh' : 'en'}/workspace`;
            a.href = u.pathname + u.search;
            a.setAttribute('aria-current', chinese === zh ? 'page' : 'false');
        }
        const u = new URL(location.href);
        u.pathname = `/${prefix()}/workspace`;
        const ret = u.searchParams.get('returnTo');
        if (ret)
            u.searchParams.set('returnTo', ret.replace(/^\/(zh|en)\//, `/${prefix()}/`));
        history.replaceState(history.state, '', u);
        href = location.href;
        editing ? form() : list();
    }
    document.addEventListener('click', event => {
        const a = (event.target as HTMLElement).closest<HTMLAnchorElement>('a');
        if (!a || event.defaultPrevented || event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || a.target === '_blank')
            return;
        const u = new URL(a.href);
        if (a.closest('.ws-utility nav')) {
            event.preventDefault();
            switchLanguage(a.lang.startsWith('zh'));
            return;
        }
        if (u.origin === location.origin && /^\/(zh|en)\/workspace$/.test(u.pathname) && u.searchParams.get('view') === 'personas' && !u.searchParams.has('submission')) {
            event.preventDefault();
            void navigate(u);
            return;
        }
        if (u.href !== location.href && !a.hash && (!guard()))
            event.preventDefault();
        else if (u.href !== location.href && !a.hash) {
            savedProfiles = profileSnapshot(profiles);
            note.body = noteText;
        }
    }, true);
    window.addEventListener('beforeunload', e => { if (dirty() || publicBusy || notesBusy)
        e.preventDefault(); });
    window.addEventListener('workspace:leave', e => { if (!guard())
        e.preventDefault(); });
    window.addEventListener('pageshow', e => { if (e.persisted)
        void initialize(); });
    let checkingIdentity = false;
    async function refreshIdentity() {
        if (!actor || checkingIdentity || document.visibilityState === 'hidden') return;
        checkingIdentity = true;
        try {
            const session = await api('/auth/me');
            if (session.actor.id !== actor.id) {
                sequence++;
                clearPrivate();
                await initialize();
                window.dispatchEvent(new Event('workspace:authenticated'));
            }
        } catch (error: any) {
            if (error.code === 'SESSION_REQUIRED') message.textContent = fail(error);
        } finally { checkingIdentity = false; }
    }
    window.addEventListener('focus', () => { void refreshIdentity(); });
    document.addEventListener('visibilitychange', () => { void refreshIdentity(); });
    window.addEventListener('pagehide', () => { clearPrivate(); document.querySelectorAll('.wp-compare').forEach(el => el.remove()); });
    window.addEventListener('popstate', () => {
        if (popRestoring) {
            popRestoring = false;
            return;
        }
        const nextIndex = Number(history.state?.personaIndex ?? 0);
        if (!guard()) {
            popRestoring = true;
            history.go(index - nextIndex || 1);
            return;
        }
        index = nextIndex;
        href = location.href;
        const u = new URL(href);
        if (!/^\/(zh|en)\/workspace$/.test(u.pathname) || u.searchParams.get('view') !== 'personas') {
            location.reload();
            return;
        }
        void route().catch(error => message.textContent = fail(error));
    });
    async function initialize(resume = false) { try {
        const previousActor = actor?.id;
        const [session, data] = await Promise.all([api('/auth/me'), api('/me/personas')]);
        if (actor && actor.id !== session.actor.id) {
            clearPrivate();
            profiles = emptyProfiles();
            savedProfiles = profileSnapshot(profiles);
            const u = new URL(listUrl(), location.origin);
            history.replaceState({ personaIndex: index }, '', u);
        }
        actor = session.actor;
        personas = data.personas;
        login.hidden = true;
        content.hidden = false;
        content.inert = false;
        message.textContent = '';
        if (!notesReady) {
            notesError = false;
            notesStatus = '';
            notesLoading = false;
        }
        if (resume && previousActor === actor.id && editing) {
            form();
        }
        else
            await route();
    }
    catch (error) {
        message.textContent = fail(error);
        if (!content.inert) {
            view.innerHTML = `<button id="wp-retry">${l('重新载入', 'Try again')}</button>`;
            content.hidden = false;
            view.querySelector<HTMLButtonElement>('#wp-retry')!.onclick = () => void initialize();
        }
    } }
    login.onsubmit = event => { event.preventDefault(); void (async () => { try {
        const values = Object.fromEntries(new FormData(login));
        await api('/auth/login', values);
        (login.elements.namedItem('password') as HTMLInputElement).value = '';
        await initialize(true);
        window.dispatchEvent(new Event('workspace:authenticated'));
    }
    catch (error) {
        message.textContent = fail(error);
    } })(); };
    view.innerHTML = `<p class="wp-surface" role="status">${l('正在载入角色…', 'Loading personas…')}</p>`;
    content.hidden = false;
    await initialize();
}
