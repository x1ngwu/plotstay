// Technical spike: messages select sections only. They never save or publish.
window.createPreviewBridge=function({frame,origin,session,revision,onSelect}) {
 const valid=new Set(['basics','gallery','description','amenities','price','provider','rules']);
 const listener=event=>{
  const d=event.data;
  if(event.origin!==origin||event.source!==frame.contentWindow||!d||d.channel!=='plotstay-preview-v1'||d.session!==session||d.revision!==revision||d.type!=='select'||!valid.has(d.section))return;
  onSelect(d.section);
 };
 window.addEventListener('message',listener);
 return {
  select(section){if(valid.has(section))frame.contentWindow?.postMessage({channel:'plotstay-preview-v1',type:'focus',session,revision,section},origin);},
  destroy(){window.removeEventListener('message',listener);}
 };
};
