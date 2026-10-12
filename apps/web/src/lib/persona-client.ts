import { reviewRatingKeys } from '@plotstay/contracts';
export async function initAccount() {
  const root = document.querySelector<HTMLElement>('#persona-workspace');
  if (!root) return;
  const zh = root.dataset.locale === 'zh-CN',
    l = (a: string, b: string) => (zh ? a : b),
    prefix = root.dataset.prefix!;
  const view = document.querySelector<HTMLElement>('#account-view')!,
    message = document.querySelector<HTMLElement>('#persona-message')!,
    login = document.querySelector<HTMLFormElement>('#account-login')!,
    content = document.querySelector<HTMLElement>('#account-content')!;
  let actor: any,
    loaded = false,
    dirty = false;
  const labels: Record<string, string> = {
    submit: l('待审核', 'Pending review'),
    publish: l('已发布', 'Published'),
    reject: l('退回修改', 'Changes requested'),
    hide: l('已隐藏', 'Hidden'),
    restore: l('已恢复', 'Restored'),
    draft: l('草稿', 'Draft'),
    submitted: l('待审核', 'Pending review'),
    approved: l('已通过', 'Approved'),
    rejected: l('退回修改', 'Changes requested'),
  };
  const errors: Record<string, string> = {
    INVALID_CREDENTIALS:l('邮箱或密码不正确。','Email or password is incorrect.'),
    PROVIDER_FORBIDDEN:l('只有条目绑定的提供者角色所属账号可以回复。','Only the assigned provider persona owner can reply.'),
    PROVIDER_CHANGED:l('提供者绑定已变更，请以当前提供者身份重新保存回复。','The assigned provider changed. Save a reply under the current identity.'),
    ALREADY_EXISTS:l('该邮箱或标识已存在。','This email or identifier already exists.'),
    SESSION_REQUIRED: l(
      '请重新登录；输入仍保留在当前页面。',
      'Sign in again. Your input is still on this page.',
    ),
    REVISION_CONFLICT: l(
      '已有新版本，输入已保留。请复制需要的修改后重新打开编辑器。',
      'A newer version exists. Your input is preserved; copy your changes before reopening.',
    ),
    PERSONA_APPROVAL_REQUIRED: l(
      '等待网站管理员批准本次角色资料版本。',
      'Waiting for site approval of this profile version.',
    ),
    TRANSLATIONS_REQUIRED: l(
      '发布前请补齐中文和英文。草稿已保留。',
      'Complete Chinese and English before publication. Drafts are preserved.',
    ),
    PERSONA_REJECTED: l(
      '角色资料已退回，请修改角色并再次保存评价后送审。',
      'Edit the returned persona, then save and submit the review again.',
    ),
    PROFILE_SIGNATURE_STALE:l('角色资料已被新版申请替代；请重新保存评价或回复，核对新署名后再送审。','The profile request was replaced. Save this review or reply with a fresh signature before submitting.'),
    SUBMISSION_SUPERSEDED:l('这份角色申请已被替代，请重新打开当前申请。','This profile request was replaced. Reopen the current submission.'),
    TARGET_UNAVAILABLE: l(
      '条目暂不可投稿。已保存的草稿仍保留。',
      'This entry is unavailable. Saved drafts are preserved.',
    ),
    PERSONA_DISABLED: l('角色已停用，不能新增发言。', 'This persona is disabled.'),
    PERSONA_FORBIDDEN: l('只能使用属于自己的角色。', 'Choose your own persona.'),
    WORLD_FORBIDDEN: l('没有这个世界的管理权限。', 'You cannot manage this world.'),
    REVIEW_FORBIDDEN: l('没有此评价的操作权限。', 'You do not have access to this review.'),
    NOT_SUBMITTED: l('请先提交保存的版本审核。', 'Submit the saved version first.'),
    INVALID_INPUT: l(
      '请检查必填内容、评分和中英资料。输入已保留。',
      'Check required fields, ratings and profile languages. Your input is preserved.',
    ),
    SITE_ADMIN_REQUIRED: l('此操作需要网站管理员。', 'A site administrator is required.'),
    PROFILE_REQUIRED: l('请先保存角色及评价。', 'Save the persona and review first.'),
  };
  async function api(path: string, body?: unknown, method = 'POST') {
    const init:RequestInit = {
      ...(body === undefined
        ? {}
        : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    };
    const r = await (window.__plotstayWorkspace?.request(path, 'account', init) ?? fetch('/api' + path, init));
    const data = await r.json();
    if (!r.ok) {
      if (data.error?.code === 'SESSION_REQUIRED') {
        login.hidden = false;
        content.inert = true;
      }
      throw new Error(
        errors[data.error?.code] ??
          (zh ? '操作未完成，请重试。代码：' + data.error?.code : (data.error?.message ?? 'Request failed')),
      );
    }
    return data;
  }
  const node = (tag: string, text = '', className = '') => {
    const n = document.createElement(tag);
    n.textContent = text;
    n.className = className;
    return n;
  };
  const run = async (fn: () => Promise<unknown>) => {
    const loading=root.closest('#new-workspace')?l('正在载入…','Loading…'):'';
    message.textContent = loading;
    try {
      await fn();
      if(message.textContent===loading)message.textContent='';
    } catch (e) {
      message.textContent = (e as Error).message;
    }
  };
  const button = (text: string, fn: () => Promise<unknown>) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.onclick = () => {
      b.disabled = true;
      void run(fn).finally(() => (b.disabled = false));
    };
    return b;
  };
  const link = (text: string, href: string) => {
    const a = document.createElement('a');
    a.textContent = text;
    a.href = href;
    return a;
  };
  const field = (parent: HTMLElement, title: string, name: string, value = '', type = 'text') => {
    const label = node('label', title),
      input = type === 'textarea' ? document.createElement('textarea') : document.createElement('input');
    input.name = name;
    input.value = value;
    if (input instanceof HTMLInputElement) input.type = type;
    label.append(input);
    parent.append(label);
    return input;
  };
  const select = (
    parent: HTMLElement,
    title: string,
    name: string,
    options: [string, string][],
    value = '',
  ) => {
    const label = node('label', title),
      s = document.createElement('select');
    s.name = name;
    for (const [v, t] of options) {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = t;
      s.append(o);
    }
    s.value = value;
    label.append(s);
    parent.append(label);
    return s;
  };
  const mark = (form: HTMLElement) =>
    form.addEventListener('input', () => {
      dirty = true;
    });
  const requireSaved = () => {
    if (dirty)
      throw new Error(
        l('请先保存当前输入，再预览或提交。', 'Save your input before previewing or submitting.'),
      );
  };
  const targetLink = (c: any) =>
    `/${prefix}/worlds/${c.world_slug}/${({ stay: 'stays', experience: 'experiences', service: 'services' } as any)[c.target_kind]}/${c.target_slug}#notes`;
  function preview(parent: HTMLElement, r: any) {
    const box = node('article', '', 'persona-preview');
    box.append(
      node(
        'strong',
        l(
          '本次保存的署名与正文（仅本人及审核人员可见）',
          'Saved signature and text (private to author and moderators)',
        ),
      ),
    );
    for (const [locale, text] of Object.entries(r.texts ?? r.body ?? {})) {
      const t = text as any,
        p = r.profiles?.[locale] ?? (Object.values(r.profiles ?? {})[0] as any);
      box.append(node('h3', `${locale} · ${p?.name ?? ''}`));
      if (p?.avatarImage) {
        const img = document.createElement('img');
        img.src = p.avatarImage;
        img.alt = '';
        img.className = 'persona-avatar';
        box.append(img);
      }
      box.append(
        node('p', p?.bio ?? ''),
        node('h4', t.title ?? ''),
        node('p', typeof t === 'string' ? t : t.description),
      );
    }
    parent.append(box);
  }
  async function personas() {
    view.replaceChildren(node('h2', l('我的角色', 'My personas')));
    const data = await api('/me/personas');
    view.append(button(l('创建角色', 'Create persona'), async () => editPersona()));
    for (const p of data.personas) {
      const body = p.draft ?? p.published,
        n = body[root!.dataset.locale!] ?? (Object.values(body)[0] as any);
      const row = node('article', '', 'panel');
      row.append(
        node('h3', n?.name ?? l('未命名角色', 'Unnamed persona')),
        node('p', p.disabled ? l('已停用','Disabled') : p.submitted_revision_id ? (p.head_revision_id===p.submitted_revision_id ? l('资料待审核','Profile pending review') : l('资料待审核 · 有未提交修改','Pending review · unsent changes')) : p.decision==='rejected' ? l('资料已退回','Profile returned') : p.published_revision_id===p.head_revision_id ? l('资料已批准','Profile approved') : l('草稿未提交','Draft not submitted')),
        node('p', p.submitted_note ?? p.note ?? ''),
        button(l('编辑角色', 'Edit persona'), async () => editPersona(p)),
      );
      if(!p.disabled && p.head_revision_id!==p.submitted_revision_id && p.published_revision_id!==p.head_revision_id)row.append(button(l('提交当前资料审核','Submit current profile'),async()=>{await api('/me/personas/'+p.id+'/submit',{revisionId:p.head_revision_id});await personas();message.textContent=l('当前资料已提交网站审核。','Current profile was submitted for site review.');}));
      if(p.submitted && p.submitted_revision_id!==p.head_revision_id){const submitted=p.submitted[root!.dataset.locale!]??Object.values(p.submitted)[0] as any;row.append(node('p',l('当前送审：','Submitted: ')+(submitted?.name??'')));}
      view.append(row);
    }
  }
  function editPersona(p?: any) {
    dirty = false;
    view.replaceChildren(node('h2', p ? l('编辑角色', 'Edit persona') : l('创建角色', 'Create persona')));
    const form = document.createElement('form');
    const fields: Record<string, any> = {};
    for (const locale of ['zh-CN', 'en']) {
      const body = (p?.draft ?? p?.published ?? {})[locale] ?? {},
        group = document.createElement('fieldset');
      group.append(node('legend', locale === 'en' ? 'English' : '中文'));
      fields[locale] = {
        name: field(group, l('名字', 'Name'), locale + '.name', body.name ?? ''),
        bio: field(group, l('设定／简介', 'Bio'), locale + '.bio', body.bio ?? '', 'textarea'),
        avatar: select(
          group,
          l('头像', 'Avatar'),
          locale + '.avatar',
          [
            ['mint', l('薄荷绿', 'Mint')],
            ['amber', l('琥珀', 'Amber')],
            ['violet', l('紫罗兰', 'Violet')],
            ['sky', l('天空蓝', 'Sky')],
          ],
          body.avatar ?? 'mint',
        ),
      };
      form.append(group);
    }
    mark(form);
    form.append(
      button(l('保存角色', 'Save persona'), async () => {
        const profiles: any = {};
        for (const [locale, f] of Object.entries(fields))
          if (f.name.value.trim())
            profiles[locale] = { name: f.name.value, bio: f.bio.value, avatar: f.avatar.value };
        const saved = await api(
          '/me/personas' + (p ? '/' + p.id : ''),
          { profiles, ...(p ? { baseRevisionId: p.head_revision_id } : {}) },
          p ? 'PUT' : 'POST',
        );
        dirty = false;
        message.textContent = l('角色草稿已保存。需要公开资料时请单独提交审核；评价送审也会提交其署名版本。','Persona draft saved. Submit it for profile review, or submit a review with its saved signature.');
        await personas();
        return saved;
      }),
    );
    form.onsubmit = (e) => e.preventDefault();
    view.append(form);
  }
  async function reviews(page = 1) {
    dirty = false;
    view.replaceChildren(node('h2', l('我的评价', 'My reviews')));
    const data = await api('/me/reviews?page=' + page);
    if (!data.items.length)
      view.append(
        node(
          'p',
          l(
            '从住宿、活动或服务详情的「以角色写评价」开始。',
            'Start with “Write in character” on any stay, experience or service.',
          ),
        ),
      );
    for (const r of data.items) {
      const row = node('article', '', 'panel');
      row.append(
        node('h3', r.title),
        node(
          'p',
          (r.profiles?.[root!.dataset.locale!] ?? (Object.values(r.profiles ?? {})[0] as any))?.name ??
            r.legacy_name ??
            l('旧手记', 'Legacy note'),
        ),
        link(r.target_slug, targetLink(r)),
        node(
          'p',
          (r.status==='approved' && r.published_publication_id ? l('已发布','Published') : (labels[r.status] ?? r.status) + (r.published_publication_id ? l(' · 当前公开版本保持可见',' · The current publication remains visible') : l(' · 未公开',' · Not public'))),
        ),
        r.persona_id
          ? button(l('编辑／查看评价', 'Edit / view review'), async () => editReview(r.id))
          : link(l('在后台编辑旧手记', 'Edit legacy note in management'), `/${prefix}/admin`),
      );
      view.append(row);
    }
    const nav = node('nav', '', 'account-actions');
    if (page > 1) nav.append(button(l('上一页', 'Previous'), () => reviews(page - 1)));
    nav.append(node('span', `${page} / ${data.pages}`));
    if (page < data.pages) nav.append(button(l('下一页', 'Next'), () => reviews(page + 1)));
    view.append(nav);
  }
  async function start(parentId: string) {
    view.replaceChildren(node('h2', l('以谁的身份发表', 'Choose your persona')));
    const target = await api('/contents/' + parentId + '?locale=' + root!.dataset.locale);
    view.append(node('h3', target.content.text.title));
    const { personas: all } = await api('/me/personas');
    const usable = all.filter((p: any) => !p.disabled);
    if (!usable.length) {
      view.append(
        link(
          l('先创建角色，再返回此条目', 'Create a persona, then return to this entry'),
          `/${prefix}/account?view=personas`,
        ),
      );
      return;
    }
    const choice = select(
      view,
      l('角色', 'Persona'),
      'personaId',
      usable.map((p: any) => [
        p.id,
        (p.draft ?? p.published)[root!.dataset.locale!]?.name ??
          (Object.values(p.draft ?? p.published)[0] as any)?.name,
      ]),
      usable[0].id,
    );
    const bio = node('p');
    const avatar = document.createElement('img');
    avatar.alt = '';
    avatar.className = 'persona-avatar';
    const show = () => {
      const p = usable.find((p: any) => p.id === choice.value),
        b = p.draft ?? p.published;
      bio.textContent = (b[root!.dataset.locale!] ?? Object.values(b)[0]).bio;
      avatar.src = (
        p.preview_profiles[root!.dataset.locale!] ?? (Object.values(p.preview_profiles)[0] as any)
      ).avatarImage;
    };
    choice.onchange = show;
    show();
    view.append(
      avatar,
      bio,
      button(l('开始／继续评价', 'Start / continue review'), async () => {
        const r = await api('/me/reviews', { parentId, personaId: choice.value });
        history.replaceState(null, '', `/${prefix}/account?review=${r.id}`);
        await editReview(r.id);
      }),
    );
  }
  async function editReview(id: string) {
    const data = await api('/me/reviews/' + id),
      r = data.revisions[0];
    dirty = false;
    view.replaceChildren(
      node('h2', l('编辑评价', 'Edit review')),
      link(data.content.target_slug, targetLink(data.content)),
    );
    view.append(
      node(
        'p',
        (labels[r.status] ?? r.status) +
          ' · ' +
          l('角色资料：', 'Profile: ') +
          (labels[r.persona_decision] ?? l('待审核', 'Pending')),
      ),
      node('p', r.persona_note ?? ''),
    );
    for (const e of data.events.filter((e: any) => e.note)) view.append(node('p', `${e.action}: ${e.note}`));
    const form = document.createElement('form');
    form.onsubmit = (e) => e.preventDefault();
    const source = select(
      form,
      l('源语言', 'Source language'),
      'sourceLocale',
      [
        ['zh-CN', '中文'],
        ['en', 'English'],
      ],
      r.source_locale,
    );
    const fields: Record<string, any> = {};
    for (const locale of ['zh-CN', 'en']) {
      const text = r.texts[locale] ?? {},
        group = document.createElement('fieldset');
      group.append(node('legend', locale === 'en' ? 'English' : '中文'));
      fields[locale] = {
        title: field(group, l('标题', 'Title'), locale + '.title', text.title ?? ''),
        description: field(
          group,
          l('正文', 'Review'),
          locale + '.description',
          text.description ?? '',
          'textarea',
        ),
        origin: field(group, l('来自', 'From'), locale + '.origin', text.review?.origin ?? ''),
        stayDuration: field(
          group,
          l('旅程说明', 'Journey note'),
          locale + '.stayDuration',
          text.review?.stayDuration ?? '',
        ),
        tags: field(
          group,
          l('关键词（每行一个）', 'Topics (one per line)'),
          locale + '.tags',
          (text.tags ?? []).join('\n'),
          'textarea',
        ),
      };
      form.append(group);
    }
    const rating = select(
      form,
      l('本篇评价评分', 'This review’s rating'),
      'rating',
      [
        ['', l('不评分', 'No rating')],
        ...([1, 2, 3, 4, 5].map((n) => [String(n), '★'.repeat(n)]) as [string, string][]),
      ],
      String(r.attributes.rating ?? ''),
    );
    form.append(node('p',l('本篇及分项评分仅在评价发布后计入条目自动汇总；草稿和待审内容不会改变公开均分。','This review and its dimension ratings affect the entry’s calculated score only after publication. Drafts and pending reviews do not change public averages.')));
    const dimensions: Record<string, HTMLSelectElement> = {};
    const dimensionLabels: any = {
      cleanliness: l('清洁度', 'Cleanliness'),
      accuracy: l('描述准确度', 'Accuracy'),
      checkIn: l('入住体验', 'Check-in'),
      communication: l('沟通', 'Communication'),
      location: l('位置', 'Location'),
      value: l('性价比', 'Value'),
    };
    for (const key of data.content.target_kind === 'stay'
      ? reviewRatingKeys
      : ['accuracy', 'communication', 'value'])
      dimensions[key] = select(
        form,
        dimensionLabels[key],
        key,
        [
          ['', l('不评分', 'No rating')],
          ...([1, 2, 3, 4, 5].map((n) => [String(n), String(n)]) as [string, string][]),
        ],
        String(r.attributes.reviewRatings?.[key] ?? ''),
      );
    mark(form);
    form.append(
      button(l('保存评价草稿', 'Save review draft'), async () => {
        const texts: any = {};
        for (const [locale, f] of Object.entries(fields))
          if (f.title.value.trim() || f.description.value.trim())
            texts[locale] = {
              title: f.title.value,
              description: f.description.value,
              origin: f.origin.value,
              stayDuration: f.stayDuration.value,
              tags: f.tags.value
                .split('\n')
                .map((s: string) => s.trim())
                .filter(Boolean),
            };
        await api(
          '/me/reviews/' + id,
          {
            baseRevisionId: r.id,
            body: {
              sourceLocale: source.value,
              texts,
              rating: rating.value ? Number(rating.value) : null,
              reviewRatings: Object.fromEntries(
                Object.entries(dimensions)
                  .filter(([, v]) => v.value)
                  .map(([k, v]) => [k, Number(v.value)]),
              ),
            },
          },
          'PUT',
        );
        await editReview(id);
        message.textContent = l('草稿已保存。', 'Draft saved.');
      }),
      button(l('预览已保存版本', 'Preview saved version'), async () => {
        requireSaved();
        document.querySelector('.persona-preview')?.remove();
        preview(view, (await api('/me/reviews/' + id)).revisions[0]);
      }),
      button(l('角色与评价一同送审', 'Submit profile and review'), async () => {
        requireSaved();
        await api('/me/reviews/' + id + '/submit', { revisionId: r.id });
        await editReview(id);
        message.textContent = l(
          '已送审，旧公开版本在审核期间保持不变。',
          'Submitted. Any existing publication stays live during review.',
        );
      }),
    );
    view.append(form);
  }
  async function moderation(page = 1) {
    view.replaceChildren(node('h2', l('评价与回复审核', 'Review moderation')));
    const data = await api('/moderation/reviews?page=' + page);
    if(actor.siteRole==='admin'){
      const profiles=await api('/moderation/personas?page='+page);
      const section=node('section','','panel');section.append(node('h3',l('角色资料待审','Profiles awaiting review')));
      if(!profiles.items.length)section.append(node('p',l('当前没有待审角色资料。','No profiles are awaiting review.')));
      for(const profile of profiles.items){const card=node('article','','panel');const body=profile.body?.[root!.dataset.locale!]??Object.values(profile.body??{})[0] as any;card.append(node('h4',body?.name??profile.email),node('p',profile.email+' · '+new Date(profile.submitted_at).toLocaleString()),node('p',(profile.body?.['zh-CN']?.bio??'')+' / '+(profile.body?.en?.bio??'')));
        const note=field(card,l('审核说明','Review note'),'profileNote','','textarea');
        for(const [decision,label] of [['approved',l('批准资料','Approve profile')],['rejected',l('退回资料','Return profile')]] as const)card.append(button(label,async()=>{await api('/moderation/personas/'+profile.revision_id,{decision,note:note.value});await moderation(page);}));section.append(card);}
      view.append(section);
    }
    for (const row of data.items) {
      const card = node('article', '', 'panel');
      card.append(
        node('h3', row.title),
        node('p', `${row.world_slug} / ${row.target_slug} · ${labels[row.status] ?? row.status}`),
        node(
          'p',
          row.reply_status ? l('回复：', 'Reply: ') + (labels[row.reply_status] ?? row.reply_status) : '',
        ),
        button(l('检查评价与角色', 'Inspect review and persona'), async () => moderate(row.id)),
      );
      view.append(card);
    }
    const nav = node('nav', '', 'account-actions');
    if (page > 1) nav.append(button(l('上一页', 'Previous'), () => moderation(page - 1)));
    nav.append(node('span', String(page)));
    if (data.hasNext) nav.append(button(l('下一页', 'Next'), () => moderation(page + 1)));
    view.append(nav);
    await bindings();
    if (actor.siteRole === 'admin') {
      const form = node('section', '', 'panel');
      form.append(node('h3', l('创建普通账号', 'Create ordinary account')));
      const email = field(form, l('邮箱', 'Email'), 'newEmail', '', 'email'),
        password = field(
          form,
          l('初始密码（至少 12 位）', 'Initial password (12+ characters)'),
          'newPassword',
          '',
          'password',
        );
      form.append(
        button(l('创建账号', 'Create account'), async () => {
          await api('/admin/accounts', { email: email.value, password: password.value });
          password.value = '';
          message.textContent = l(
            '普通账号已创建，不授予世界管理权限。',
            'Ordinary account created without world permissions.',
          );
        }),
      );
      view.append(form);
    }
  }
  async function moderate(id: string) {
    const data = await api('/moderation/reviews/' + id),
      r = data.revisions[0];
    view.replaceChildren(
      node('h2', l('审核固定版本', 'Review fixed versions')),
      link(data.content.target_slug, targetLink(data.content)),
      node('p', l('实际作者账号 ID：', 'Author account ID: ') + data.content.author_id),
      node('p', l('评价版本：', 'Review version: ') + r.id),
      node(
        'p',
        l('角色资料版本：', 'Profile version: ') + (r.persona_revision_id ?? l('旧手记', 'Legacy note')),
      ),
    );
    preview(view, r);
    const note = field(view, l('审核说明', 'Moderation note'), 'moderationNote', '', 'textarea');
    if (actor.siteRole === 'admin' && r.persona_revision_id)
      view.append(
        button(l('仅批准角色资料', 'Approve profile only'), async () => {
          await api('/moderation/personas/' + r.persona_revision_id, {
            decision: 'approved',
            note: note.value,
          });
          await moderate(id);
        }),
        button(l('退回角色资料', 'Return profile'), async () => {
          await api('/moderation/personas/' + r.persona_revision_id, {
            decision: 'rejected',
            note: note.value,
          });
          await moderate(id);
        }),
        button(l('停用角色', 'Disable persona'), async () => {
          await api('/moderation/personas/' + data.content.persona_id + '/availability', { disabled: true });
          message.textContent = l('已停用；旧评价不自动隐藏。', 'Disabled. Existing reviews remain visible.');
        }),
        button(l('重新启用角色', 'Enable persona'), async () => {
          await api('/moderation/personas/' + data.content.persona_id + '/availability', { disabled: false });
        }),
      );
    view.append(
      button(l('审核通过并发布', 'Approve and publish'), async () => {
        await api('/admin/contents/' + id + '/review', {
          revisionId: r.id,
          draftToken: data.content.draft_token,
          decision: 'publish',
          note: note.value,
        });
        await moderate(id);
        message.textContent = l('已发布，条目评分已更新。', 'Published. Entry ratings are updated.');
      }),
      button(l('退回评价', 'Return review'), async () => {
        await api('/admin/contents/' + id + '/review', {
          revisionId: r.id,
          draftToken: data.content.draft_token,
          decision: 'reject',
          note: note.value,
        });
        await moderate(id);
      }),
      button(l('隐藏公开评价', 'Hide published review'), async () => {
        await api('/admin/contents/' + id + '/unpublish', { siteBlock: false, note: note.value });
        await moderate(id);
      }),
    );
    for (const p of data.publications)
      view.append(
        button(l('恢复发布：', 'Restore publication: ') + p.published_at, async () => {
          await api('/admin/contents/' + id + '/restore', { publicationId: p.id });
          await moderate(id);
        }),
      );
    view.append(
      button(l('审核提供者回复', 'Moderate provider reply'), async () => moderateReply(id)),
      button(l('返回审核列表', 'Back to moderation'), () => moderation()),
    );
  }
  async function bindings() {
    const panel = node('section', '', 'panel');
    panel.append(
      node('h3', l('条目提供者绑定', 'Assign entry provider')),
      node(
        'p',
        l(
          '显式绑定后，角色资料用于当前提供者展示；只有该角色的账号可以回复。旧凭条与旧回复署名保持不变。',
          'Explicit assignment uses the persona profile for the current provider. Only its owner can reply. Historical receipts and reply signatures stay unchanged.',
        ),
      ),
    );
    const all = (await api('/admin/worlds')).worlds;
    const worlds = all.filter((w: any) => actor.siteRole === 'admin' || ['owner', 'admin'].includes(w.role));
    const world = select(
      panel,
      l('世界', 'World'),
      'bindingWorld',
      worlds.map((w: any) => [w.id, w.slug]),
      worlds[0]?.id ?? '',
    );
    const fields = node('div');
    let loadVersion=0;
    const load = async () => {
      const version=++loadVersion,worldId=world.value;
      fields.replaceChildren();
      if (!world.value) return;
      const options = await api('/moderation/providers/' + worldId);
      if(version!==loadVersion || world.value!==worldId)return;
      const entry = select(
        fields,
        l('条目', 'Entry'),
        'bindingEntry',
        options.entries.map((e: any) => [e.id, e.kind + ' · ' + e.slug]),
        options.entries[0]?.id ?? '',
      );
      const persona = select(
        fields,
        l('已批准的提供者角色', 'Approved provider persona'),
        'bindingPersona',
        options.personas.map((p: any) => [p.id, (p.profiles[root!.dataset.locale!] ?? p.profiles.en).name]),
        options.personas[0]?.id ?? '',
      );
      const status = node('p');
      const show = () => {
        const bound = options.entries.find((e: any) => e.id === entry.value)?.persona_id;
        status.textContent = bound
          ? l('当前绑定：', 'Currently assigned: ') +
            (options.personas.find((p: any) => p.id === bound)?.profiles.en?.name ?? bound)
          : l(
              '尚未绑定角色，保留旧人物信息。',
              'No persona assigned; legacy provider information is retained.',
            );
      };
      entry.onchange = show;
      show();
      fields.append(
        status,
        button(l('确认绑定提供者', 'Assign provider'), async () => {
          await api('/moderation/providers/' + entry.value, { personaId: persona.value }, 'PUT');
          message.textContent = l(
            '提供者已绑定。角色所属账号可回复该条目的评价。',
            'Provider assigned. The persona owner can now reply.',
          );
          await load();
        }),
      );
    };
    world.onchange = () => void run(load);
    panel.append(fields);
    view.append(panel);
    await load();
  }
  async function replies(page = 1) {
    view.replaceChildren(node('h2', l('提供者回复', 'Provider replies')));
    const data = await api('/me/provider-reviews?page=' + page);
    if (!data.items.length)
      view.append(
        node(
          'p',
          l(
            '条目管理员绑定你的角色后，此处会出现可回复的已公开评价。',
            'After an administrator assigns your persona to an entry, its published reviews appear here.',
          ),
        ),
      );
    for (const r of data.items) {
      const card = node('article', '', 'panel');
      card.append(
        node('h3', r.title),
        node('p', r.name),
        link(r.target_slug, targetLink(r)),
        button(l('编辑回复', 'Edit reply'), async () => editReply(r.id)),
      );
      view.append(card);
    }
    if (page > 1) view.append(button(l('上一页', 'Previous'), () => replies(page - 1)));
    if (data.hasNext) view.append(button(l('下一页', 'Next'), () => replies(page + 1)));
  }
  async function editReply(id: string) {
    const data = await api('/me/replies/' + id),
      r = data.revisions[0];
    dirty = false;
    view.replaceChildren(
      node('h2', l('提供者回复', 'Provider reply')),
      link(data.target.target_slug, targetLink(data.target)),
    );
    const p = data.target.profiles[root!.dataset.locale!] ?? (Object.values(data.target.profiles)[0] as any);
    view.append(
      node('h3', l('固定提供者身份：', 'Assigned provider: ') + p?.name),
      node('p', data.reply?.hidden ? l('已隐藏','Hidden') : r ? (labels[r.status] ?? r.status) : l('新回复', 'New reply')),
    );
    for (const e of data.events.filter((e: any) => e.note)) view.append(node('p', e.note));
    const form = document.createElement('form');
    form.onsubmit = (e) => e.preventDefault();
    const source = select(
      form,
      l('源语言', 'Source language'),
      'replySource',
      [
        ['en', 'English'],
        ['zh-CN', '中文'],
      ],
      r?.source_locale ?? 'en',
    );
    const fields: any = {};
    for (const locale of ['zh-CN', 'en'])
      fields[locale] = field(
        form,
        locale === 'en' ? 'English' : '中文',
        'reply.' + locale,
        r?.body[locale] ?? '',
        'textarea',
      );
    mark(form);
    form.append(
      button(l('保存回复草稿', 'Save reply draft'), async () => {
        await api(
          '/me/replies/' + id,
          {
            baseRevisionId: r?.id ?? null,
            body: {
              sourceLocale: source.value,
              texts: Object.fromEntries(
                Object.entries(fields)
                  .filter(([, v]) => (v as any).value.trim())
                  .map(([k, v]) => [k, (v as any).value]),
              ),
            },
          },
          'PUT',
        );
        await editReply(id);
        message.textContent = l('回复草稿已保存。', 'Reply draft saved.');
      }),
      button(l('预览已保存回复', 'Preview saved reply'), async () => {
        requireSaved();
        const current = (await api('/me/replies/' + id)).revisions[0];
        if (!current) throw new Error(l('请先保存回复。', 'Save the reply first.'));
        document.querySelector('.persona-preview')?.remove();
        preview(view, current);
      }),
      button(l('提交回复审核', 'Submit reply'), async () => {
        requireSaved();
        if (!r) throw new Error(l('请先保存回复。', 'Save the reply first.'));
        await api('/me/replies/' + id + '/submit', { revisionId: r.id });
        await editReply(id);
        message.textContent = l('回复已送审。', 'Reply submitted.');
      }),
    );
    view.append(form);
  }
  async function moderateReply(id: string) {
    const data = await api('/moderation/replies/' + id),
      r = data.revisions[0];
    view.replaceChildren(node('h2', l('审核提供者回复', 'Moderate provider reply')));
    if (!r) {
      view.append(
        node('p', l('尚无回复草稿。', 'No reply draft yet.')),
        button(l('返回评价', 'Back to review'), () => moderate(id)),
      );
      return;
    }
    preview(view, r);
    view.append(
      node('p', l('作者账号 ID：', 'Author account ID: ') + r.created_by),
      node('p', labels[r.status] ?? r.status),
    );
    const note = field(view, l('审核说明', 'Moderation note'), 'replyNote', '', 'textarea');
    if (actor.siteRole === 'admin')
      view.append(
        button(l('仅批准角色资料', 'Approve profile only'), async () => {
          await api('/moderation/personas/' + r.persona_revision_id, {
            decision: 'approved',
            note: note.value,
          });
          await moderateReply(id);
        }),
        button(l('退回角色资料', 'Return profile'), async () => {
          await api('/moderation/personas/' + r.persona_revision_id, {
            decision: 'rejected',
            note: note.value,
          });
          await moderateReply(id);
        }),
      );
    for (const [action, zhLabel, en] of [
      ['publish', '发布回复', 'Publish reply'],
      ['reject', '退回回复', 'Return reply'],
      ['hide', '隐藏回复', 'Hide reply'],
    ])
      view.append(
        button(l(zhLabel!, en!), async () => {
          await api('/moderation/replies/' + id, { action, revisionId: r.id, note: note.value });
          await moderateReply(id);
          message.textContent = l('回复操作完成。', 'Reply action completed.');
        }),
      );
    for (const p of data.publications)
      view.append(
        button(l('恢复回复：', 'Restore reply: ') + p.published_at, async () => {
          await api('/moderation/replies/' + id, {
            action: 'restore',
            revisionId: r.id,
            publicationId: p.id,
          });
          await moderateReply(id);
        }),
      );
    view.append(button(l('返回评价', 'Back to review'), () => moderate(id)));
  }
  async function initialize() {
    const [session,worlds]=await Promise.all([api('/auth/me'),api('/admin/worlds')]);
    const nextActor=session.actor;
    if (actor && actor.id !== nextActor.id) {
      dirty = false;
      loaded = false;
      view.replaceChildren();
      history.replaceState(null, '', `/${prefix}/account?view=personas`);
    }
    actor = nextActor;
    document.querySelector<HTMLElement>('[data-review-admin]')!.hidden = !worlds.worlds.some(
      (w: any) =>
        actor.siteRole === 'admin' || ['owner', 'admin'].includes(w.role) || w.owner_id === actor.id,
    );
    login.hidden = true;
    content.hidden = false;
    content.inert = false;
    if (loaded) return;
    loaded = true;
    const q = new URLSearchParams(location.search);
    if (q.has('review')) await editReview(q.get('review')!);
    else if (q.has('target')) await start(q.get('target')!);
    else if (q.has('reply')) await editReply(q.get('reply')!);
    else if (q.get('view') === 'replies') await replies();
    else if (q.get('view') === 'reviews') await reviews();
    else if (q.get('view') === 'moderation' || q.get('view') === 'site') await moderation();
    else await personas();
  }
  login.onsubmit = (e) => {
    e.preventDefault();
    void run(async () => {
      const f = new FormData(login);
      await api('/auth/login', { email: f.get('email'), password: f.get('password') });
      (login.elements.namedItem('password') as HTMLInputElement).value = '';
      await initialize();
      message.textContent = l('登录成功。', 'Signed in.');
      if(root.closest('#new-workspace'))window.dispatchEvent(new Event('workspace:authenticated'));
    });
  };
  window.addEventListener('beforeunload', (e) => {
    if (dirty) {
      e.preventDefault();
    }
  });
  await run(initialize);
}
