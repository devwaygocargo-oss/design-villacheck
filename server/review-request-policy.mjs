export function reviewRequestAllowed(method,path){
 if(['GET','HEAD'].includes(method)&&/^\/api\/public\/review-media\/[a-f0-9-]{36}$/.test(path))return true
 if(method==='GET'&&['/api/reviews','/api/merchant/reviews','/api/admin/reviews'].includes(path))return true
 return method==='POST'&&(['/api/reviews','/api/reviews/media'].includes(path)||/^\/api\/(?:reviews\/[a-f0-9-]{36}\/appeal|merchant\/reviews\/[a-f0-9-]{36}\/reply|admin\/reviews\/[a-f0-9-]{36}\/moderate)$/.test(path))
}
export function assertReviewRole(user,method,path){
 if(!reviewRequestAllowed(method,path))return false
 const role=path.startsWith('/api/admin/')?'admin':path.startsWith('/api/merchant/')?'merchant':'user'
 if(user?.role!==role)throw Object.assign(Error('ไม่มีสิทธิ์ดำเนินการ'),{status:403})
 return true
}
