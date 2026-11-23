export function youtubeVideoId(value){
 if(typeof value!=='string'||value.length>2048)return null;
 try{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.port)return null;const host=url.hostname.toLowerCase();let id;if(host==='youtu.be')id=url.pathname.split('/')[1];else if(['youtube.com','www.youtube.com','m.youtube.com','www.youtube-nocookie.com','youtube-nocookie.com'].includes(host)){const parts=url.pathname.split('/').filter(Boolean);if(parts[0]==='watch')id=url.searchParams.get('v');else if(['embed','shorts','live'].includes(parts[0]))id=parts[1]}return typeof id==='string'&&/^[A-Za-z0-9_-]{11}$/.test(id)?id:null}catch{return null}
}
