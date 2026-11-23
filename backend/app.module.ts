import {publicError} from "../server/public-error.mjs";
import {requestLocale} from "../server/locale-messages.mjs";
import {PackageService} from "./package.service.js";
import {Get,All,Controller,Module,Req,Res,Injectable,CanActivate,ExecutionContext,HttpException,UseGuards} from "@nestjs/common";
import type {Request,Response} from "express";
import {PrismaDatabaseService} from "./prisma.service.js";
import {DomainService} from "./domain.service.js";
function localizedGuardException(error:unknown,context:ExecutionContext){
 const request=context.switchToHttp().getRequest<Request>(),response=context.switchToHttp().getResponse<Response>();
 const locale=requestLocale(request.headers["accept-language"]);
 response.setHeader("Content-Language",locale);
 const candidate=error as {status?:number;message?:string};
 const status=error instanceof HttpException?error.getStatus():candidate?.status||503;
 const result=publicError({status,message:candidate?.message},{locale});
 return new HttpException({...result.body,message:result.body.error,statusCode:result.status},result.status);
}
@Injectable()
export class AdminAuthGuard implements CanActivate {
 constructor(private readonly domain:DomainService){}
 async canActivate(context:ExecutionContext){
  try{const user=await this.domain.authenticate(context.switchToHttp().getRequest());if(user.role!=="admin")throw new HttpException("เฉพาะ Admin",403);return true;}
  catch(error:any){throw localizedGuardException(error,context);}
 }
}
@Injectable()
export class MerchantAuthGuard implements CanActivate {
 constructor(private readonly domain:DomainService){}
 async canActivate(context:ExecutionContext){
  try{const user=await this.domain.authenticate(context.switchToHttp().getRequest());if(!["merchant","admin"].includes(user.role))throw new HttpException("แพ็กเกจสำหรับ Merchant ใน Member Room",403);return true;}
  catch(error:any){throw localizedGuardException(error,context);}
 }
}
@Controller("api")
@UseGuards(MerchantAuthGuard)
class PackageController {
 constructor(private readonly packages:PackageService){}
 @Get("packages") list(){return this.packages.listActive();}
}
@Controller("api/admin")
@UseGuards(AdminAuthGuard)
class AdminController {
 constructor(private readonly domain:DomainService){}
 @All("{*path}") handle(@Req()req:Request,@Res()res:Response){return this.domain.handle(req,res);}
}
@Controller("api")
class ApiController {
 constructor(private readonly domain:DomainService){}
 @All("{*path}") handle(@Req()req:Request,@Res()res:Response){return this.domain.handle(req,res);}
}
@Module({controllers:[PackageController,AdminController,ApiController],providers:[PrismaDatabaseService,DomainService,AdminAuthGuard,MerchantAuthGuard,PackageService]})
export class AppModule {}
