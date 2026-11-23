import test from 'node:test';import assert from 'node:assert/strict';import sharp from 'sharp';
import {merchantFixture} from './helpers/merchant-test-fixture.mjs';
import {responsiveBannerImage,bannerVariantWidth,bannerImageWidths} from '../../server/banner-image-policy.mjs';
import {cmsImageVariant} from '../../server/cms-image-variant.mjs';
test('Responsive sources only transform exact same-origin CMS images and bound requested widths',()=>{
 const src='/api/public/cms-media/12345678-1234-1234-1234-123456789abc',props=responsiveBannerImage(src);assert.equal(props.sizes,'100vw');assert.equal(props.src,src+'?w=1280');for(const width of bannerImageWidths)assert(props.srcSet.includes(src+'?w='+width+' '+width+'w'));
 for(const original of ['/demo/photo.jpg','/illustrations/qr-evidence.svg','https://example.test/image.jpg','/api/admin/documents/123','/api/public/cms-media/123?private=true'])assert.deepEqual(responsiveBannerImage(original),{src:original});
 for(const query of ['w=1','w=99999999','w=480&w=768','w=480&q=1','w=0480','w=480.0'])assert.throws(()=>bannerVariantWidth(new URLSearchParams(query)),e=>e.status===400);
 assert.equal(bannerVariantWidth(new URLSearchParams()),null);assert.equal(bannerVariantWidth(new URLSearchParams('w=480')),480);
});
test('Variants preserve ratio/transparency, reuse bounded work, and change when source bytes change',async()=>{
 const input=await sharp({create:{width:1600,height:900,channels:4,background:'#16436780'}}).png().toBuffer();
 const [one,two]=await Promise.all([cmsImageVariant(input,480),cmsImageVariant(input,480)]);assert.equal(one,two);const meta=await sharp(one).metadata();assert.equal(meta.format,'webp');assert.equal(meta.width,480);assert.equal(meta.height,270);assert.equal(meta.hasAlpha,true);
 const changed=await sharp({create:{width:1600,height:900,channels:4,background:'#ff000080'}}).png().toBuffer();assert.notDeepEqual(await cmsImageVariant(changed,480),one);
 const small=await sharp({create:{width:32,height:24,channels:3,background:'#123456'}}).png().toBuffer();assert.equal((await sharp(await cmsImageVariant(small,1920)).metadata()).width,32);
});
test('Resized CMS images obey publish/withdraw authorization even after cache warm; originals stay unchanged',async t=>{
 const f=await merchantFixture({productionReleaseMode:'PHASE1_PUBLIC',internalAdminSetup:true,publicPublicationDisabled:true,phase1RequirementsRevision:'BANNER_SPEED',phase1ActivationMode:'BLOCKED',phase1EmailOtpDelivery:'SMTP',phase1EmailOtpApproval:'LOCAL',unifiedAuthEnabled:true});t.after(f.close);const a=await f.login(f.admin);
 const bytes=await sharp({create:{width:1600,height:900,channels:3,background:'#2862b0'}}).png().toBuffer(),image=(await f.expect('/admin/cms/media',{file:{name:'local-banner.png',type:'image/png',data:'data:image/png;base64,'+bytes.toString('base64')}},a)).body.url,path=image.replace('/api','');
 await f.expect(path+'?w=480',undefined,undefined,404);const adminVariant=await f.expect(path+'?w=480',undefined,a);assert.equal((await sharp(adminVariant.body).metadata()).width,480);
 const cms=(await f.expect('/admin/cms',undefined,a)).body,content=structuredClone(cms.draft.content);content.home.introImage=image;content.home.introVisible=true;const saved=(await f.expect('/admin/cms/save',{revision:cms.draft.revision,content},a)).body;await f.expect('/admin/cms/publish',{revision:saved.draft.revision},a);
 const publicVariant=await f.expect(path+'?w=480');assert.deepEqual(publicVariant.body,adminVariant.body);const response=await fetch(f.base+image+'?w=768');assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/webp');assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal((await sharp(Buffer.from(await response.arrayBuffer())).metadata()).width,768);
 await f.expect(path+'?w=999999',undefined,undefined,400);assert.deepEqual((await f.expect(path)).body,bytes);
 const next=structuredClone(saved.draft.content);next.home.introImage='/illustrations/qr-evidence.svg';const hidden=(await f.expect('/admin/cms/save',{revision:saved.draft.revision,content:next},a)).body;await f.expect('/admin/cms/publish',{revision:hidden.draft.revision},a);
 await f.expect(path+'?w=480',undefined,undefined,404);await f.expect(path,undefined,undefined,404);assert.deepEqual((await f.expect(path,undefined,a)).body,bytes);
});
