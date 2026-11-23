import {englishSystemText,thaiSystemText} from './systemTranslations';
import {getLocale,setLocale,useUiLanguage,translateUi} from './uiLanguage';
export {getLocale,setLocale,localeStorageKey} from './uiLanguage';
export type Locale='th'|'en';export type TranslationValues=Record<string,string|number>;
export function localeTag(locale:Locale=getLocale()){return locale==='en'?'en-GB':'th-TH'}
export function tr(locale:Locale,key:string,values:TranslationValues={}){const current=translateUi(key,locale);const text=current!==key?current:locale==='en'?(englishSystemText[key]??key):(thaiSystemText[key]??key);return text.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g,(whole,name)=>Object.prototype.hasOwnProperty.call(values,name)?String(values[name]):whole)}
export function t(key:string,values:TranslationValues={}){return tr(getLocale(),key,values)}
export function useLocale(){const {locale}=useUiLanguage();return {locale,setLocale,t:(key:string,values:TranslationValues={})=>tr(locale,key,values)}}
export function formatDate(value:string|number|Date|null|undefined,options:Intl.DateTimeFormatOptions={}){if(value===null||value===undefined||value==='')return t('ไม่ระบุ');const date=value instanceof Date?value:new Date(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value+'T00:00:00+07:00':value);if(!Number.isFinite(date.getTime()))return t('ไม่ระบุ');return new Intl.DateTimeFormat(localeTag(),{timeZone:'Asia/Bangkok',...(!options.dateStyle&&!options.timeStyle?{day:'numeric',month:'short',year:'numeric'}:{}),...options}).format(date)}
export function formatNumber(value:number,options:Intl.NumberFormatOptions={}){return new Intl.NumberFormat(localeTag(),options).format(value)}
export function formatCurrency(value:number,currency='THB',options:Intl.NumberFormatOptions={}){return formatNumber(value,{style:'currency',currency,...options})}
