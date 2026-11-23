export async function merchantQrScanCounts(db,ownerId,now=Date.now()){
 const since=new Date(now-30*86400000).toISOString();
 const rows=await db.prepare("SELECT e.villa_id,count(*) AS total,sum(CASE WHEN e.created>=? THEN 1 ELSE 0 END) AS recent FROM villa_events e JOIN villas v ON v.id=e.villa_id WHERE v.owner_id=? AND e.kind='QR_SCAN' GROUP BY e.villa_id").all(since,ownerId);
 return new Map(rows.map(row=>[row.villa_id,{total:Number(row.total),last30Days:Number(row.recent)}]));
}
