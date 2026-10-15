import { useCallback, useEffect, useState } from "react";
import { Boxes, ChevronRight, Download, Glasses, LayoutDashboard, LoaderCircle, LogOut, Menu, MoreHorizontal, PackageCheck, PanelLeftClose, PanelLeftOpen, ReceiptText, Settings, ShieldCheck, Store, UsersRound, Warehouse, WifiOff } from "lucide-react";
import { loadFeatureState, loadPortalContext, logoutPortal, todayInputValue, type FeatureState, type PortalContext, type PortalView, type ReportRange } from "./lib/portal";
import { supabase } from "./lib/supabase";
import { isCustomMenuVisible } from "./lib/custom-menu-access";
import { FilterBar } from "./components/common";
import { Login } from "./views/Login";
import { DashboardView } from "./views/DashboardView";
import { SalesView } from "./views/SalesView";
import { ProductsView } from "./views/ProductsView";
import { CustomStockRouter } from "./views/CustomStockRouter";
import { BusinessStockOverview } from "./views/BusinessStockOverview";
import { resolveCustomInventoryMode } from "./lib/custom-inventory-mode";
import { StaffView } from "./views/StaffView";
import { PackageView } from "./views/PackageView";
import { MoreView } from "./views/MoreView";
import { OpticalCustomersView } from "./views/OpticalCustomersView";
import { OpticalOperationsView } from "./views/OpticalOperationsView";
import { OpticalCustomerAddressEditor } from "./views/OpticalCustomerAddressEditor";
import { SettingsView } from "./views/SettingsView";
import {useCustomBranding} from "./lib/use-custom-branding";

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
  { id:"optical",label:"ลูกค้าแว่นตา",icon:<Glasses size={21}/> },
  { id:"settings",label:"ตั้งค่า",icon:<Settings size={21}/> }
];

const PORTAL_VIEW_MENU: Record<PortalView,string> = {
  dashboard:"more.sales_summary", sales:"main.sales_list", products:"more.stock",
  stock:"more.stock", staff:"settings.users", package:"main.package_payment",
  more:"main.more", settings:"main.settings", optical:"main.optical_customers"
};

