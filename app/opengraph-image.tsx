import {ImageResponse} from "next/og";
export const runtime="nodejs";
export const alt="VillaCheck — check property information before paying";
export const size={width:1200,height:630};
export const contentType="image/png";
export default function Image(){return new ImageResponse(<div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",justifyContent:"center",padding:"90px",background:"#082e58",color:"white",fontFamily:"sans-serif"}}><div style={{display:"flex",fontSize:100,fontWeight:700}}>Villa<span style={{color:"#00b8d4"}}>Check</span></div><div style={{display:"flex",fontSize:39,marginTop:35}}>Check property information before paying.</div><div style={{display:"flex",fontSize:25,marginTop:28,color:"#bcd7e9"}}>Property registration · Verification status · QR reference</div></div>,size);}
