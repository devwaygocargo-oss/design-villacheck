"use client";
import {useEffect} from "react";
import AdminLogin from "../../../src/AdminLogin";
import {currentAccount} from "../../../src/api";

export default function OwnerLoginPage(){
 useEffect(()=>{let active=true;void currentAccount().then(account=>{if(active&&account.role==="admin")window.location.replace("/owner?context=admin");}).catch(()=>{});return()=>{active=false};},[]);
 return <AdminLogin owner go={()=>window.location.assign("/")}/>;
}
