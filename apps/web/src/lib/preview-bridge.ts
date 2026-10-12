// Only loaded by the authenticated draft preview route.
const query = new URLSearchParams(location.search);
const nonce = query.get('bridge');
if (nonce && window.parent !== window) {
  const context = { type:'plotstay:preview', nonce, contentId:location.pathname.split('/').at(-1), revisionId:query.get('revisionId') };
  const send = (action:string, section?:string) => window.parent.postMessage({...context,action,section},location.origin);
  const selectors = ['[data-stay-module]','[data-experience-module]','[data-service-module]'];
  const modules = [...document.querySelectorAll<HTMLElement>(selectors.join(','))];
  const style=document.createElement('style');style.textContent='[data-stay-module],[data-experience-module],[data-service-module]{cursor:pointer}[data-stay-module]:hover,[data-experience-module]:hover,[data-service-module]:hover{outline:3px solid #9ed34a;outline-offset:3px}';document.head.append(style);
  for(const module of modules){module.setAttribute('tabindex','0');module.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();send('select',module.id||module.querySelector('[id]')?.id||module.dataset.stayModule||module.dataset.experienceModule||module.dataset.serviceModule);});module.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();send('select',module.id||module.querySelector('[id]')?.id||module.dataset.stayModule||module.dataset.experienceModule||module.dataset.serviceModule);}});}
  send('ready');
}
