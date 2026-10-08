import { pathToFileURL } from 'node:url';
import { createDatabase, type Database } from '@plotstay/database';
import { createContentSchema } from '@plotstay/contracts';
import { createContent, submitRevision, reviewRevision, type Actor } from '@plotstay/domain';

const reviews = [
 ['林栖','Lin Qi','轨道港','Orbital Harbour','炉火旁的小故事','Stories by the furnace','原本以为只是沿着步道看看机器，没想到向导连换班铃的不同节奏都能讲出故事。观察窗边留的时间很充裕，第一次来拉斯也完全跟得上。','I expected a quick look at some machinery, but our guide even had stories about the different shift bells. We had plenty of time at the viewing windows, and it was easy to follow on my first visit to Lathe.','向导讲解','Local stories',5],
 ['米拉','Mira','测试港湾','Test Harbour','真的带走了一枚小齿轮','A little gear to take home','我完全不懂机械，向导还是耐心陪我对齐了每一道刻度。教学工作台和生产区分得很清楚，做完还能带走自己的小齿轮，比单纯参观更有参与感。','I know nothing about mechanics, but the guide patiently helped me line up every mark. The teaching bench was clearly separated from the production area. Leaving with my own little gear made this much more memorable than simply watching.','动手体验','Hands-on activity',5],
 ['旅客十七','Visitor 17','上层档案区','Upper Archive Quarter','慢慢走，也能看见很多','An unhurried way to see the quarter','休息室的热饮很贴心，整条路线没有赶时间。炉区附近还是有些嘈杂，怕吵的旅客可以提前问问安静时段。除此以外，集合说明和实际路线都很清楚。','The warm drink in the lounge was a nice touch, and we never felt rushed. It was a little noisy near the furnaces, so sound-sensitive visitors may want to ask about quieter sessions. The meeting instructions and route were otherwise very clear.','从容节奏','Relaxed pace',4],
 ['阿澈','Aster','南侧接驳站','South Shuttle Station','观察窗边值得多停一会儿','Stay a little longer at the window','最喜欢上层观察窗，可以同时看到货船和铸造大厅的灯。向导主动留出拍照时间，还告诉我们哪些地方不适合停留。第一次来的人也很容易找到集合点。','The upper window was my favourite stop, with freighters and the foundry lights in the same view. Our guide left time for photos and explained where we should keep moving. The meeting point was easy to find for a first-time visitor.','集合方便','Easy meeting point',5],
 ['诺娅','Noa','远行者居住舱','Wayfarer Quarters','问题再小，也有人认真回答','Every question had room','我一路问了很多很基础的问题，向导都认真解释，没有把大家当成已经懂行的人。最后围坐看旧手册的部分很喜欢，感觉认识了一点这个世界的日常。','I asked plenty of very basic questions, and the guide answered each one without assuming we were experts. Looking through the old manuals together at the end gave me a small glimpse of everyday life in this world.','耐心沟通','Patient guidance',5],
 ['伊文','Iven','东侧货运环','East Freight Ring','一个刚刚好的下午','An afternoon well spent','步行、动手和聊天的比例刚刚好，两个人一起参加也不会尴尬。工具和护目镜都准备好了，结束时收到路线明信片，回去还能顺着回想每个停靠点。','There was a lovely balance of walking, making and chatting, and it felt comfortable joining as a pair. Tools and goggles were ready for us. The route postcard at the end helped us remember every stop on the way home.','动手体验','Hands-on activity',5],
] as const;

// Explicit, repeatable append of six authorised fictional reviews to one published experience.
export async function seedExperienceReviews(db:Database,actor:Actor,apply=false){
 const guard=await db.connect();await guard.query('SELECT pg_advisory_lock(184570926)');
 try{
  const {rows:[parent]}=await db.query(`SELECT c.id,c.world_id FROM contents c JOIN worlds w ON w.id=c.world_id
   WHERE w.slug='lathe-worlds' AND c.slug='forge-walk' AND c.kind='experience' AND c.published_publication_id IS NOT NULL
   AND w.visible AND NOT w.site_blocked AND NOT c.site_blocked`);
  if(!parent)return {status:'skipped: sample is not published',added:0};
  let added=0,planned=0;
  for(const [i,row]of reviews.entries()){
   const slug=`experience-demo-${parent.id}-${i+1}`;
   if((await db.query('SELECT id FROM contents WHERE world_id=$1 AND slug=$2 AND kind=\'review\'',[parent.world_id,slug])).rowCount)continue;
   planned++;if(!apply)continue;
   const [zn,en,zo,eo,zt,et,zd,ed,zTag,eTag,rating]=row;
   const body=(zh:boolean)=>({title:zh?zt:et,description:zh?zd:ed,tags:[zh?zTag:eTag],review:{name:zh?zn:en,origin:zh?zo:eo,stayDuration:zh?'参加了 90 分钟体验':'Joined the 90-minute experience'}});
   const note=await createContent(db,actor,createContentSchema.parse({worldId:parent.world_id,kind:'review',slug,parentContentId:parent.id,sourceLocale:'en',text:body(false),translations:{'zh-CN':body(true)},attributes:{rating,reviewRatings:{accuracy:5,communication:5,value:rating}}}));
   await submitRevision(db,actor,note.id,note.revisionId);
   await reviewRevision(db,actor,note.id,note.revisionId,'publish','User-authorised fictional experience reviews for layout demonstration.');added++;
  }
  return {status:apply?'complete':'preview',planned,added};
 }finally{await guard.query('SELECT pg_advisory_unlock(184570926)');guard.release();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const db=createDatabase();try{const {rows:[actor]}=await db.query(`SELECT id,email,site_role AS "siteRole" FROM users WHERE active AND site_role='admin' ORDER BY created_at,id LIMIT 1`);if(!actor)throw new Error('A site administrator is required.');console.log(JSON.stringify(await seedExperienceReviews(db,actor,process.argv.includes('--apply')),null,2));}finally{await db.end();}}
