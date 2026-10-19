from pathlib import Path
import re,json
out={}
for p in [*Path('copy/pages').glob('*.md'),Path('copy/shared/platform-notices.md'),Path('copy/shared/detail.md'),Path('copy/voice/isidorrus.md')]:
 for m in re.finditer(r'^#{2,3} ([a-z][\w.-]+)\s*\n(.*?)(?=^#{1,3} |\Z)',p.read_text(),re.M|re.S):
  key,b=m.groups(); zh=re.search(r'^(?:- )?中文：(.+)',b,re.M); en=re.search(r'^英文：(.+)',b,re.M)
  if not en:
   en=re.search(r'^([A-Za-z—][^\n]*[A-Za-z.!?→}][^\n]*)$',b,re.M)
  if zh and en: out[key]={'zh-CN':zh[1].strip(),'en':en[1].strip()}

# Table entries use their stable IDs. Historical candidate tables are excluded.
for line in Path('copy/pages/receipt.md').read_text().splitlines():
 parts=[part.strip() for part in line.split('|')]
 if len(parts)==5 and parts[1].startswith('receipt.'):
  out[parts[1]]={'zh-CN':parts[2],'en':parts[3]}
nav=Path('copy/shared/navigation.md').read_text()
for line in nav.split('## 搜索、筛选与分页')[1].splitlines():
 parts=[part.strip() for part in line.split('|')]
 if len(parts)==4 and parts[1] not in ('中文','---'):
  out['functional.'+parts[2]]={'zh-CN':parts[1],'en':parts[2]}
def add(key,zh,en): out[key]={'zh-CN':zh,'en':en}
add('directory.count','共收录 {total} 条记录','{total} entries on record')
add('directory.count-one','共收录 1 条记录','1 entry on record')
add('navigation.search-label','您计划前往的目的地','Your Planned Destination')
add('navigation.empty','本目录尚无可供查阅的条目。\n谨向我亲爱的同僚们说明：目录空白，不代表此地没有值得访问之处。请向当地可信赖的单位咨询。','No entries are currently available in this directory.\nFor the benefit of my esteemed colleagues: the absence of entries does not imply an absence of places worth visiting. Please consult trusted local units.')
add('navigation.no-results','本目录中，暂无符合您所选条件的条目。您不妨放宽一两项条件。毕竟，这是出行偏好，并非神圣誓约。','No entries match your selected criteria. You may wish to relax a condition or two. These are travel preferences, after all, not sacred vows.')
add('navigation.not-found','未找到此页面。请核对地址，或返回旅行服务台。\n我们尊敬的帝国行政部同僚自有一套档案。但本处档案，并不由他们保管。','Page not found. Please check the address or return to the travel desk.\nOur esteemed colleagues in the Administratum maintain their own records. They do not, however, maintain ours.')
add('navigation.unavailable','暂时无法调阅这份资料，请稍后重试。\n与机魂沟通须遵循正确的仪式。目前正在核对仪式次序。\n档案库偶有迟滞，您的休假不应如此。','This record cannot be retrieved at present. Please try again shortly.\nThe machine-spirit must be approached with the proper rites. The order of those rites is currently being checked.\nArchives may be delayed. Your leave should not be.')
add('navigation.ui-fallback','界面暂以英语显示，相应译文尚未归档。译文所需的手续，比预想中略多一些。','The interface is currently displayed in English. The corresponding translation is not yet in the archive. The translation has encountered more paperwork than anticipated.')
add('navigation.date-order','退房日期须晚于入住日期。即便考虑到亚空间航行中的时间偏差，本表仍须依此次序填写。','Checkout must be later than check-in. Even allowing for temporal discrepancies in warp travel, this form must be completed in that order.')
add('navigation.search-note','日期与数量仅用于记录您的行程偏好，搜索暂不核查可用余量。','Dates and quantities record your trip preferences only. Search does not currently check availability.')
add('navigation.content-fallback','此内容暂以原文展示。','This content is currently shown in its original language.')
# Every generated string must occur in the reviewed library (line breaks may be prose paragraphs).
all_text='\n'.join(p.read_text() for p in Path('copy').rglob('*.md'))
for key,pair in out.items():
 for text in pair.values():
  for line in text.splitlines():
   assert line in all_text, (key,line)
Path('apps/web/src/lib/travel-copy.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(f'Exported {len(out)} approved bilingual entries')
