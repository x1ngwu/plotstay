import { experienceTextSchema, type ExperienceText, type ContentAttributes } from '@plotstay/contracts';
export const experienceDemoImages = [
 {id:'forge',url:'/media/forge-walk.svg'}, {id:'workbench',url:'/media/maintenance.svg'},
 {id:'orbit',url:'/media/lathe-orbit.svg'}, {id:'lounge',url:'/media/quarters.svg'},
];
export const experienceDemoAttributes: NonNullable<ContentAttributes['experience']> = {
 demo:true, opensAt:'2026-10-12T10:00:00Z',
 sessions:[{startsAt:'2026-10-14T10:30:00Z',endsAt:'2026-10-14T12:00:00Z'},{startsAt:'2026-10-14T13:30:00Z',endsAt:'2026-10-14T15:00:00Z'}],
};
export function experienceDemoText(locale:string):ExperienceText {
 const t=(zh:string,en:string)=>locale==='zh-CN'?zh:en;
 const steps=[
  ['在换班休息室碰面','Meet in the shift lounge','先喝一杯热饮，认识同行的旅客。我会发给你一副护目镜和一张路线卡，讲讲今天要经过的三座铸造大厅。','Start with a warm drink and meet your fellow travellers. I’ll hand you goggles and a route card, then introduce the three foundry halls on our walk.','lounge','cup'],
  ['走上炉火旁的高架步道','Follow the elevated furnace walk','沿着隔热观察廊，看看熔融金属如何流进模具。我们会在两个观察窗停留，听听炉工用敲击声传递的换班信号。','From a sheltered gallery, watch molten metal flow into moulds. Stop at two observation windows and listen for the tapping signals the furnace crews use at shift change.','forge','walk'],
  ['亲手校准一枚纪念齿轮','Calibrate a keepsake gear','在已经停机的教学工作台上，试着对齐刻度、检查齿隙，再为小齿轮刻上自己的旅客编号。无需经验，我会逐步带你完成。','At a deactivated teaching bench, line up the marks, check the teeth and stamp a visitor number on a small gear. No experience is needed; I’ll guide each step.','workbench','key'],
  ['把铸造区的光留在照片里','Catch the foundry glow','带着自己的作品走到上层观景窗。这里可以看到轨道货船与车间灯带；留一点时间拍照，也听听这一片厂区的旧故事。','Bring your handiwork to the upper viewing window. See orbital freighters and workshop lights, take a few photos and hear a story from the foundry’s early days.','orbit','window'],
  ['围坐聊天，带走一份纪念','Trade stories and take home a gift','回到休息室，翻看老工匠的工作手册，问问你对拉斯日常生活的好奇。离开前，收好纪念齿轮与一张手绘路线明信片。','Back in the lounge, browse an old craft manual and ask about everyday life on Lathe. Leave with your keepsake gear and a hand-drawn route postcard.','lounge','book'],
 ] as const;
 return experienceTextSchema.parse({
 introduction:t('跟着当地向导走进拉斯的铸造街区，在炉火映亮的观察廊里听工匠的故事，再亲手校准一枚属于你的纪念齿轮。热饮、护目镜与一点点好奇心，让这趟漫步从容开始。','Explore the foundry quarter with a local guide. Hear the makers’ stories from a furnace-lit gallery, then calibrate a keepsake gear of your own. A warm drink, safety goggles and a little curiosity are all you need to begin.'),
 privateGroups:t('欢迎私人小团体','Private groups welcome'),cancellationBadge:t('可免费取消','Free cancellation'),
 hostRole:t('铸造区向导 · 机械手作爱好者','Foundry guide · mechanical craft enthusiast'),language:t('以中文和英语开展','Hosted in Chinese and English'),
 expertiseTitle:t('12 年车间工作经历','12 years on the workshop floor'),expertiseDescription:t('熟悉炉火、齿轮，也熟悉街区里的小故事。','A local eye for furnaces, gears and the stories between them.'),
 originalTitle:t('PLOTSTAY 原创体验','PLOTSTAY Original'),originalDescription:t('由当地向导为旅客设计的一条慢游路线，把观察、手作和聊天留在同一个下午。','A route designed by a local guide, with time to observe, make something and share a conversation.'),
 whatToDo:t('我在铸造区长大，最熟悉的声音是换班铃和金属冷却时细小的脆响。这一次，我想带你看见生产线之外的日常：炉工用什么记住复杂的工序，老工作台为什么还留着手写刻度。\n\n我们会沿观察廊慢慢走，在安全的教学区动手做一枚小齿轮，最后带着作品回到休息室。如果你喜欢机器、城市故事，或者只是想在陌生世界里过一个不赶时间的下午，就来一起走走。','I grew up in the foundry quarter, surrounded by shift bells and the quiet crackle of cooling metal. On this walk, I want to show you life beyond the production line: how workers remember a complicated sequence, and why the old benches still carry handwritten marks.\n\nWe’ll take our time along the observation gallery, work on a little gear in a safe teaching area, then return to the lounge with our creations. Come for the machines, the neighbourhood stories or simply an unhurried afternoon in another world.'),
 steps:steps.map(([zh,en,zd,ed,imageId,icon])=>({title:t(zh,en),description:t(zd,ed),imageId,icon})),
 meetingTitle:t('铸造区 · 第七换班休息室','Foundry quarter · Seventh Shift Lounge'),meetingAddress:t('拉斯世界，下层铸造街区，七号接驳站旁','Lathe Worlds · Lower Foundry Quarter · beside Shuttle Stop Seven'),
 meetingNote:t('请提前 10 分钟到达接驳站出口，寻找带齿轮标志的绿色门牌。这里是本次虚构行程的集合点。','Arrive 10 minutes early at the shuttle exit and look for the green sign with a gear. This is the meeting point for our fictional journey.'),
 directions:t('从接驳站沿有顶步道步行约 3 分钟，在第二个路口右转。休息室入口与观察廊入口分开，请勿进入生产通道。','Follow the covered walkway for about three minutes from the shuttle stop and turn right at the second junction. Use the lounge entrance, separate from the production corridor.'),
 hostIntroduction:t('你好，我是铸造区的向导。我在这里做过十二年的车间记录员，也一直喜欢把复杂的机械故事讲得简单一些。休息日，我会修理旧仪表、收集手写路线图，偶尔带第一次来拉斯的朋友在街区里散步。\n\n这条路线选了我最喜欢的几个停靠点。你不用懂机械，也不用赶进度；带着问题来，我们边走边聊。','Hello, I’m your foundry guide. I spent twelve years keeping workshop records here, and I enjoy making complicated mechanical stories easy to follow. On my days off I repair old gauges, collect hand-drawn maps and show newcomers around the quarter.\n\nThis route brings together my favourite stops. You don’t need to know about machines or keep a hurried pace. Bring your questions and we’ll talk as we walk.'),
 contactNote:t('这是虚构体验样例。联系功能尚未开放，本页不会发送消息或收取费用。','This is a fictional experience preview. Messaging is not open; this page does not send messages or collect payment.'),
 guestRequirements:t('适合 16 岁及以上旅客；未成年旅客需由成人陪同。每组最多 6 人。','Suitable for guests aged 16 and up. Minors must be accompanied by an adult. Up to six guests per group.'),
 activityLevel:t('活动强度轻，适合初学者。包含约 40 分钟慢步行与短时间站立，其余时间可坐下。','Light activity, suitable for beginners. Expect around 40 minutes of gentle walking and short periods of standing, with seats at the other stops.'),
 bring:t('请穿包头平底鞋，携带饮用水和旅客通行证。护目镜、手套与手作工具由向导提供。','Wear closed-toe flat shoes and bring drinking water and a visitor pass. Your guide provides goggles, gloves and craft tools.'),
 accessibility:t('主要路线设有升降梯和休息座位；观察廊有一段较窄通道。如需无台阶路线或安静休息空间，可在联系功能开放后与向导确认。','The main route has lifts and rest seats, with one narrow section in the gallery. When messaging opens, ask the guide about a step-free route or a quiet rest space.'),
 cancellation:t('样例规则：活动开始前至少 3 天取消，可全额退回虚构费用。目前未开放预约，不产生实际订单。','Example policy: cancel at least three days before the start for a full refund of fictional credits. Reservations are not open and no orders are created.'),
 screening:t('入场前需核对旅客通行证，并听取简短的安全说明。请勿触碰生产设备；手作仅使用停机教学装置。','Your visitor pass is checked before entry, followed by a short safety briefing. Do not touch production equipment; craft activities use deactivated teaching equipment only.'),
 });
}
