import type {BrowserQRCodeReader} from "@zxing/browser";
// Keep the camera's perspective detector unchanged. Clean exported QR images can
// confuse that detector for particular masks; retry pure-image decoding only
// after normal decoding fails. The caller still validates the decoded reference.
export async function decodeQrImage(url:string,reader:BrowserQRCodeReader){
 try{return await reader.decodeFromImageUrl(url);}
 catch{
  const [{BrowserQRCodeReader:ImageReader},{DecodeHintType}]=await Promise.all([import("@zxing/browser"),import("@zxing/library")]);
  const imageReader=new ImageReader(new Map([[DecodeHintType.PURE_BARCODE,true]]));
  return imageReader.decodeFromImageUrl(url);
 }
}
