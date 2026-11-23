import {useEffect,useRef} from "react";
import {useUiLanguage} from "./uiLanguage";
type Field=HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement;
export default function LocaleValidation(){
 const {locale}=useUiLanguage(),owned=useRef(new Map<Field,string>());
 useEffect(()=>{
  const fields=owned.current;
  const field=(target:EventTarget|null):target is Field=>target instanceof HTMLInputElement||target instanceof HTMLSelectElement||target instanceof HTMLTextAreaElement;
  const localize=(input:Field)=>{
   const previous=fields.get(input);
   // Preserve validation supplied by domain components, such as property selection.
   if(input.validity.customError&&(!previous||input.validationMessage!==previous)){fields.delete(input);return;}
   if(previous){input.setCustomValidity("");fields.delete(input);}
   const v=input.validity;if(v.valid||!input.willValidate)return;
   const key=v.valueMissing?"required":v.typeMismatch?"type":v.patternMismatch?"pattern":v.tooShort||v.tooLong?"length":v.rangeUnderflow||v.rangeOverflow||v.stepMismatch?"range":"invalid";
   const messages={required:["กรุณากรอกข้อมูลในช่องนี้","Please complete this field."],type:["กรุณากรอกข้อมูลให้ถูกประเภท เช่น อีเมลหรือที่อยู่เว็บไซต์","Enter a valid value, such as an email address or website URL."],pattern:["กรุณากรอกข้อมูลตามรูปแบบที่กำหนด","Use the required format for this field."],length:["ความยาวข้อความไม่ตรงตามที่กำหนด","Use the permitted text length."],range:["กรุณากรอกค่าภายในช่วงที่กำหนด","Enter a value within the permitted range."],invalid:["กรุณาตรวจสอบข้อมูลในช่องนี้","Check the value in this field."]};
   const message=messages[key][locale==="en"?1:0];input.setCustomValidity(message);fields.set(input,message);
  };
  for(const input of [...fields.keys()]){if(input.isConnected)localize(input);else fields.delete(input);}
  const invalid=(event:Event)=>{if(field(event.target))localize(event.target);};
  const clear=(event:Event)=>{if(field(event.target)){const previous=fields.get(event.target);if(previous&&event.target.validationMessage===previous)event.target.setCustomValidity("");fields.delete(event.target);}};
  document.addEventListener("invalid",invalid,true);document.addEventListener("input",clear,true);document.addEventListener("change",clear,true);
  return()=>{document.removeEventListener("invalid",invalid,true);document.removeEventListener("input",clear,true);document.removeEventListener("change",clear,true);};
 },[locale]);
 return null;
}
