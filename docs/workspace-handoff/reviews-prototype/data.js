/* Synthetic, browser-memory-only fixtures. No account data or network access. */
window.reviewFixtures = (() => {
  const pair=(zh,en)=>({zh,en});
  const personas=[
    {id:'lin',name:pair('林舟','Lin Zhou'),color:'mint'},
    {id:'mira',name:pair('米拉','Mira Ashford'),color:'amber'},
    {id:'ren',name:pair('任 · 北境远行者与群岛信使','Ren of the Northern Archives and the Faraway Islands'),color:'violet'},
    {id:'old',name:pair('旧港守灯人','Former Harbour Keeper'),color:'sky',disabled:true},
  ];
  const worlds={harbour:pair('雾港群岛','Mist Harbour Isles'),grove:pair('银叶林地','Silverleaf Grove')};
  const entries=[
    {id:'lantern',world:'harbour',kind:'stay',title:pair('潮汐灯塔客房','The Tidal Lighthouse Guestroom')},
    {id:'walk',world:'grove',kind:'experience',title:pair('沿着银叶河的夜行','A Night Walk beside the Silverleaf River')},
    {id:'repair',world:'harbour',kind:'service',title:pair('旧港罗盘修复室','The Old Harbour Compass Workshop')},
    {id:'library',world:'grove',kind:'stay',title:pair('林间图书馆的阁楼','The Attic above the Woodland Library')},
    {id:'ferry',world:'harbour',kind:'experience',title:pair('群岛晨雾渡行','Crossing the Islands in the Morning Mist')},
    {id:'maps',world:'grove',kind:'service',title:pair('远行者手绘地图咨询','Hand-drawn Map Advice for Long-distance Travellers')},
    {id:'cabin',world:'grove',kind:'stay',title:pair('雨声小屋','The Rainfall Cabin')},
    {id:'weave',world:'grove',kind:'service',title:pair('银线织补工坊','The Silver Thread Mending Studio')},
  ];
  const stories=[
    [pair('在退潮声里醒来','Waking up to the sound of the ebbing tide'),pair('窗边的小桌正好能摊开海图。晚上风很大，但房间里安静，守灯人还为晚归的旅人留了一盏灯。\n\n通往码头的石阶雨后有些滑，若能在出发前提醒一下就更好了。下次还想在这里多住一晚。','The little desk by the window had just enough room for my sea chart. The wind rose after dark, but the room stayed quiet. The keeper left a lamp burning for travellers returning late.\n\nThe stone steps to the quay were slippery after the rain. A reminder before setting out would have helped. Next time, I would like to stay an extra night.')],
    [pair('走慢一点，才能听见森林','Walk slowly enough to hear the forest'),pair('向导让我们在桥边停了一会儿，听河水从树根之间穿过。路线没有赶时间，夜间也能辨认路标。\n\n建议带一件防风外衣，最后一段河岸比想象中凉。','Our guide paused beside the bridge so we could hear the river moving between the roots. We never felt hurried, and the trail markers were visible after dark.\n\nBring a windproof layer. The final stretch beside the water was cooler than I expected.')],
    [pair('让老罗盘重新指向北方','An old compass finds north again'),pair('米拉先解释了指针偏移的原因，再把每一步修复展示给我看。修好的罗盘没有失去旧痕迹，这正是我希望保留的部分。\n\n等待比约定稍长，不过离开前的校准说明很清楚。','Mira explained why the needle had drifted before showing me each step of the repair. The restored compass kept its old marks, which was exactly what I wanted.\n\nThe wait ran a little longer than expected, but the calibration instructions were clear.')],
    [pair('书页与屋檐之间','Between the books and the eaves'),pair('阁楼的灯光适合读书。楼梯较窄，带大行李时可以先请主人帮忙。','The attic light was lovely for reading. The stairs are narrow, so ask the host for help if you have a large bag.')],
    [pair('雾散时看见了整个海湾','The bay appeared as the mist lifted'),pair('船行得很稳，领航员讲了每座小岛名字的来历。回程时大家安静地看着天色变亮。','The boat moved steadily while the navigator explained the names of the islands. On the way back, we quietly watched the sky grow brighter.')],
    [pair('一张会跟着人走的地图','A map that follows the traveller'),pair('路线考虑了我的步行速度，也标出了可以避雨的小亭。不是最短的路，却是一条愿意慢慢走完的路。','The route allowed for my walking pace and marked small shelters along the way. It was not the shortest path, but it was one I wanted to take slowly.')],
    [pair('雨停之前不急着离开','No hurry to leave before the rain stops'),pair('屋里有干燥的柴火和一小壶茶。连着下雨的两天，刚好把随身的书读完了。','There was dry firewood and a little pot of tea. Two days of rain gave me just enough time to finish my book.')],
    [pair('旧围巾又能陪我远行','My old scarf can travel with me again'),pair('补线的颜色保留了旧围巾的层次，接缝也很柔软。工坊解释了日后的清洗方式。','The new thread respected the old colours, and the seam felt soft. The workshop also explained how to wash it afterwards.')],
  ];
  const response=pair('谢谢你认真写下这段旅程。石阶的提醒已经补进出行说明，也会在下雨时当面告知。那盏灯会继续为晚归的客人留着。','Thank you for sharing this part of your journey. We have added a note about the steps to our arrival advice and will mention it in person when it rains. We will keep the lamp lit for late arrivals.');
  const replies=[response,pair('谢谢你的建议。下次出发前，我会提醒大家准备防风外衣。很高兴那一小段静听的时间也留在了你的记忆里。','Thank you for the suggestion. I will remind the group to bring a windproof layer before our next walk. I am glad you remember that quiet pause by the river.'),pair('谢谢你愿意把这枚罗盘交给我。旧痕迹也是它的一部分；下次指针需要校准时，欢迎再带回来。','Thank you for trusting me with the compass. Its old marks are part of its story. Bring it back whenever the needle needs another calibration.')];
  replies.push(
    pair('谢谢你提到楼梯。我们会在到达前提醒携带大行李的客人，并安排在门口接应。希望阁楼里的那本书也陪你度过了一个安静的夜晚。','Thank you for mentioning the stairs. We will advise guests with large bags before arrival and offer to meet them at the door. I hope the book in the attic kept you good company.'),
    pair('很高兴与你分享岛屿名字的故事。每次穿过晨雾，海湾都像第一次见到时一样。','It was a pleasure to share the stories behind the island names. Each crossing through the morning mist makes the bay feel new again.'),
    pair('那几座小亭确实适合在雨里歇脚。愿这张地图陪你找到属于自己的步调。','Those little shelters are good places to pause in the rain. I hope the map helps you find your own pace.'),
    pair('谢谢你把雨天留在这间小屋的记忆里。下一次来时，炉边仍会有茶。','Thank you for making the rainy days part of this cabin’s story. There will be tea by the fire next time, too.'),
    pair('围巾上的旧颜色值得留下。祝它继续陪你走过许多地方。','The scarf’s old colours deserved to stay. May it accompany you to many more places.')
  );
  const version=(id,text,title,at)=>({id,text:structuredClone(text),title:structuredClone(title),at,sourceLocale:'zh',rating:4,origin:pair('北岸驿站','North Shore Post'),journey:pair('沿海慢行三日','Three days along the coast'),tags:pair('安静, 海风','Quiet, Sea breeze'),ratings:{accuracy:4,communication:5,value:4}});
  const records=[];
  function make(id,side,i,own,state,day){
    const [title,text]=stories[i]; const at=`2026-10-${String(day).padStart(2,'0')}T09:20:00+09:00`;
    const record={id,side,entry:entries[i].id,own,author:side==='reviews'?personas.find(p=>p.id===own).name:pair(['夏苇','陆岚','苏棠','江遥'][i%4],['Wren Xia','Rowan Lu','Tansy Su','River Jiang'][i%4]),provider:side==='replies'?personas.find(p=>p.id===own).name:pair('禾川','Hector River'),review:version(id+'-review',text,title,at),P:null,A:null,B:null,rejected:null,readonly:false,event:{label:pair('评价已公开','Review published'),at},replyPublic:null};
    const content=side==='reviews'?text:replies[i];
    if(side==='reviews')record.replyPublic=version(id+'-reply',replies[i],pair('',''),at);
    if(state!=='draft'&&state!=='rejected'&&state!=='none')record.P=version(id+'-P',content,title,at);
    if(['pab','pending'].includes(state))record.A=version(id+'-A',pair(content.zh+'\n补充：出发前可以先确认路线。',content.en+'\nAn additional thought: check the route before setting out.'),title,at);
    if(['pab','draft','rejected'].includes(state))record.B=version(id+'-B',pair(content.zh+'\n还想补充一些细节。',content.en+'\nI would like to add a few more details.'),title,at);
    if(state==='none'){record.event.label=pair('收到公开评价','Review received');record.replyPublic=null;}
    if(state==='pab')record.event.label=pair('你暂存了新的修改','You saved a new draft');
    if(state==='draft')record.event.label=pair('你暂存了草稿','You saved a draft');
    if(state==='pending')record.event.label=pair('你提交了审核','You submitted a version');
    if(state==='rejected'){record.rejected={id:record.B.id,note:pair('请写清楚体验细节，避免将个人感受写成对所有来访者的保证。','Please describe the experience without turning personal impressions into a promise for every visitor.')};record.event.label=pair('审核退回了此版本','This version was returned');}
    if(state==='history'){record.readonly=true;record.event.label=pair('你的提供者绑定已结束','Your provider assignment ended');}
    if(side==='reviews'&&state==='public')record.event.label=pair('提供者更新了公开回复','Provider updated the public reply');
    if(side==='reviews'&&!record.P)record.replyPublic=null;
    records.push(record);
  }
  make('r1','reviews',0,'lin','public',13);make('r2','reviews',1,'mira','pab',12);make('r3','reviews',2,'ren','rejected',11);
  make('r4','reviews',3,'lin','draft',10);make('r5','reviews',4,'mira','pending',9);make('r6','reviews',5,'ren','public',8);make('r7','reviews',6,'old','history',7);
  make('s1','replies',2,'mira','none',13);make('s2','replies',0,'ren','draft',12);make('s3','replies',1,'old','history',11);
  make('s4','replies',3,'ren','pab',10);make('s5','replies',4,'lin','rejected',9);make('s6','replies',5,'mira','pending',8);make('s7','replies',6,'ren','public',7);
  const currentProviders={lantern:personas[2].name,walk:pair('禾川','Hector River'),repair:personas[1].name,library:personas[2].name,ferry:personas[0].name,maps:personas[1].name,cabin:personas[2].name};
  for(const r of records)if(r.side==='reviews')r.provider=structuredClone(currentProviders[r.entry]);
  // A public reply only addresses the public review; it never follows a private draft.
  records.find(r=>r.id==='r6').P.rating=null;
  records.find(r=>r.id==='r7').restricted=true;
  return {personas,worlds,entries,records};
})();
