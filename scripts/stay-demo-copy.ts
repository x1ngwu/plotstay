import { stayTextSchema, type StayAttributes } from '@plotstay/contracts';

// Authorised bilingual demonstration content. Stored in reviewed revisions, never baked into page templates.
const amenityRows = [
  ['wifi','无线网络','Wifi','房间内可用的旅客网络。','Guest network in the room.'],
  ['desk','专用工作区','Dedicated workspace','一张书桌和一把椅子。','A desk and a chair.'],
  ['tv','信息屏幕','Information screen','查看本地公告与舱区信息。','Local notices and cabin information.'],
  ['lift','升降梯','Elevator','连接公共楼层。','Connects the shared floors.'],
  ['washer','共用洗衣机','Shared washer','公共洗衣区内提供。','Located in the shared laundry.'],
  ['dryer','共用烘干机','Shared dryer','使用安排以现场说明为准。','See the posted instructions for use.'],
  ['air','空气循环','Air circulation','房间内有独立通风口。','A dedicated room ventilation outlet.'],
  ['hair','吹风机','Hair dryer','位于共用洗漱区。','In the shared washroom.'],
  ['kitchen','微波加热设备','Microwave','位于公共备餐区。','In the shared food preparation area.'],
  ['alarm','一氧化碳报警器','Carbon monoxide alarm','演示资料暂未说明。','Not reported in this demonstration listing.'],
  ['alarm','烟雾报警器','Smoke alarm','公共走廊内设有报警设备。','Alarm equipment in the shared corridor.'],
  ['bed','床品','Bed linen','每次接待前更换。','Changed before each arrival.'],
  ['towel','浴巾','Bath towels','每位旅客提供一套。','One set per guest.'],
  ['bath','洗漱用品','Toiletries','含基础清洁用品。','Basic washroom supplies.'],
  ['cup','饮用水','Drinking water','可在公共区域补充。','Refill in the common area.'],
  ['lock','房门密码锁','Keypad lock','按入住说明开启房门。','Follow the arrival instructions.'],
  ['window','观察窗','Observation window','可查看舱区外的景观。','A view beyond the cabin.'],
  ['light','阅读灯','Reading light','床边独立开关。','An independent bedside switch.'],
  ['book','旅客指南','Guest guide','介绍公共区域与周边地点。','An introduction to shared areas and nearby places.'],
  ['clock','报时钟','Clock','为本次虚构行程提供时间参考。','A time reference for your fictional journey.'],
  ['bag','行李存放区','Luggage storage','位于房间入口附近。','Near the room entrance.'],
  ['bath','共用淋浴间','Shared showers','与同楼层旅客共同使用。','Shared with guests on the same floor.'],
  ['kitchen','共用冷藏柜','Shared refrigerator','请标注自己的物品。','Please label your belongings.'],
  ['kitchen','独立厨房','Private kitchen','房间内不提供独立厨房。','No private kitchen inside the room.'],
] as const;
export const demoStayAttributes: StayAttributes = {demo:true,guests:1,bedrooms:1,beds:1,bathrooms:.5,hostYears:1,hostReviewCount:24,hostRating:4.8,responseRate:100};
export function stayDemoText(locale: string, place: string, slug: string) {
 const zh=locale==='zh-CN', t=(a:string,b:string)=>zh?a:b;
 return stayTextSchema.parse({
  propertyType:t('独立客舱','Private cabin'),bathroom:t('共用半卫浴','Shared half bathroom'),
  sleeping:[{name:t('卧室','Bedroom'),description:t('1 张单人床 · 床品与阅读灯','1 single bed · bed linen and reading light')}],
  introduction:t('这是一间供一位旅客休息的独立客舱。配有床铺、阅读灯和小型工作区，适合在抵达后安顿行李，或在下一段行程前停留。\n\n无线网络、毛巾和基础洗漱用品均已列入演示设施。洗漱与淋浴空间位于公共区域，洗衣、烘干和冷藏设备与其他旅客共用。',
   'A private cabin for one traveller, with a bed, reading light and a small workspace. Set down your luggage after arrival or rest before the next leg of your journey.\n\nWifi, towels and basic toiletries are included in this demonstration. Washrooms and showers are in shared areas; laundry, drying and refrigeration facilities are shared with other guests.'),
  space:t(`客舱位于${place}。入口旁留有行李空间，床铺与工作区分开布置。公共走廊连接洗漱区和旅客休息区。\n\n到达后可按门锁说明自行入住。这里的空间配置、路线和开放时间均为演示占位，日后可由世界作者继续完善。`,
   `The cabin is in ${place}. Luggage storage is near the entrance, with separate sleeping and working areas. A shared corridor leads to the washrooms and guest lounge.\n\nUse the keypad instructions for self check-in. The room configuration, routes and opening hours are demonstration details for the world’s author to refine.`),
  registration:t(`虚构住宿登记：PS-${slug.toUpperCase()}。仅用于世界内叙事展示，不是现实住宿许可。`,`Fictional accommodation register: PS-${slug.toUpperCase()}. This is an in-world demonstration identifier, not a real accommodation licence.`),
  favoriteTitle:t('旅客喜爱','Guest favorite'),favoriteDescription:t('虚构旅客手记中受到喜爱的住宿选择。','A well-loved stay in our fictional visitors’ notes.'),
  highlights:[
   {icon:'key',title:t('自助入住','Self check-in'),description:t('按照到达说明，使用密码锁进入客舱。','Let yourself into the cabin with the keypad instructions.')},
   {icon:'space',title:t('舒适的独处空间','Room to settle in'),description:t('床铺、书桌与行李区各有位置，适合独自旅行。','Separate sleeping, working and luggage areas for a solo journey.')},
   {icon:'bath',title:t('共用卫浴','Shared bathroom'),description:t('洗漱与淋浴区域与其他旅客共用。','Washrooms and showers are shared with other guests.')},
  ],
  amenities:amenityRows.map(([icon,cn,en,cnDetail,enDetail],i)=>({icon,name:t(cn,en),description:t(cnDetail,enDetail),category:i<11?t('日常设施','Everyday amenities'):t('客舱与公共区域','Cabin and shared spaces'),status:i===9?'unreported':i===23?'unavailable':'available'})),
  hostBadge:t('超赞房东','Superhost'),hostIntroduction:t('负责接待、客舱交接和旅客问询的本地房东。熟悉公共区域的使用方式，也乐意介绍附近的休息地点。\n\n人物资历、评分与响应数据为本次页面演示资料，后续可由作者替换。','A local host who handles arrivals, cabin handovers and guest questions. Familiar with the shared spaces and happy to point out nearby places to rest.\n\nQualifications, profile ratings and response information are demonstration details that the author can replace.'),
  hostBadgeDescription:t('演示身份：有接待经验、重视旅客体验的虚构房东。','Demonstration status: an experienced fictional host who cares about the guest experience.'),
  responseTime:t('通常在一小时内回复','Usually responds within an hour'),contactNote:t('可向房东询问抵达路线、公共设施和住宿规则。当前联系入口展示演示说明，尚不发送消息。','Ask about arrival directions, shared amenities and house rules. This contact panel is a demonstration; it does not send a message.'),
  neighborhood:t(`${place}是旅途中适合停留和补给的一站。客舱附近设有公共通道、旅客休息区和小型补给点。主通道较为热闹，休息区位于相对安静的一侧。\n\n下面的区域示意图展示住宿与周边入口的位置关系，地点和距离为虚构演示内容。`,`${place} is a place to pause and replenish supplies. Public corridors, a guest lounge and small supply points surround the cabin. The main walkway is busier; the rest area is on the quieter side.\n\nThe area sketch below shows the relationship between the stay and nearby stops. Locations and distances are fictional demonstration details.`),
  locationNote:t('虚构区域示意图 · 不对应现实坐标','Fictional area sketch · no real-world coordinates'),
  nearby:[
   {kind:'activities',title:t('寻找当地活动','Find things to do'),description:t('沿公共通道前往集合点，可查看本地区已发布的活动与旅行内容。','Follow the public walkway to the meeting point and browse published local activities.')},
   {kind:'cafe',title:t('试试附近的咖啡馆','Try a local café'),description:t('旅客休息区旁的饮品台提供热饮与短暂停留的位置。这是待完善的演示地点。','The drinks counter beside the guest lounge offers hot drinks and a place to pause. This is a demonstration location.')},
   {kind:'transit',title:t('查找公共交通','Find public transit'),description:t('主通道尽头为公共接驳站。班次与路线暂以现场公告为准，示意图不提供现实导航。','The public shuttle stop is at the end of the main walkway. See local notices for routes and departures; the sketch is not real-world navigation.')},
   {kind:'dining',title:t('探索附近餐饮','Explore dining'),description:t('补给点旁设有公共用餐区，可在继续行程前安排一顿简餐。','A shared dining area beside the supply point offers a stop for a simple meal before continuing your journey.')},
  ],
  cancellation:t('入住前 48 小时可免费取消（演示条款）。','Free cancellation up to 48 hours before arrival (demonstration policy).'),
  cancellationDetails:t('本示例规则允许在入住前 48 小时取消并退回全部虚构代币；此后取消则按一次住宿的示例费用计算。\n\n此处用于展示完整政策内容，不执行预订、扣款或退款。实际模拟预订规则会在相应阶段确定。','This example policy returns all fictional tokens when cancelled at least 48 hours before arrival. Later cancellations use an example charge of one night.\n\nThis is a policy demonstration and does not create reservations, charges or refunds. Simulation booking rules will be defined in their own development phase.'),
  checkIn:t('15:00–23:00','3:00 PM–11:00 PM'),checkOut:t('10:00 前','Before 10:00 AM'),
  houseRules:[t('公共区域请保持安静。','Keep shared areas quiet.'),t('使用共用设备后请清理个人物品。','Clear your belongings after using shared equipment.'),t('抵达前阅读客舱与公共区域说明。','Read the cabin and common-area instructions before arrival.')],
  safety:[{icon:'alarm',title:t('一氧化碳报警器未说明','Carbon monoxide alarm not reported'),description:t('演示资料暂未提供设备信息。','The demonstration does not include this equipment information.')},{icon:'alarm',title:t('烟雾报警器','Smoke alarm'),description:t('公共走廊设有演示报警设施。','Example alarm equipment is located in the shared corridor.')},{icon:'bath',title:t('共用区域','Shared areas'),description:t('浴室、洗衣区与公共通道由多位旅客使用。','Bathrooms, laundry and corridors are shared by multiple guests.')}],
 });
}
const visitors=[['旅客十七','Visitor 17','轨道中转站','Orbital transfer station'],['林间旅客','Woodland traveller','静默档案区','Quiet Archive'],['轮班休息者','Off-shift traveller','铸造区','Forge district'],['远行客','Wayfarer','外环居住区','Outer-ring quarters'],['档案读者','Archive reader','南侧港湾','South harbour'],['归途旅客','Homeward traveller','中转码头','Transfer docks']] as const;
const topics=[['位置','Location'],['清洁','Cleanliness'],['安静','Quiet'],['舒适','Comfort'],['性价比','Value'],['独自旅行','Solo travel'],['交通','Getting around'],['入住','Check-in'],['睡眠','Sleep quality'],['浴室','Bathroom']] as const;
export function stayDemoReview(locale:string,index:number) {
 const zh=locale==='zh-CN', v=visitors[index%visitors.length]!;
 const snippets=zh?[
  '客舱适合一个人落脚。行李放下后还能坐在桌边阅读，公共走廊里的其他旅客也很安静。',
  '公共洗漱区整洁，毛巾和洗漱用品容易找到。共用设施的位置都写在入住说明里。',
  '轮班之后终于有了可以休息的地方。房间灯光柔和，窗边的声音比主通道小很多。',
  '从接驳站走过来很方便，沿途有清楚的标记。初次到访也没有错过入口。',
  '一间简单实用的客舱，书桌与床分开使用很方便。公共冷藏柜需要标注自己的物品。',
  '自助入住顺利，临时停留一晚也能很快安顿下来。下次经过这里还会考虑再住。',
 ]:[
  'A useful place for one traveller to settle in. There was room to read at the desk after putting down my bag, and the other guests kept the corridor quiet.',
  'The shared washroom was tidy and towels were easy to find. The arrival guide clearly explained where to find each shared facility.',
  'A welcome place to rest after a shift. Soft lighting, with much less noise by the window than on the main walkway.',
  'Easy to reach from the shuttle stop, with clear signs along the way. I found the entrance without trouble on my first visit.',
  'A simple, practical cabin. It was useful to have a desk separate from the bed. Remember to label anything placed in the shared refrigerator.',
  'Self check-in was straightforward and I settled in quickly for a single night. I would consider staying here again on my next journey.',
 ];
 return {title:zh?`演示手记 ${index+1}`:`Demonstration note ${index+1}`,description:snippets[index%6]+(zh?'\n\n这是一条用于展示评论排版的虚构旅客手记。人物、旅程和评价均为创作占位，可由世界作者在后续版本中替换。':'\n\nThis fictional visitor note demonstrates the review layout. The traveller, journey and opinion are creative placeholders for the world’s author to replace.'),
  tags:topics.filter((_,i)=>i%3===index%3 || i===0 || i===1).map(pair=>pair[zh?0:1]),
  review:{name:v[zh?0:1],origin:v[zh?2:3],stayDuration:zh?(index%2?'住了几晚':'住了一晚'):(index%2?'Stayed a few nights':'Stayed one night')}
 };
}
