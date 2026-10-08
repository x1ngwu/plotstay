import { contentPath, fallbackLocales, idSchema, type BookingInput, type BookingQuote, type BookingReceipt, type BookingSnapshot, type QuoteInput } from '@plotstay/contracts';
import { bilingual } from './i18n';
class BookingFailure extends Error { constructor(public code: string, public status = 0) { super(code); } }
async function request<T>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  try { response = await fetch(path, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) }); }
  catch { throw new BookingFailure('NETWORK'); }
  let data: any;
  try { data = await response.json(); } catch { throw new BookingFailure('NETWORK', response.status); }
  if (!response.ok) throw new BookingFailure(data.error?.code ?? 'NETWORK', response.status);
  return data as T;
}
function errorMessage(error: unknown, locale: string) {
  const t = bilingual(locale), code = error instanceof BookingFailure ? error.code : 'NETWORK';
  const messages: Record<string, string> = {
    INVALID_DATES: t('日期已经失效或超出范围。请选择未来 365 天内开始的行程；住宿为 1–30 晚。', 'These dates are no longer valid. Start within the next 365 days; stays must be 1–30 nights.'),
    CAPACITY_EXCEEDED: t('人数超过所选房间可接待的上限，请增加房间或减少人数。', 'There are too many travellers for these rooms. Add rooms or reduce the number of travellers.'),
    SESSION_UNAVAILABLE: t('该场次不可预约或时长尚未公布。请选择可用场次，或返回浏览其他内容。', 'This session is unavailable or its duration has not been published. Choose an available session or browse another listing.'),
    NOT_BOOKABLE: t('内容已下架或暂不可预订。未创建新订单，请返回继续浏览。', 'This listing has been withdrawn or is unavailable. No new booking was created. Please keep exploring.'),
    QUOTE_CHANGED: t('内容或价格已更新。未创建订单，请重新核对行程和报价。', 'The listing or price has changed. No booking was created. Please review a fresh quote.'),
    PRICE_UNAVAILABLE: t('此内容的计价资料尚未准备好，请返回浏览其他内容。', 'Pricing for this listing is not ready. Please browse another listing.'),
    INVALID_INPUT: t('请检查日期、场次、人数及数量是否填写正确。', 'Check the dates, session, travellers and quantities.'),
    INVALID_TRIP: t('行程与内容类型不匹配，请返回详情重新开始。', 'The trip does not match the listing. Return to its detail page and start again.'),
    SESSION_REQUIRED: t('无法读取原游客 Cookie。请允许 Cookie，并使用原浏览器重试；不要通过新身份重试尚未确认结果的请求。', 'The original visitor cookie is missing. Allow cookies and retry in the original browser. Do not retry an unresolved request with a new identity.'),
    IDEMPOTENCY_CONFLICT: t('这次请求已关联另一条预订。请恢复原请求，或返回详情主动开始新的预订。', 'This request is already linked to another booking. Restore the original request or return to the listing to deliberately start a new booking.'),
    STORAGE: t('浏览器无法保存预订恢复信息。请允许此站点的本地存储后重试；尚未提交预订。', 'Your browser cannot save booking recovery information. Allow site storage and retry; no booking has been submitted.'),
    NETWORK: t('连接暂时中断，请稍后重试。', 'The connection was interrupted. Please try again.'),
  };
  return messages[code] ?? (error instanceof BookingFailure && error.status === 429
    ? t('操作过于频繁，请稍候再重试。', 'Too many requests. Wait a moment and retry.') : messages.NETWORK!);
}
function ticketData(s: BookingSnapshot, locale: string, receipt?: BookingReceipt) {
  const t = bilingual(locale), fmt = new Intl.NumberFormat(locale === 'zh-CN' ? 'zh-Hans' : 'en');
  const date = (value: string, timed = false) => new Intl.DateTimeFormat(locale === 'zh-CN' ? 'zh-Hans' : 'en',
    { dateStyle: 'medium', ...(timed ? { timeStyle: 'short' as const, hour12: false } : {}), timeZone: 'UTC' }).format(new Date(timed ? value : value + 'T00:00:00Z'));
  const kind = s.kind === 'stay' ? t('住宿确认单', 'Stay confirmation') : s.kind === 'experience' ? t('活动票', 'Experience ticket') : t('服务凭条', 'Service voucher');
  const trip = s.trip;
  const facts: [string, string][] = [[t('世界', 'World'), s.worldName], [t('地点', 'Location'), s.location]];
  if (trip.kind === 'stay') {
    facts.push([t('入住 / 退房', 'Check-in / out'), `${date(trip.start)} → ${date(trip.end)} · ${s.nights} ${t('晚', 'nights')} · UTC`]);
    facts.push([t('人数 / 房间', 'Travellers / rooms'), `${trip.guests} ${t('人', 'travellers')} · ${trip.rooms} ${t('间', 'rooms')}`]);
  } else {
    facts.push([t('场次', 'Session'), `${date(trip.startsAt, true)} → ${date(s.endsAt!, true)} · UTC`]);
    facts.push([t('人数', 'Travellers'), String(trip.guests)]);
    if (trip.kind === 'service') facts.push([t('服务数量', 'Service quantity'), String(trip.quantity)]);
    facts.push([t('场次类型', 'Session type'), s.sessionSource === 'published' ? t('已发布的模拟场次', 'Published simulation session') : t('每日模拟场次', 'Daily simulation session')]);
  }
  const equation = trip.kind === 'stay' ? `${fmt.format(s.amount)} × ${s.nights} ${t('晚', 'nights')} × ${trip.rooms} ${t('间', 'rooms')}` :
    trip.kind === 'experience' ? `${fmt.format(s.amount)} × ${trip.guests} ${t('人 × 1 场', 'travellers × 1 session')}` : `${fmt.format(s.amount)} × ${trip.quantity} ${t('次服务', 'services')}`;
  const total = `${fmt.format(s.total)} ${s.currencyName}`;
  const meta = receipt ? `${t('编号', 'Document')} ${receipt.id}\n${t('签发时间', 'Issued')} ${date(receipt.createdAt, true)} UTC\n${t('签发语言', 'Issued in')} ${s.locale} · ${t('内容语言', 'Content language')} ${s.contentLocale}` :
    `${t('签发语言', 'Issue language')} ${s.locale} · ${t('内容语言', 'Content language')} ${s.contentLocale}`;
  return { kind, facts, equation: `${equation} ${s.currencyName}`, total, meta };
}
function renderTicket(root: HTMLElement, s: BookingSnapshot, locale: string, receipt?: BookingReceipt) {
  const t = bilingual(locale), data = ticketData(s, locale, receipt);
  const set = (selector: string, value: string) => { root.querySelector(selector)!.textContent = value; };
  set('[data-ticket-kind]', data.kind); set('[data-ticket-title]', s.title); set('[data-ticket-summary]', s.summary);
  set('[data-ticket-equation]', data.equation); set('[data-ticket-total]', data.total); set('[data-ticket-persona]', s.personaName);
  set('[data-ticket-meta]', data.meta);
  if (receipt) set('[data-ticket-status]', t('已签发 · 仅限虚构旅行', 'ISSUED · FICTIONAL TRAVEL ONLY'));
  const facts = root.querySelector('[data-ticket-facts]')!; facts.replaceChildren();
  for (const [label, value] of data.facts) {
    const row = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = label; dd.textContent = value; row.append(dt, dd); facts.append(row);
  }
}

