import { serviceTextSchema, textSchema, type ContentAttributes } from '@plotstay/contracts';
export const serviceDemoImages = [{id:'service-forge',url:'/media/forge-walk.svg'},{id:'service-lounge',url:'/media/quarters.svg'}];
export const serviceDemoAttributes:NonNullable<ContentAttributes['service']> = {demo:true,sessions:[
 {startsAt:'2026-10-15T10:00:00Z',endsAt:'2026-10-15T10:45:00Z'},
 {startsAt:'2026-10-15T14:00:00Z',endsAt:'2026-10-15T14:45:00Z'},
]};
export function serviceDemoText(locale:string){const t=(zh:string,en:string)=>locale==='zh-CN'?zh:en;return serviceTextSchema.parse({
 introduction:t('在拉斯的铸造街区，我和搭档照看着一张下班后仍亮着灯的检修台。从细小异响到不够顺手的关节，我们会耐心听你描述，再用一套老派工具，让随行的机械伙伴重新找回轻快的节奏。','In the foundry quarter of Lathe, my partner and I keep a workbench lit after the shift ends. From a quiet rattle to a stiff joint, we listen first, then use a well-loved set of tools to help your mechanical companion find its easy rhythm again.'),
 providerRole:t('义体与随行机械维护师','Augmetic & companion mechanic'),venueName:t('第七街区 · 下班后的检修台','Seventh Quarter · After-hours Workshop'),venueAddress:t('拉斯世界，铸造街区，第七接驳站东侧','Lathe Worlds · Foundry Quarter · east of Shuttle Stop Seven'),
 offeringTitle:t('一对一义体检查与轻度保养','Personal augmetic check & tune-up'),offeringImageId:'cover',
 offeringDescription:t('给旅行途中的机械伙伴一次从容的检查。我们会先听你说说使用习惯，再检查外部连接、清理可拆卸护盖、调整关节阻尼，最后一起试一试动作是否顺畅。包含基础耗材、一份保养记录与日常照看建议；不涉及替换核心部件。','Give your travelling mechanical companion an unhurried check. We’ll ask about everyday use, inspect external connections, clean removable covers and adjust the joint damping before trying each movement together. Basic supplies, a maintenance note and care tips are included; core component replacement is outside this session.'),
 customization:t('可以联系检修师说明机型、偏好的沟通语言，或讨论更安静的服务时段。','Message the mechanic to discuss your model, preferred language or a quieter time for your visit.'),
 cancellationBadge:t('开始前 1 天可免费取消','Free cancellation up to 1 day before'),
 qualifications:[
 {icon:'clock',title:t('12 年街区检修经历','12 years at the neighbourhood workbench'),description:t('从货运小车到旅客的随行装置，长年处理日常磨损与细小故障，擅长把问题说得明白。','Years of everyday repairs, from freight carts to travellers’ devices, with an emphasis on explaining small faults clearly.')},
 {icon:'star',title:t('第七街区手作展优胜','Seventh Quarter craft fair award'),description:t('凭一套可重复使用的精密校准夹具，在街区手作展获得工匠评审认可。','Recognised by the local makers’ panel for a reusable set of precision calibration fixtures.')},
 {icon:'book',title:t('精密维护工坊研修结业','Precision maintenance workshop training'),description:t('完成街区工坊的工具校准与维护记录研修，持续整理适合旅客阅读的保养说明。','Completed local workshop training in tool calibration and maintenance records, and keeps a collection of care notes written for travellers.')},
 ],
 contactNote:t('联系功能尚未开放。这里是虚构世界的服务样例，不会发送消息，也不会收取真实费用。','Messaging is not open yet. This fictional-world service preview does not send messages or collect real payments.'),
 locationNote:t('检修台位于一层有顶街廊内，入口有绿色齿轮门牌。旅客休息区就在旁边，可以坐下等候或观看检修过程。','The workbench is on the ground floor of a covered arcade, behind a green gear sign. A guest lounge sits beside it, with space to wait or watch the work.'),
 directions:t('从第七接驳站东侧出口直行约 3 分钟，在饮水点右转。请走旅客街廊，不要进入货运通道。','Walk straight for about three minutes from the east exit of Shuttle Stop Seven, then turn right at the water station. Follow the guest arcade rather than the freight corridor.'),
 guestRequirements:t('每次接待 1 位旅客及 1 台随行装置，可由 1 位同伴陪同。请在到达前整理好可拆卸配件，并说明希望改善的日常使用问题。','Each session welcomes one traveller and one companion device, with one accompanying guest if needed. Keep removable accessories together and tell us which everyday issues you would like to improve.'),
 accessibility:t('入口无台阶，检修台旁有可移动座椅与等候空间。需要低噪声时段、更多休息时间或文字沟通时，可在联系功能开放后提前说明。','The entrance is step-free, with movable seating and a waiting area beside the bench. When messaging opens, ask about a quieter session, extra breaks or written communication.'),
 cancellation:t('样例规则：开始前至少 1 天取消，可退回全部虚构费用。当前日期只用于展示，尚未开放预约，不会产生实际订单。','Example policy: cancel at least one day before the start for a full refund of fictional credits. Dates are for display only; reservations are not open and no orders are created.'),
});}
const reviewRows=[
 ['洛安','Loann','轨道港','Orbital Harbour','把异响讲明白了','A clear explanation of the rattle','随行装置的异响困扰了我好几天。检修师先听我描述，再一处处演示问题在哪里，结束时还给了一张能看懂的维护记录。过程很安心。','The rattle in my companion device had bothered me for days. The mechanic listened, showed me where it came from and left me with a maintenance note I could actually understand. A reassuring visit.','耐心讲解','Clear explanations',5],
 ['塔米','Tami','下层居住舱','Lower Quarters','小工具也照顾得很认真','Care for the smallest tools','带来的只是一个很旧的随行小助手，也没有被敷衍。护盖清理得很仔细，调整后的动作比来之前顺畅，旁边等候区也很舒服。','I brought an ageing little companion, and it received just as much care as anything new. The covers were cleaned carefully, its movement felt smoother, and the waiting area was comfortable.','细致维护','Careful work',5],
 ['旅客二十三','Visitor 23','档案区','Archive Quarter','慢工出细活','Good work takes time','讲解和手艺都很好，比预计多等了几分钟。好在提前说明了原因，还让我在休息区慢慢喝完热饮。赶接驳车的话建议多留一点时间。','The explanations and workmanship were excellent, though it took a few minutes longer than expected. They explained why and let me finish a warm drink in the lounge. Leave a little buffer if you have a shuttle to catch.','舒适等候','Comfortable wait',4],
 ['索拉','Sora','东侧货运环','East Freight Ring','不用懂机械也能沟通','Easy to talk things through','我说不出专业术语，只会形容哪里不太顺手。检修师用很普通的话问问题，没有让我觉得自己问得太简单。回去后也知道该怎么日常照看。','I had no technical vocabulary, just a sense that something felt stiff. The mechanic used everyday language and never made my questions feel too basic. I left knowing how to take care of it between visits.','耐心讲解','Clear explanations',5],
 ['宁舟','Ning Zhou','测试港湾','Test Harbour','顺路的一次好保养','A useful stop along the way','集合地点很好找，工具和耗材都已准备好。最喜欢最后一起试动作的环节，可以直接说出自己的感觉，而不是拿到东西就走。','The workshop was easy to find, with tools and supplies ready. My favourite part was trying each movement together at the end, so I could explain how it felt before leaving.','细致维护','Careful work',5],
 ['艾拉','Ayla','南侧接驳站','South Shuttle Station','带走了有用的小建议','Small tips to take home','除了完成这次保养，还教了我几个不用工具就能做的小检查。整个过程节奏从容，没有额外推销，报价和事先看到的一致。','Along with the tune-up, I learnt a few simple checks that need no tools. The visit was unhurried, with no extra sales pitch, and the price matched what I had seen beforehand.','价格清楚','Clear pricing',5],
] as const;
export function serviceDemoReview(locale:string,index:number){const r=reviewRows[index]!;const zh=locale==='zh-CN';return textSchema.parse({title:r[zh?4:5],description:r[zh?6:7],tags:[r[zh?8:9]],review:{name:r[zh?0:1],origin:r[zh?2:3],stayDuration:zh?'使用了 45 分钟保养服务':'A 45-minute tune-up'}});}
export const serviceDemoRatings=reviewRows.map(r=>r[10]);
