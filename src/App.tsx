import { useCallback, useEffect, useState } from "react";
import { Boxes, ChevronRight, Download, LayoutDashboard, LoaderCircle, LogOut, Menu, MoreHorizontal, PackageCheck, PanelLeftClose, PanelLeftOpen, ReceiptText, Settings, ShieldCheck, Store, UsersRound, Warehouse, WifiOff } from "lucide-react";
import { loadPortalContext, logoutPortal, todayInputValue, type PortalContext, type PortalView, type ReportRange } from "./lib/portal";
import { supabase } from "./lib/supabase";
import { FilterBar } from "./components/common";
import { Login } from "./views/Login";
import { DashboardView } from "./views/DashboardView";
import { SalesView } from "./views/SalesView";
import { ProductsView } from "./views/ProductsView";
import { StockView } from "./views/StockView";
import { StaffView } from "./views/StaffView";
import { PackageView } from "./views/PackageView";
import { MoreView } from "./views/MoreView";
import { SettingsView } from "./views/SettingsView";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const nav: Array<{ id: PortalView; label: string; icon: React.ReactNode }> = [
  { id:"dashboard",label:"ภาพรวม",icon:<LayoutDashboard size={21}/> },
  { id:"sales",label:"ยอดขาย",icon:<ReceiptText size={21}/> },
  { id:"products",label:"สินค้า",icon:<Boxes size={21}/> },
  { id:"stock",label:"วัตถุดิบ",icon:<Warehouse size={21}/> },
  { id:"staff",label:"พนักงาน",icon:<UsersRound size={21}/> },
  { id:"package",label:"แพ็กเกจ",icon:<PackageCheck size={21}/> },
  { id:"more",label:"เพิ่มเติม",icon:<MoreHorizontal size={21}/> },
  { id:"settings",label:"ตั้งค่า",icon:<Settings size={21}/> }
];