export async function initBooking() {
  const root = document.querySelector<HTMLElement>('[data-booking-page]'); if (!root) return;
  const locale = root.dataset.locale!, prefix = root.dataset.prefix!, kind = root.dataset.kind!, t = bilingual(locale);
  const get = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const form = get<HTMLFormElement>('[data-trip-form]'), fields = get<HTMLFieldSetElement>('[data-trip-fields]');
  const quoteButton = get<HTMLButtonElement>('[data-quote]'), confirm = get<HTMLButtonElement>('[data-confirm]');
  const consent = get<HTMLInputElement>('[data-consent]'), review = get('[data-review]'), message = get('[data-booking-message]'), retry = get<HTMLButtonElement>('[data-retry]');
  const url = new URL(location.href);
  let attempt = url.searchParams.get('attempt');
  if (!idSchema.safeParse(attempt).success) { attempt = crypto.randomUUID(); url.searchParams.set('attempt', attempt); history.replaceState(null, '', url); }
  const storageKey = `plotstay:booking:${attempt}`;
  type Recovery = { fields?: Record<string, string>; pending?: BookingInput };
  let recovery: Recovery = {}, quote: BookingQuote | undefined, input: QuoteInput | undefined, busy = false;
  const save = () => { try { sessionStorage.setItem(storageKey, JSON.stringify(recovery)); } catch { throw new BookingFailure('STORAGE'); } };
  const go = (r: BookingReceipt) => location.replace(`/${prefix}/receipts/${r.id}`);
  const show = (text: string) => { message.textContent = text; };
  const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
  try { recovery = JSON.parse(sessionStorage.getItem(storageKey) || '{}'); } catch { recovery = {}; }
  for (const name of ['start', 'end', 'guests', 'rooms', 'quantity', 'time', 'startsAt']) {
    const control = field(name), value = recovery.fields?.[name] ?? url.searchParams.get(name);
    if (control && value) control.value = name === 'time' ? ({ morning: '10:00', afternoon: '14:00' }[value] ?? value) : value;
  }
  if (!recovery.fields && root.dataset.fixed !== 'true' && kind !== 'stay' && url.searchParams.get('startsAt')) {
    const previous = new Date(url.searchParams.get('startsAt')!);
    if (Number.isFinite(previous.getTime())) { field('start')!.value = previous.toISOString().slice(0, 10); field('time')!.value = previous.toISOString().slice(11, 16); }
  }
  if (!recovery.fields && root.dataset.fixed !== 'true' && url.searchParams.get('time') === 'evening') {
    const note = get('[data-preference-note]'); note.hidden = false;
    note.textContent = t('原选择为晚间，目前仅有 10:00、14:00 UTC 模拟场次。请明确选择新的时间。', 'You selected evening. Only 10:00 and 14:00 UTC simulation sessions are offered; please choose a new time.');
  }
  const today = new Date().toISOString().slice(0, 10);
  const max = new Date(Date.parse(today) + 365 * 86400000).toISOString().slice(0, 10);
  for (const control of form.querySelectorAll<HTMLInputElement>('input[type=date]')) { control.min = today; control.max = control.name === 'end' ? new Date(Date.parse(max) + 30 * 86400000).toISOString().slice(0, 10) : max; }
  if (!recovery.fields && root.dataset.fixed === 'true' && url.searchParams.get('start')) {
    const wanted = url.searchParams.get('start')!, preference = url.searchParams.get('time');
    const matches = [...(field('startsAt') as HTMLSelectElement).options].filter(o => !o.disabled && o.value.startsWith(wanted) &&
      (!preference || (preference === 'morning' ? new Date(o.value).getUTCHours() < 12 : preference === 'afternoon' ? new Date(o.value).getUTCHours() >= 12 && new Date(o.value).getUTCHours() < 18 : new Date(o.value).getUTCHours() >= 18)));
    if (matches.length) field('startsAt')!.value = matches[0]!.value;
    else { const note = get('[data-preference-note]'); note.hidden = false; note.textContent = t(`原选择为 ${wanted}，没有匹配的可用场次。请明确选择新的时间。`, `Your selected date was ${wanted}; no available session matches. Please choose a new time.`); }
  }
  const remember = () => { recovery.fields = Object.fromEntries(new FormData(form).entries()) as Record<string, string>; save(); };
  const readInput = (): QuoteInput => ({ contentId: root.dataset.contentId!, locale, trip: kind === 'stay'
    ? { kind: 'stay', start: field('start')!.value, end: field('end')!.value, guests: Number(field('guests')!.value), rooms: Number(field('rooms')!.value) }
    : kind === 'experience' ? { kind: 'experience', startsAt: field('startsAt')?.value || `${field('start')!.value}T${field('time')!.value}:00Z`, guests: Number(field('guests')!.value) }
    : { kind: 'service', startsAt: field('startsAt')?.value || `${field('start')!.value}T${field('time')!.value}:00Z`, guests: Number(field('guests')!.value), quantity: Number(field('quantity')!.value) } });
  function editable() { fields.disabled = false; quoteButton.disabled = false; review.hidden = true; retry.hidden = true; consent.checked = false; confirm.disabled = true; }
  form.addEventListener('input', () => { if (!recovery.pending) { review.hidden = true; quote = undefined; try { remember(); } catch (e) { show(errorMessage(e, locale)); } } });
  consent.addEventListener('change', () => { confirm.disabled = !consent.checked || busy; });
  get('[data-edit]').addEventListener('click', () => { if (!recovery.pending) { editable(); field(kind === 'stay' || root.dataset.fixed !== 'true' ? 'start' : 'startsAt')?.focus(); } });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy || recovery.pending) return;
    busy = true; quoteButton.disabled = true; show(t('正在核对行程与价格…', 'Checking your trip and price…'));
    try { remember(); input = readInput(); quote = await request<BookingQuote>('/api/bookings/quote', input);
      renderTicket(root, quote.snapshot, locale); review.hidden = false; fields.disabled = true;
      consent.checked = false; confirm.disabled = true; show(t('请核对右侧（手机为下方）行程，确认后才会保存预订。', 'Review your trip beside or below this form. Your booking is saved only after confirmation.'));
      review.scrollIntoView({ behavior: 'smooth', block: 'start' }); consent.focus({ preventScroll: true });
    } catch (e) { editable(); show(errorMessage(e, locale)); }
    finally { busy = false; quoteButton.disabled = fields.disabled; }
  });
  async function submit() {
    if (busy) return; busy = true; confirm.disabled = true; retry.disabled = true;
    try {
      if (!recovery.pending) {
        if (!quote || !input || !consent.checked) return;
        recovery.pending = { ...input, quoteHash: quote.quoteHash, idempotencyKey: attempt! };
        try { save(); } catch (e) { delete recovery.pending; throw e; }
      }
      fields.disabled = true; quoteButton.disabled = true; get<HTMLButtonElement>('[data-edit]').disabled = true;
      show(t('正在签发凭条，请稍候…', 'Issuing your document…'));
      const result = await request<{ receipt: BookingReceipt }>('/api/bookings', recovery.pending); go(result.receipt);
    } catch (e) {
      // Only definitive validation failures permit editing. Ambiguous network/server failures keep the exact request.
      const definitive = e instanceof BookingFailure && ['INVALID_INPUT','INVALID_TRIP','INVALID_DATES','CAPACITY_EXCEEDED','SESSION_UNAVAILABLE','NOT_BOOKABLE','QUOTE_CHANGED','PRICE_UNAVAILABLE'].includes(e.code);
      if (e instanceof BookingFailure && e.code === 'STORAGE') { confirm.disabled = false; retry.hidden = true; show(errorMessage(e, locale)); return; }
      if (definitive) { delete recovery.pending; try { save(); } catch {} editable(); get<HTMLButtonElement>('[data-edit]').disabled = false; }
      else retry.hidden = false;
      show(errorMessage(e, locale) + (definitive ? '' : t(' 结果尚未确认。重试会查询或返回同一张凭条，不会重复创建。', ' The result is not yet confirmed. Retrying recovers the same document without creating a duplicate.')));
    } finally { busy = false; retry.disabled = false; }
  }
  confirm.addEventListener('click', () => void submit()); retry.addEventListener('click', () => void submit());
  quoteButton.disabled = true;
  try {
    // Serialize first-cookie creation across tabs. Never replace an identity for an unresolved submission.
    const init = async () => {
      try { await request('/api/guest'); }
      catch (e) {
        if (recovery.pending || !(e instanceof BookingFailure) || e.code !== 'SESSION_REQUIRED') throw e;
        await request('/api/guest', {}); await request('/api/guest');
      }
    };
    if (navigator.locks) await navigator.locks.request('plotstay:guest', init); else await init();
    const previous = await request<{ receipt: BookingReceipt | null }>(`/api/bookings/attempts/${attempt}`);
    if (previous.receipt) { go(previous.receipt); return; }
    if (recovery.pending) { fields.disabled = true; review.hidden = true; retry.hidden = false; show(t('发现尚未确认结果的请求。请重试同一次预订以恢复凭条。', 'An unresolved request was found. Retry this booking to recover its document.')); }
    else { fields.disabled = false; quoteButton.disabled = false; }
  } catch (e) { show(errorMessage(e, locale)); if (recovery.pending) { fields.disabled = true; retry.hidden = false; }
    else { show(errorMessage(e, locale) + t(' 请刷新页面后重试。', ' Reload this page to retry.')); } }
}