export default function App() {
  const [context,setContext]=useState<PortalContext|null>(null);
  const [menuAccess,setMenuAccess]=useState<FeatureState|null>(null);
  const [menuAccessError,setMenuAccessError]=useState(false);
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
  const [opticalTab,setOpticalTab]=useState<"customers"|"orders"|"stock"|"reports">("customers");
  const customBranding=useCustomBranding(context?.tenantId,menuAccess?.is_custom===true);

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
    if(!context){setMenuAccess(null);setMenuAccessError(false);return;}
    let cancelled=false;
    setMenuAccess(null);
    setMenuAccessError(false);
    loadFeatureState(context.tenantId,branchId||null)
      .then(state=>{if(!cancelled){setMenuAccess(state);setMenuAccessError(false);}})
      .catch(()=>{if(!cancelled){setMenuAccess(null);setMenuAccessError(true);}});
    return()=>{cancelled=true;};
  },[context,branchId]);

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

  const stockBusinessMode = menuAccess ? resolveCustomInventoryMode(menuAccess) : "legacy";
  const canSeeOptical = Boolean(menuAccess?.optical_retail_enabled
    && (menuAccess.is_custom || menuAccess.is_internal_test_full)
    && menuAccess.menu_policy["main.optical_customers"] !== false);
  const canSeeView=(id:PortalView)=>id==="optical" ? canSeeOptical
    : !(menuAccess?.is_custom || menuAccess?.is_internal_test_full)
      || isCustomMenuVisible(menuAccess,PORTAL_VIEW_MENU[id]);
  const chooseView=(next:PortalView)=>{
    if(!canSeeView(next))return;
    setView(next);setMobileOpen(false);
  };

  if(checking)return <div className="bootScreen"><img className="bootLogo" src="/cpipos-logo.png" alt="CpiPOS"/><LoaderCircle className="spin"/><span>กำลังเตรียมข้อมูลร้าน...</span></div>;
  if(!context)return <Login onSuccess={restore} canInstall={Boolean(installPrompt)&&!standalone} onInstall={installApp}/>;

  // Never render unrestricted navigation before an authoritative feature
  // snapshot arrives. This prevents CUSTOM menus flashing or becoming usable on
  // an API failure; fixed plans resume their legacy behavior after load.
  const availableNav = !menuAccess ? [] : nav.filter(item=>canSeeView(item.id))
    .map(item=>item.id==="stock"
      ? {...item,label:stockBusinessMode==="optical"?"สต๊อกกรอบ/เลนส์":
          stockBusinessMode==="retail"?"สต๊อกสินค้า":
          stockBusinessMode==="mixed"?"สต๊อกตามโหมด":"วัตถุดิบ"}
      : item);
  const activeView = !menuAccess ? null : !canSeeView(view) ? availableNav[0]?.id ?? null : view;
  const showFilters=activeView!=="package";
  const showPeriod=activeView==="dashboard"||activeView==="sales";
  const canInstall=Boolean(installPrompt)&&!standalone;

  return <div className={`appShell ${collapsed?"sidebarCollapsed":""} ${customBranding?"crm-custom-branded":""}`}
    style={customBranding?({
      "--crm-custom-accent":customBranding.accent_color,
      "--crm-custom-sidebar":customBranding.sidebar_color
    } as React.CSSProperties):undefined}>
    {mobileOpen?<button className="drawerBackdrop" aria-label="ปิดเมนู" onClick={()=>setMobileOpen(false)}/>:null}
    <aside className={`sidebar ${mobileOpen?"mobileOpen":""}`}>
      <div className="sidebarTop">
        <div className="brandBlock"><img className="brandLogo" src="/cpipos-logo.png" alt="CpiPOS"/>
          <div><strong>{customBranding?.system_name??"CpiPOS"}</strong><span>Powered by CpiPOS</span></div></div>
        <button className="collapseButton" aria-label={collapsed?"ขยายเมนู":"ย่อเมนู"} onClick={toggleCollapsed}>{collapsed?<PanelLeftOpen size={20}/>:<PanelLeftClose size={20}/>}</button>
      </div>
      <div className="storeCard"><div className="storeAvatar">{customBranding?.logo_url?<img src={customBranding.logo_url} alt="โลโก้ร้าน"/>:
        context.logoUrl?<img src={context.logoUrl} alt=""/>:<Store size={22}/>}</div>
        <div><strong>{context.tenantName}</strong><span>ร้าน {context.tenantCode}</span></div></div>
      <nav aria-label="เมนูหลัก">{availableNav.map(item=><button key={item.id} aria-current={activeView===item.id?"page":undefined} title={collapsed?item.label:undefined} className={activeView===item.id?"active":""} onClick={()=>chooseView(item.id)}>{item.icon}<span>{item.label}</span><ChevronRight size={17}/></button>)}</nav>
      <div className="sidebarBottom">
        {canInstall?<button className="sidebarInstallButton" onClick={()=>void installApp()}><Download size={17}/><span>ติดตั้งเว็บแอป</span></button>:null}
        <div className="roleBadge"><ShieldCheck size={17}/><span>{context.role==="owner"?"Owner":"Manager"}</span></div>
        <button className="logoutButton" onClick={()=>void logoutPortal()}><LogOut size={18}/><span>ออกจากระบบ</span></button>
      </div>
    </aside>

    <main className="content">
      <header className="mobileHeader">
        <button className="iconButton" aria-label="เปิดเมนู" onClick={()=>setMobileOpen(true)}><Menu size={21}/></button>
        <div className="brandBlock"><img className="brandLogo" src="/cpipos-logo.png" alt="CpiPOS"/>
          <div><strong>{customBranding?.system_name??"CpiPOS"}</strong><span>Powered by CpiPOS · {context.tenantName}</span></div></div>
        <div className="mobileHeaderActions">{canInstall?<button className="iconButton" aria-label="ติดตั้งเว็บแอป" onClick={()=>void installApp()}><Download size={19}/></button>:null}<button className="iconButton" aria-label="ออกจากระบบ" onClick={()=>void logoutPortal()}><LogOut size={19}/></button></div>
      </header>

      {!online?<div className="offlineBanner"><WifiOff size={18}/><span>ออฟไลน์ — หน้าแอปยังเปิดได้ แต่ข้อมูลร้านและการบันทึกจะทำงานอีกครั้งเมื่อเชื่อมต่ออินเทอร์เน็ต</span></div>:null}
      {fatal?<div className="errorBox">{fatal}</div>:null}

      {showFilters?<FilterBar context={context} branchId={branchId} onBranchChange={changeBranch} range={range} onRangeChange={setRange} anchor={anchor} onAnchorChange={setAnchor} showPeriod={showPeriod}/>:null}

      {!menuAccess ? <div role="status" className="emptyState">
        <p>{menuAccessError ? "ไม่สามารถโหลดสิทธิ์เมนูได้ กรุณาลองอีกครั้ง" : "กำลังโหลดสิทธิ์เมนูจาก IT..."}</p>
        {menuAccessError ? <button type="button" onClick={()=>{setMenuAccessError(false);loadFeatureState(context.tenantId,branchId||null).then(state=>setMenuAccess(state)).catch(()=>setMenuAccessError(true));}}>ลองใหม่</button> : null}
      </div> : null}
      {activeView==="dashboard"?<DashboardView context={context} branchId={branchId||null} range={range} anchor={anchor}/>:null}
      {activeView==="sales"?<SalesView context={context} branchId={branchId||null} range={range} anchor={anchor}/>:null}
      {activeView==="products"?<ProductsView context={context} branchId={branchId||null}/>:null}
      {activeView==="stock"&&menuAccess
        ?<CustomStockRouter context={context} branchId={branchId||null} features={menuAccess}/>:null}
      {activeView==="staff"?<StaffView context={context} branchId={branchId||null}/>:null}
      {activeView==="package"?<PackageView context={context}/>:null}
      {activeView==="more"?<MoreView context={context} branchId={branchId||null} onNavigate={chooseView}/>:null}
      {activeView==="optical" && canSeeOptical ? (
        import.meta.env.VITE_OPTICAL_OPS_V1_ENABLED === "true" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="โมดูล Optical">
              {([["customers","ประวัติลูกค้า"],["orders","ใบสั่งงาน"],
                ["stock","สต๊อกกรอบ/เลนส์"],["reports","รายงานเจ้าของร้าน"]] as const)
                .filter(([id])=>(id!=="reports"||context.role==="owner") && (id!=="stock"||canSeeView("stock"))).map(([id,label])=><button type="button" role="tab"
                aria-selected={opticalTab===id} key={id} onClick={()=>setOpticalTab(id)}
                className={`rounded-xl border px-4 py-2 text-sm font-bold ${opticalTab===id?"border-emerald-700 bg-emerald-700 text-white":"border-emerald-100 bg-white text-emerald-800"}`}>{label}</button>)}
            </div>
            {opticalTab==="stock" && canSeeView("stock") ? (
              <BusinessStockOverview context={context} branchId={branchId||null} business="optical" strictOpticalCategory={stockBusinessMode==="mixed"}/>
            ) : opticalTab==="stock" ? (
              <p role="alert">เมนูสต๊อกยังไม่ได้รับอนุมัติจาก IT Admin</p>
            ) : opticalTab==="customers"?<div className="space-y-4">
              <OpticalCustomersView context={context} branchId={branchId||null}/>
              <OpticalCustomerAddressEditor context={context} branchId={branchId||null}/>
            </div>:(
              opticalTab==="reports"&&context.role!=="owner"
                ? <p role="alert">เฉพาะเจ้าของร้านเท่านั้นที่สามารถดูรายงาน Optical</p>
                : <OpticalOperationsView context={context} branchId={branchId||null} page={opticalTab}/>
            )}
          </div>
        ) : <div className="space-y-4">
          {canSeeView("stock")?<div className="custom-stock-shortcut"><span>IMDC OPTICAL · สต๊อกกรอบแว่น/เลนส์</span><button type="button" onClick={()=>chooseView("stock")}>เปิดเมนูสต๊อก</button></div>:null}
          <OpticalCustomersView context={context} branchId={branchId||null}/>
        </div>
      ) : null}
      {activeView==="settings"?<SettingsView context={context} branchId={branchId||null} onNavigate={chooseView} onContextChanged={refreshContextAfterMutation}/>:null}

      <footer>ข้อมูลและสิทธิ์ถูกจำกัดตามบัญชี {context.role==="owner"?"Owner":"Manager"} · {context.branches.length} สาขาที่เข้าถึงได้</footer>
    </main>
  </div>;
}
