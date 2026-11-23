import type {CmsArticle,CmsBlock} from "./cms";
import {translateUi} from "./uiLanguage";

export function localizeArticle(article:CmsArticle,locale:string):CmsArticle {
  if(locale!=="en")return article;
  const text=Object.fromEntries((["title","description","alt","detailAlt"] as const)
    .filter(key=>article.en?.[key]?.trim()).map(key=>[key,article.en![key]]));
  return {...article,...text,image:article.en?.image||"",detailImage:article.en?.detailImage||""};
}

// Project legacy body/detail fields into the ordered editor without writing live data.
export function articleContentBlocks(article:CmsArticle,locale:string):CmsBlock[] {
  const english=locale==="en",en=article.en;
  const rows=english?(en?.blocks??(article.blocks||[]).map(block=>({...block,image:"",
    title:translateUi(block.title,"en"),body:translateUi(block.body,"en"),
    alt:translateUi(block.alt,"en"),label:translateUi(block.label,"en")}))):(article.blocks||[]);
  const body=english?(en?.body||(en?.blocks===undefined?translateUi(article.body,"en"):"")):article.body;
  const image=english?en?.detailImage:article.detailImage;
  const used=new Set(rows.map(row=>row.id));
  const legacy=(kind:string):CmsBlock=>{let id="legacy-"+kind;for(let i=1;used.has(id);i++)id="legacy-"+kind+"-"+i;used.add(id);return{id,type:"text",visible:true,title:"",body:"",image:"",alt:"",label:"",href:""};};
  return [...(image?[{...legacy("detail"),type:"image" as const,image,alt:(english?en?.detailAlt:article.detailAlt)||""}]:[]),
    ...(body?[{...legacy("body"),body}]:[]),...rows];
}

// Keep legacy text blocks with images editable and expose the same three
// content-image positions in each language without sharing their image URLs.
export function articleEditorBlocks(article:CmsArticle,locale:string):CmsBlock[] {
  const thai=articleContentBlocks(article,"th");
  const imageIds=thai.filter(row=>row.image||row.type==="image").map(row=>row.id);
  const rows=articleContentBlocks(article,locale).map(row=>({...row,
    type:(row.image||row.type==="image"||imageIds.includes(row.id)?"image":row.type) as CmsBlock["type"]}));
  const used=new Set(rows.map(row=>row.id));
  let count=rows.filter(row=>row.type==="image").length;
  while(count<3){
    if(rows.length>=42){const existing=rows.find(row=>row.type==="text");if(!existing)break;existing.type="image";count++;continue;}
    let id="content-image-"+(count+1);while(used.has(id))id+="-new";used.add(id);
    const row:CmsBlock={id,type:"image",visible:true,title:"",body:"",image:"",alt:"",label:"",href:""};
    if(count===2)rows.unshift(row);else rows.push(row);
    count++;
  }
  return rows;
}
