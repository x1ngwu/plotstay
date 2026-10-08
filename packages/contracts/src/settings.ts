import {z} from 'zod';
import {detailCopyDefaults} from './detail-copy-defaults.ts';
export {detailCopyDefaults};
const text=z.string().trim().min(1).max(20000);
export const sharedWorldSchema=z.record(z.string(),z.object({name:text,description:z.string().max(20000),currencyName:text}).strict());
export const sharedPlaceSchema=z.record(z.string(),text);
export const sharedPersonaSchema=z.record(z.string(),z.object({name:text,bio:z.string().max(6000).default('')}).strict());
export const copySchema=z.record(z.string(),z.record(z.string(),z.string().max(3000))).superRefine((body,ctx)=>{
 for(const [locale,values]of Object.entries(body)){
  for(const [key,value]of Object.entries(values)){
   const ref=detailCopyDefaults[key];
   if(!ref){ctx.addIssue({code:'custom',message:'Unknown copy key',path:[locale,key]});continue;}
   if(!value && ref[locale as 'en'|'zh-CN'] !== '')ctx.addIssue({code:'custom',message:'Required copy cannot be empty',path:[locale,key]});
   const expected=[...ref.en.matchAll(/\{([a-zA-Z]+)\}/g)].map(m=>m[1]).sort();
   const actual=[...value.matchAll(/\{([^{}]+)\}/g)].map(m=>m[1]).sort();
   if(JSON.stringify(expected)!==JSON.stringify(actual)||/<[^>]*>/.test(value)||/[{}]/.test(value.replace(/\{[a-zA-Z]+\}/g,'')))ctx.addIssue({code:'custom',message:'Only registered placeholders and plain text are allowed',path:[locale,key]});
  }
  for(const key of Object.keys(detailCopyDefaults))if(!Object.hasOwn(values,key))ctx.addIssue({code:'custom',message:'Required copy is missing',path:[locale,key]});
 }
});
export function initialDetailCopy(){return Object.fromEntries(['en','zh-CN'].map(locale=>[locale,Object.fromEntries(Object.entries(detailCopyDefaults).map(([key,values])=>[key,values[locale as 'en'|'zh-CN']]))]));}
export function settingsSchema(kind:string){return kind==='copy'?copySchema:kind==='world'?sharedWorldSchema:kind==='place'?sharedPlaceSchema:sharedPersonaSchema;}

// Compatibility for older configuration snapshots when new registered keys are introduced.
// This is a read projection; the historical body is never rewritten.
export function completeDetailCopy(body:Record<string,Record<string,string>>){
 const initial=initialDetailCopy();return Object.fromEntries(Object.keys(body).map(locale=>[locale,{...initial[locale],...body[locale]}]));
}
