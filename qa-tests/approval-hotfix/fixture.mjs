import {randomUUID} from 'node:crypto';
import {merchantFixture} from '../closure/helpers/merchant-test-fixture.mjs';
import {prepareVillaTrial} from '../../server/villa-free-trial.mjs';
export async function approvalFixture(overrides={}){
 const f=await merchantFixture({productionReleaseMode:'PHASE1_PUBLIC',propertyMediaWorkflowEnabled:true,phase1RequirementsRevision:'SYNTHETIC_LOCAL_FIXTURE',phase1ActivationMode:'BLOCKED',phase1EmailOtpDelivery:'SMTP',phase1EmailOtpApproval:'SYNTHETIC_FAKE_TRANSPORT_ONLY',...overrides});
 const at=new Date(Date.now()-60000).toISOString(),id=randomUUID(),doc=randomUUID();
 await f.db.prepare('INSERT INTO subscriptions(owner_id,package_id,expires,payments,created,lifecycle) VALUES (?,\'starter\',NULL,0,?,\'ACTIVE\')').run(f.legacy.id,at);
 await f.db.prepare('INSERT INTO documents VALUES (?,?,?,?,?)').run(doc,f.legacy.id,'SYNTHETIC-NOT-LEGAL.pdf','application/pdf',Buffer.from('%PDF-1.4 SYNTHETIC NOT LEGAL'));
 await f.db.prepare("INSERT INTO villas(id,owner_id,name,province,merchant,email,package_id,document_id,status,photo_url,photo_uploaded_at,created) VALUES (?,?,'SYNTHETIC approval workflow','ภูเก็ต','SYNTHETIC',?,'starter',?,'pending','/demo/villas/villa-1.jpg',?,?)").run(id,f.legacy.id,f.legacy.email,doc,at,at);
 const villa=()=>f.db.prepare('SELECT * FROM villas WHERE id=?').get(id);await prepareVillaTrial(f.db,await villa());
 const admin=await f.login(f.admin),merchant=await f.login(f.legacy),other=await f.login(f.other);
 const approve=(session=admin,extra={})=>f.request('/villas/'+id+'/review',{status:'approved',verificationLevel:'VERIFIED',expectedReviewId:null,...extra},session);
 const cover=()=>f.expect('/admin/property-media',{villaId:id,mediaId:'cover'},admin);
 return {...f,id,doc,at,villa,adminSession:admin,merchantSession:merchant,otherSession:other,approve,cover};
}
