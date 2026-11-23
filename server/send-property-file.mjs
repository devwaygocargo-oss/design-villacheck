import {Readable} from 'node:stream';import {pipeline} from 'node:stream/promises';import {mediaRange} from './media-range.mjs';
export async function sendPropertyFile(file,req,res){
 const bytes=Buffer.from(file.bytes),range=mediaRange(req.headers.range,bytes.length),headers={'Content-Type':file.mime,'Cache-Control':'private, no-store','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff'};
 if(range?.invalid){res.writeHead(416,{...headers,'Content-Range':'bytes */'+bytes.length});return res.end()}
 res.writeHead(range?206:200,{...headers,...(range?{'Content-Range':`bytes ${range.start}-${range.end}/${bytes.length}`}:{})});res.flushHeaders();const data=range?bytes.subarray(range.start,range.end+1):bytes;
 try{return await pipeline(Readable.from((function*(){for(let offset=0;offset<data.length;offset+=64*1024)yield data.subarray(offset,offset+64*1024)})()),res)}catch(error){if((req.aborted||res.destroyed)&&['ERR_STREAM_PREMATURE_CLOSE','ECONNRESET'].includes(error.code))return;throw error;}
}
