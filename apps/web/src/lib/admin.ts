import { textSchema, type ContentText, type ContentAttributes, type Locale } from '@plotstay/contracts';

const root = document.querySelector<HTMLElement>('#admin')!;
const locale = root.dataset.locale ?? 'en';
const l = (zh: string, en: string) => locale === 'zh-CN' ? zh : en;
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const editor = el<HTMLFormElement>('editor');
const field = (name: string) => editor.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
let locales: Locale[] = [], worlds: any[] = [], options: any = {}, detail: any = null, actor: any = null;
let dirty = false, selectedRevision: string | null = null, previewedImport = '';
let importIsValid = false;
const statuses: Record<string, string> = locale === 'zh-CN' ? { draft: '草稿', submitted: '待审核', approved: '已审核', rejected: '已退回', pending: '等待执行', running: '执行中', completed: '完成', failed: '失败', superseded: '已过期' } : {};
const status = (value: string) => statuses[value] ?? value;
const worldId = () => el<HTMLSelectElement>('world').value;
const message = (text: string) => { el('message').textContent = text; };
const errorText = (error: any) => {
  if (error.code === 'REVISION_CONFLICT' || error.code === 'TRANSLATION_CONFLICT') return l('保存冲突：另一位编辑或翻译任务已更新内容。你的输入仍保留；请先复制或导出，再载入最新版本比较。', 'Save conflict: the draft changed. Your input is preserved. Copy it before loading the latest version.');
  if (error.code === 'TRANSLATIONS_REQUIRED') return l('缺少发布所需译文：', 'Required translations missing: ') + JSON.stringify(error.details);
  return error.message + (error.details ? '\n' + JSON.stringify(error.details) : '');
};
async function api(path: string, body?: unknown, method = 'POST'): Promise<any> {
  const response = await fetch('/api' + path, { method: body === undefined ? 'GET' : method, credentials: 'same-origin',
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
  const data = await response.json();
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
function confirmDiscard() { return !dirty || confirm(l('放弃未保存的输入？', 'Discard unsaved input?')); }
const textFields = [
  ['title', '名称', 'Title', false], ['summary', '短介绍', 'Summary', false], ['description', '完整介绍', 'Description', false],
  ['facilities', '设施（每行一项）', 'Facilities (one per line)', true], ['rules', '须知（每行一项）', 'Rules (one per line)', true],
  ['itinerary', '行程（每行一项）', 'Itinerary (one per line)', true], ['hostName', '房东／向导名称', 'Host / guide name', false],
  ['hostBio', '人物介绍', 'Host / guide biography', false], ['imageAlts', '图片说明（图片 ID 对应文字，JSON）', 'Image descriptions (image ID to text, JSON)', false],
] as const;
function renderTextFields(translations: Record<string, ContentText>) {
  const fragment = document.createDocumentFragment();
  for (const language of locales) {
    const section = document.createElement('fieldset'); section.dataset.language = language.code;
    const legend = document.createElement('legend'); legend.textContent = language.name; section.append(legend);
    for (const [key, zh, en, array] of textFields) {
      const label = document.createElement('label'); label.textContent = l(zh, en);
      const input = document.createElement(key === 'title' || key === 'hostName' ? 'input' : 'textarea');
      input.name = `${language.code}:${key}`;
      const value = translations[language.code]?.[key];
      input.value = key === 'imageAlts' ? JSON.stringify(value ?? {}) : array ? (value as string[] ?? []).join('\n') : String(value ?? '');
      if (input instanceof HTMLTextAreaElement) input.rows = key === 'description' ? 5 : 2;
      label.append(input); section.append(label);
    }
    fragment.append(section);
  }
  el('language-fields').replaceChildren(fragment);
}
function readTexts() {
  const result: Record<string, ContentText> = {};
  for (const language of locales) {
    const body: Record<string, unknown> = {};
    let any = false;
    for (const [key, , , array] of textFields) {
      const value = field(`${language.code}:${key}`).value.trim();
      if (key !== 'imageAlts' && value) any = true;
      body[key] = key === 'imageAlts' ? JSON.parse(value || '{}') : array ? value.split('\n').map(v => v.trim()).filter(Boolean) : value;
    }
    if (any) result[language.code] = textSchema.parse(body);
  }
  return result;
}
function formValue() {
  const texts = readTexts(), sourceLocale = field('sourceLocale').value;
  if (!texts[sourceLocale]) throw new Error(l('请填写源语言的名称与完整介绍。', 'Complete the source title and description.'));
  const text = texts[sourceLocale]; delete texts[sourceLocale];
  const kind = detail?.content.kind ?? field('kind').value;
  const attributes: ContentAttributes = { images: field('images').value.split('\n').filter(row => row.trim()).map(row => {
    const [id, url, ...extra] = row.split('|').map(value => value.trim());
    if (!id || !url || extra.length) throw new Error(l('每行图片需要：标识 | 地址', 'Each image needs: ID | URL'));
    return { id, url };
  }) };
  if (kind !== 'review') {
    if (field('amount').value === '') throw new Error(l('请填写虚构金额。', 'Enter the fictional amount.'));
    attributes.price = { amount: Number(field('amount').value), unit: kind === 'stay' ? 'night' : 'person' };
  }
  if (kind === 'experience') attributes.durationMinutes = Number(field('duration').value);
  if (kind === 'review' && field('rating').value) attributes.rating = Number(field('rating').value);
  const shared = { sourceLocale, text, translations: texts, attributes };
  return detail ? { ...shared, baseRevisionId: detail.content.head_revision_id, baseDraftToken: detail.content.draft_token } : {
    ...shared, worldId: worldId(), kind, slug: field('slug').value,
    placeId: field('placeId').value || null, personaId: field('personaId').value || null,
    parentContentId: kind === 'review' ? field('parentContentId').value || null : null,
  };
}
async function refreshList() {
  const data = await api(`/admin/worlds/${worldId()}/contents`);
  const rows = data.contents.map((content: any) => {
    const tr = document.createElement('tr');
    for (const text of [content.title, `${content.number} · ${status(content.status)}`, content.site_blocked ? l('网站限制', 'Site restricted') : content.published_publication_id ? l('已公开', 'Published') : l('未公开', 'Unpublished')]) {
      const td = document.createElement('td'); td.textContent = text; tr.append(td);
    }
    const td = document.createElement('td'); td.append(button(l('编辑', 'Edit'), async () => { if (confirmDiscard()) await openContent(content.id); })); tr.append(td);
    return tr;
  });
  el('content-list').replaceChildren(...rows);
  const { batches } = await api(`/admin/worlds/${worldId()}/imports`);
  el('import-history').replaceChildren(...batches.map((batch: any) => {
    const item = document.createElement('details'); const title = document.createElement('summary'); title.textContent = `${batch.source} · ${new Date(batch.created_at).toLocaleString(locale)}`;
    const result = document.createElement('pre'); result.textContent = JSON.stringify(batch.results, null, 2); item.append(title, result); return item;
  }));
}
async function loadWorld() {
  options = await api(`/admin/worlds/${worldId()}/options`);
  el('editor-panel').hidden = true; detail = null; dirty = false;
  previewedImport = ''; el<HTMLButtonElement>('import-apply').disabled = true;
  await refreshList();
}
async function signIn() {
  ({ actor } = await api('/auth/me'));
  ({ locales } = await api('/locales'));
  ({ worlds } = await api('/admin/worlds'));
  el('account').textContent = actor.email;
  el('login').hidden = true; el('workspace').hidden = false;
  el<HTMLSelectElement>('world').replaceChildren(...worlds.map(world => option(world.id, world.translations[locale]?.name ?? world.slug)));
  if (worlds.length) el<HTMLSelectElement>('world').value = (worlds.find(world => world.slug === 'lathe-worlds') ?? worlds[0]).id;
  if (worlds.length) await loadWorld(); else { el<HTMLButtonElement>('new').disabled = true; message(l('没有可管理的世界。', 'No worlds are assigned to this account.')); }
}
function fillRevision(revision: any) {
  field('sourceLocale').value = revision.source_locale;
  field('amount').value = revision.attributes.price?.amount?.toString() ?? '';
  field('duration').value = revision.attributes.durationMinutes?.toString() ?? '';
  field('rating').value = revision.attributes.rating?.toString() ?? '';
  field('images').value = revision.attributes.images.map((image: any) => `${image.id} | ${image.url}`).join('\n');
  renderTextFields(revision.translations);
  selectedRevision = revision.id;
}
function identity() {
  (field('sourceLocale') as HTMLSelectElement).replaceChildren(...locales.map(item => option(item.code, item.name)));
  for (const [name, list, title] of [
    ['placeId', options.places, (item: any) => item.names[locale] ?? item.slug],
    ['parentContentId', options.parents, (item: any) => item.slug],
    ['personaId', options.personas, (item: any) => item.profiles[locale]?.name ?? item.profiles.en?.name ?? item.id],
  ] as const) (field(name) as HTMLSelectElement).replaceChildren(option('', l('无', 'None')), ...list.map((item: any) => option(item.id, title(item))));
}
function refreshActions() {
  el<HTMLButtonElement>('import-apply').disabled = !previewedImport || !importIsValid;
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
  detail = await api(`/admin/contents/${id}`);
  identity();
  for (const name of ['kind', 'slug']) field(name).value = detail.content[name];
  field('placeId').value = detail.content.place_id ?? '';
  field('parentContentId').value = detail.content.parent_content_id ?? '';
  field('personaId').value = detail.content.persona_id ?? '';
  el<HTMLFieldSetElement>('identity').disabled = true;
  fillRevision(detail.revisions[0]); dirty = false;
  el('editor-title').textContent = detail.revisions[0].source_text.title;
  el('revision-state').textContent = `${l('版本', 'Revision')} ${detail.revisions[0].number} · ${status(detail.revisions[0].status)}`;
  el('editor-panel').hidden = false; el('workflow').hidden = false;
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
  el('jobs').replaceChildren(...detail.jobs.map((job: any) => {
    const row = line(`${job.locale} · ${status(job.status)} · ${job.attempts}/${job.max_attempts} ${job.last_error ?? ''}`);
    if (job.status === 'failed') row.append(button(l('重试', 'Retry'), async () => { await api(`/admin/translation-jobs/${job.id}/retry`, {}); if (!dirty) await openContent(id); }));
    return row;
  }));
  el('events').replaceChildren(...detail.events.map((event: any) => line(`${new Date(event.created_at).toLocaleString(locale)} · ${event.action} · ${event.note}`)));
  refreshActions();
}
el<HTMLFormElement>('login').addEventListener('submit', async event => {
  event.preventDefault(); const data = new FormData(event.currentTarget as HTMLFormElement);
  try { await api('/auth/login', Object.fromEntries(data)); (event.target as HTMLFormElement).reset(); await signIn(); message(''); }
  catch (error) { message(errorText(error)); }
});
editor.addEventListener('input', () => { dirty = true; refreshActions(); });
editor.addEventListener('submit', async event => {
  event.preventDefault(); const submit = editor.querySelector<HTMLButtonElement>('button[type=submit]')!; submit.disabled = true;
  try {
    const result = await api(detail ? `/admin/contents/${detail.content.id}/revisions` : '/admin/contents', formValue());
    await openContent(result.id); await refreshList(); message(l('草稿已保存，公开内容保持原版本。', 'Draft saved. The public version is unchanged.'));
  } catch (error) { message(errorText(error)); }
  finally { submit.disabled = false; }
});
on('new', async () => {
  if (!confirmDiscard()) return;
  detail = null; editor.reset(); identity(); el<HTMLFieldSetElement>('identity').disabled = false;
  renderTextFields({}); selectedRevision = null; dirty = false;
  el('editor-title').textContent = l('新建内容', 'New content'); el('revision-state').textContent = '';
  el('editor-panel').hidden = false; el('workflow').hidden = true;
});
on('reload-editor', async () => { if (detail && confirmDiscard()) await openContent(detail.content.id); });
on('clear-translations', async () => {
  if (!confirm(l('清空表单中的其他语言？保存草稿后会创建缺译任务，历史版本会保留。', 'Clear other languages in this form? Saving queues missing translations and preserves history.'))) return;
  const source = field('sourceLocale').value;
  for (const language of locales.filter(item => item.code !== source)) {
    for (const [key] of textFields) field(`${language.code}:${key}`).value = key === 'imageAlts' ? '{}' : '';
  }
  dirty = true; refreshActions();
});
on('refresh-list', refreshList);
on('logout', async () => { if (!confirmDiscard()) return; await api('/auth/logout', {}); location.reload(); });
el<HTMLSelectElement>('world').addEventListener('change', async () => { if (!confirmDiscard()) { if (detail) el<HTMLSelectElement>('world').value = detail.content.world_id; return; } try { await loadWorld(); } catch (error) { message(errorText(error)); } });
for (const [id, route, payload] of [
  ['submit-revision', 'submit', () => ({ revisionId: detail.content.head_revision_id })],
  ['publish', 'review', () => ({ revisionId: detail.content.head_revision_id, decision: 'publish', note: el<HTMLTextAreaElement>('moderation-note').value })],
  ['reject', 'review', () => ({ revisionId: detail.content.head_revision_id, decision: 'reject', note: el<HTMLTextAreaElement>('moderation-note').value })],
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
});
window.addEventListener('beforeunload', event => { if (dirty) event.preventDefault(); });
signIn().catch(error => { if (error.code !== 'SESSION_REQUIRED') message(errorText(error)); });
