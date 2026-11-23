// datetime-local inputs represent Bangkok wall time, independent of the browser TZ.
export function bangkokLocalToUtc(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('กรอกวันเวลาไทยให้ครบ / Enter Bangkok date and time');
 const ms=Date.parse(value+':00.000+07:00');
 if(!Number.isFinite(ms)||new Date(ms+7*3600000).toISOString().slice(0,16)!==value)throw Error('วันเวลาไทยไม่ถูกต้อง / Invalid Bangkok date and time');
 return new Date(ms).toISOString();
}