export default function App() {
  const [context,setContext]=useState<PortalContext|null>(null);
  const [checking,setChecking]=useState(true);
  const [view,setView]=useState<PortalView>("dashboard");
  const [branchId,setBranchId]=useState(()=>localStorage.getItem("cpipos-customer-portal-branch")??"");
  const [range,setRange]=useState<ReportRange>("day");
  const [anchor,setAnchor]=useState(todayInputValue());
  const [fatal,setFatal]=useState("");
  const [installPrompt,setInstallPrompt]=useState<InstallPromptEvent|null>(null);
  const [online,setOnline]=useState(()=>navigator.onLine);
  const [standalone,setStandalone]=useState(()=>window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
  const [collapsed,setCollapsed]=useState(()=>localStorage.getItem("cpipos-sidebar-collapsed")==="1");
  const [mobileOpen,setMobileOpen]=useState(false);

  const restore=useCallback(async()=>{
    setFatal("");
    try{setContext(await loadPortalContext());}
    catch(err){const message=err instanceof Error?err.message:"";if(message!=="not_authenticated")setFatal("ไม่สามารถตรวจสอบสิทธิ์ Customer Portal ได้");setContext(null);}
    finally{setChecking(false);}
  },[]);

  const refreshContextAfterMutation=useCallback(async()=>{
    try{
      const next=await loadPortalContext();
      setContext(next);
      setFatal("");
    }catch(err){
      const message=err instanceof Error?err.message:"";
      if(message==="not_authenticated"){
        setContext(null);
        setFatal("");
        return;
      }
      setFatal("บันทึกสำเร็จแล้ว แต่ไม่สามารถโหลดข้อมูลร้านล่าสุดได้ กรุณากดรีเฟรชอีกครั้ง");
    }
  },[]);

  useEffect(()=>{
    void restore();
    const{data}=supabase.auth.onAuthStateChange(event=>{if(event==="SIGNED_OUT")setContext(null);});
    return()=>data.subscription.unsubscribe();
  },[restore]);

  useEffect(()=>{
    if(!context)return;
    if(branchId && !context.branches.some(branch=>branch.id===branchId)){
      setBranchId("");
      localStorage.removeItem("cpipos-customer-portal-branch");
    }
  },[context,branchId]);

  useEffect(()=>{
    const beforeInstall=(event:Event)=>{
      if(standalone)return;
      const promptEvent=event as InstallPromptEvent;
      promptEvent.preventDefault();
      setInstallPrompt(promptEvent);
    };
    const appInstalled=()=>{
      setInstallPrompt(null);
      setStandalone(true);
    };
    const goOnline=()=>setOnline(true);
    const goOffline=()=>setOnline(false);
    window.addEventListener("beforeinstallprompt",beforeInstall);
    window.addEventListener("appinstalled",appInstalled);
    window.addEventListener("online",goOnline);
    window.addEventListener("offline",goOffline);
    return()=>{
      window.removeEventListener("beforeinstallprompt",beforeInstall);
      window.removeEventListener("appinstalled",appInstalled);
      window.removeEventListener("online",goOnline);
      window.removeEventListener("offline",goOffline);
    };
  },[standalone]);

  const installApp=useCallback(async()=>{
    if(!installPrompt)return;
    await installPrompt.prompt();
    const choice=await installPrompt.userChoice;
    if(choice.outcome==="accepted") setInstallPrompt(null);
  },[installPrompt]);

  const changeBranch=useCallback((value:string)=>{
    setBranchId(value);
    if(value)localStorage.setItem("cpipos-customer-portal-branch",value);
    else localStorage.removeItem("cpipos-customer-portal-branch");
  },[]);

  const toggleCollapsed=useCallback(()=>{
    setCollapsed(value=>{
      const next=!value;
      localStorage.setItem("cpipos-sidebar-collapsed",next?"1":"0");
      return next;
    });
  },[]);

  const chooseView=(next:PortalView)=>{setView(next);setMobileOpen(false);};

  if(checking)return <div className="bootScreen"><img className="bootLogo" src="/cpipos-logo.png" alt="CpiPOS"/><LoaderCircle className="spin"/><span>กำลังเตรียมข้อมูลร้าน...</span></div>;
  if(!context)return <Login onSuccess={restore} canInstall={Boolean(installPrompt)&&!standalone} onInstall={installApp}/>;

  const showFilters=view!=="package";
  const showPeriod=view==="dashboard"||view==="sales";
  const canInstall=Boolean(installPrompt)&&!standalone;

  return <div className={`appShell ${collapsed?"sidebarCollapsed":""}`}>
    {mobileOpen?<button className="drawerBackdrop" aria-label="ปิดเมนู" onClick={()=>setMobileOpen(false)}/>:null}
    <aside className={`sidebar ${mobileOpen?"mobileOpen":""}`}>
      <div className="sidebarTop">
        <div className="brandBlock"><img className="brandLogo" src="/cpipos-logo.png" alt="CpiPOS"/><div><strong>CpiPOS</strong><span>Customer Portal</span></div></div>
        <button className="collapseButton" aria-label={collapsed?"ขยายเมนู":"ย่อเมนู"} onClick={toggleCollapsed}>{collapsed?<PanelLeftOpen size={20}/>:<PanelLeftClose size={20}/>}</button>
      </div>
      <div className="storeCard"><div className="storeAvatar">{context.logoUrl?<img src={context.logoUrl} alt=""/>:<Store size={22}/>}</div><div><strong>{context.tenantName}</strong><span>ร้าน {context.tenantCode}</span></div></div>
      <nav aria-label="เมนูหลัก">{nav.map(item=><button key={item.id} aria-current={view===item.id?"page":undefined} title={collapsed?item.label:undefined} className={view===item.id?"active":""} onClick={()=>chooseView(item.id)}>{item.icon}<span>{item.label}</span><ChevronRight size={17}/></button>)}</nav>
      <div className="sidebarBottom">
        {canInstall?<button className="sidebarInstallButton" onClick={()=>void installApp()}><Download size={17}/><span>ติดตั้งเว็บแอป</span></button>:null}
        <div className="roleBadge"><ShieldCheck size={17}/><span>{context.role==="owner"?"Owner":"Manager"}</span></div>
        <button className="logoutButton" onClick={()=>void logoutPortal()}><LogOut size={18}/><span>ออกจากระบบ</span></button>
      </div>
    </aside>

    <main className="content">
      <header className="mobileHeader">
        <button className="iconButton" aria-label="เปิดเมนู" onClick={()=>setMobileOpen(true)}><Menu size={21}/></button>
        <div className="brandBlock"><img className="brandLogo" src="/cpipos-logo.png" alt="CpiPOS"/><div><strong>CpiPOS</strong><span>{context.tenantName}</span></div></div>
        <div className="mobileHeaderActions">{canInstall?<button className="iconButton" aria-label="ติดตั้งเว็บแอป" onClick={()=>void installApp()}><Download size={19}/></button>:null}<button className="iconButton" aria-label="ออกจากระบบ" onClick={()=>void logoutPortal()}><LogOut size={19}/></button></div>
      </header>

      {!online?<div className="offlineBanner"><WifiOff size={18}/><span>ออฟไลน์ — หน้าแอปยังเปิดได้ แต่ข้อมูลร้านและการบันทึกจะทำงานอีกครั้งเมื่อเชื่อมต่ออินเทอร์เน็ต</span></div>:null}
      {fatal?<div className="errorBox">{fatal}</div>:null}

      {showFilters?<FilterBar context={context} branchId={branchId} onBranchChange={changeBranch} range={range} onRangeChange={setRange} anchor={anchor} onAnchorChange={setAnchor} showPeriod={showPeriod}/>:null}

      {view==="dashboard"?<DashboardView context={context} branchId={branchId||null} range={range} anchor={anchor}/>:null}
      {view==="sales"?<SalesView context={context} branchId={branchId||null} range={range} anchor={anchor}/>:null}
      {view==="products"?<ProductsView context={context} branchId={branchId||null}/>:null}
      {view==="stock"?<StockView context={context} branchId={branchId||null}/>:null}
      {view==="staff"?<StaffView context={context} branchId={branchId||null}/>:null}
      {view==="package"?<PackageView context={context}/>:null}
      {view==="more"?<MoreView context={context} branchId={branchId||null} onNavigate={chooseView}/>:null}
      {view==="settings"?<SettingsView context={context} branchId={branchId||null} onNavigate={chooseView} onContextChanged={refreshContextAfterMutation}/>:null}

      <footer>ข้อมูลและสิทธิ์ถูกจำกัดตามบัญชี {context.role==="owner"?"Owner":"Manager"} · {context.branches.length} สาขาที่เข้าถึงได้</footer>
    </main>
  </div>;
}