export async function initReceipt() {
  const root = document.querySelector<HTMLElement>('[data-receipt-page]'); if (!root) return;
  const locale = root.dataset.locale!, prefix = root.dataset.prefix!, t = bilingual(locale);
  const get = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const message = get('[data-booking-message]'); let receipt: BookingReceipt | undefined;
  let detailHref = '', receiptHref = '';
  async function load() {
    get<HTMLButtonElement>('[data-load-retry]').disabled = true;
    try {
      if (!root!.dataset.id) throw new BookingFailure('NOT_FOUND', 404);
      receipt = (await request<{ receipt: BookingReceipt }>(`/api/bookings/${root!.dataset.id}`)).receipt;
      if (receipt.snapshot.version !== 1) { message.textContent = t('这是一条早期测试凭条，未保存完整行程。', 'This is an early test document without a complete trip snapshot.'); return; }
      const s = receipt.snapshot;
      renderTicket(root!, s, locale, receipt); get('[data-receipt-content]').hidden = false;
      get('[data-load-retry]').hidden = true; message.textContent = t('预订已保存，凭条已签发。不会真实扣款。', 'Your booking is saved and your document is issued. No real charge.');
      const loc = { ...(fallbackLocales.find(l => l.code === locale) ?? fallbackLocales[0]!), pathPrefix: prefix };
      detailHref = new URL(contentPath(loc, { worldSlug: s.worldSlug, kind: s.kind, slug: s.contentSlug }), location.origin).href;
      receiptHref = `${location.origin}/${prefix}/receipts/${receipt.id}`;
      get<HTMLAnchorElement>('[data-listing-link]').href = detailHref;
      const params = new URLSearchParams(s.trip.kind === 'stay' ? { start: s.trip.start, end: s.trip.end, rooms: String(s.trip.rooms), guests: String(s.trip.guests) }
        : { startsAt: s.trip.startsAt, guests: String(s.trip.guests), ...(s.trip.kind === 'service' ? { quantity: String(s.trip.quantity) } : {}) });
      get<HTMLAnchorElement>('[data-book-again]').href = `/${prefix}/booking/${s.contentId}?${params}`;
      get<HTMLAnchorElement>('[data-explore]').href = `/${prefix}?world=${encodeURIComponent(s.worldSlug)}`;
    } catch (e) {
      message.textContent = e instanceof BookingFailure && (e.code === 'SESSION_REQUIRED' || e.status === 404)
        ? t('无法访问这张凭条。请使用保有原游客 Cookie 的浏览器；编号或链接不能用来访问其他人的记录。', 'This document is unavailable. Use the browser holding your original visitor cookie; a number or link cannot grant access to someone else’s record.') : errorMessage(e, locale);
      get('[data-load-retry]').hidden = false;
    } finally { get<HTMLButtonElement>('[data-load-retry]').disabled = false; }
  }
  get('[data-load-retry]').addEventListener('click', () => void load());
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); message.textContent = t('链接已复制。', 'Link copied.'); }
    catch { get('[data-copy-fallback]').hidden = false; const input = get<HTMLInputElement>('[data-copy-value]'); input.value = value; input.focus(); input.select(); message.textContent = t('自动复制失败，请手动复制下方链接。', 'Automatic copying failed. Copy the link below manually.'); }
  }
  get('[data-copy-detail]').addEventListener('click', () => void copy(detailHref));
  get('[data-copy-receipt]').addEventListener('click', () => void copy(receiptHref));
  get('[data-download]').addEventListener('click', async () => {
    const button = get<HTMLButtonElement>('[data-download]'); button.disabled = true;
    try { if (!receipt || receipt.snapshot.version !== 1) throw new Error(); await downloadReceipt(receipt, receipt.snapshot, locale, root!);
      message.textContent = t('凭条图片已生成。请在浏览器下载中查看，或使用系统保存图片。', 'Your document image is ready. Check browser downloads or use your device’s save image action.');
    } catch { message.textContent = t('图片下载失败，预订仍已保存。请重试，或先截图保存这张凭条。', 'Image download failed; your booking is still saved. Retry or take a screenshot of this document.'); }
    finally { button.disabled = false; }
  });
  await load();
}
async function downloadReceipt(receipt: BookingReceipt, s: BookingSnapshot, locale: string, root: HTMLElement) {
  await document.fonts.ready;
  const t = bilingual(locale), data = ticketData(s, locale, receipt), canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('CANVAS');
  const font = getComputedStyle(root).fontFamily;
  const lines = ['PLOTSTAY / ' + data.kind, t('已签发 · 虚构旅行', 'ISSUED · FICTIONAL TRAVEL'), '', s.title, s.summary, '',
    ...data.facts.map(([k, v]) => `${k}: ${v}`), '', t('价格明细', 'PRICE BREAKDOWN'), data.equation,
    t('税费及手续费：0', 'Taxes & fees: 0'), `${t('虚构合计', 'Fictional total')}: ${data.total}`, '',
    t('虚拟礼宾卡', 'VIRTUAL CONCIERGE CARD'), s.personaName, '',
    t('不会真实扣款；不提供现实中的住宿、活动或服务。', 'No real charge, accommodation, activity or service.'), '', ...data.meta.split('\n')];
  // Draw text directly; no remote images, credentials or live content enter the exported snapshot.
  const wrapped: string[] = [];
  ctx.font = `22px ${font}`;
  for (const line of lines) {
    let current = '';
    for (const { segment } of new Intl.Segmenter(locale, { granularity: 'word' }).segment(line)) {
      if (current && ctx.measureText(current + segment).width > 680) { wrapped.push(current.trimEnd()); current = ''; }
      for (const char of segment) { if (ctx.measureText(current + char).width > 680) { wrapped.push(current); current = ''; } current += char; }
    }
    wrapped.push(current);
  }
  const width = 800, height = Math.max(900, 110 + wrapped.length * 36);
  canvas.width = width * 2; canvas.height = height * 2; ctx.scale(2, 2);
  ctx.fillStyle = '#111111'; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#33ff99'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.strokeRect(20, 20, width - 40, height - 40);
  ctx.fillStyle = '#33ff99'; ctx.font = `22px ${font}`; ctx.textBaseline = 'top';
  wrapped.forEach((line, i) => ctx.fillText(line, 56, 56 + i * 36));
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('ENCODE')), 'image/png'));
  const objectUrl = URL.createObjectURL(blob), link = document.createElement('a'); link.href = objectUrl; link.download = `plotstay-${s.kind}-${receipt.id}.png`;
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
}
