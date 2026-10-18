import { useCallback, useEffect, useState } from "react";
import { Boxes, ChevronRight, Download, Glasses, LayoutDashboard, LoaderCircle, LogOut, Menu, MoreHorizontal, PackageCheck, PanelLeftClose, PanelLeftOpen, ReceiptText, Settings, ShieldCheck, Store, UsersRound, Warehouse, WifiOff } from "lucide-react";
import { loadPortalContext, logoutPortal, todayInputValue, type PortalContext, type PortalView, type ReportRange } from "./lib/portal";
import { supabase } from "./lib/supabase";
import { isCustomMenuVisible } from "./lib/custom-menu-access";
import {CRM_MAIN_MENU_KEYS,CRM_OPTICAL_MENU_KEYS,isCrmMenuEnabled} from "./lib/crm-menu-policy";
import { FilterBar } from "./components/common";
import { Login } from "./views/Login";
import { DashboardView } from "./views/DashboardView";
import { SalesView } from "./views/SalesView";
import { ProductsView } from "./views/ProductsView";
import { CustomStockRouter } from "./views/CustomStockRouter";
import { resolveCustomInventoryMode } from "./lib/custom-inventory-mode";
import { StaffView } from "./views/StaffView";
import { PackageView } from "./views/PackageView";
import { MoreView } from "./views/MoreView";
import { SettingsView } from "./views/SettingsView";
import {useCustomBranding} from "./lib/use-custom-branding";
import {CRM_SETTINGS_LANGUAGE_STORAGE,languageOptions,settingsText,type CrmSettingsLanguage} from "./lib/settings-language";
import {OpticalWorkspace} from "./views/OpticalWorkspace";
import {useCrmLanguage} from "./lib/use-crm-language";
import {usePortalMenuAccess} from "./lib/use-portal-menu-access";
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
  const language=useCrmLanguage();
  const changeLanguage=useCallback((next:CrmSettingsLanguage)=>{
    localStorage.setItem(CRM_SETTINGS_LANGUAGE_STORAGE,next);
    window.dispatchEvent(new CustomEvent("cpipos-crm-language-changed",{detail:next}));
  },[]);
  const [checking,setChecking]=useState(true);
  const [view,setView]=useState<PortalView>("dashboard");
  const [branchId,setBranchId]=useState(()=>localStorage.getItem("cpipos-customer-portal-branch")??"");
  const {menuAccess,menuAccessError,reloadMenuAccess}=usePortalMenuAccess(context?.tenantId??null,branchId);
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
  const crmPolicy=menuAccess?.menu_policy??{};
  const opticalTabsAllowed=(["customers","orders","stock","reports"] as const).filter(tab=>isCrmMenuEnabled(crmPolicy,CRM_OPTICAL_MENU_KEYS[tab])&&(tab!=="reports"||context?.role==="owner")&&(tab!=="stock"||isCrmMenuEnabled(crmPolicy,CRM_MAIN_MENU_KEYS.stock)));
  // IT-approved CUSTOM Optical screens can list work orders before financial writes are released.
  const canSeeOptical=Boolean(menuAccess?.optical_retail_enabled&&(menuAccess.is_custom||menuAccess.is_internal_test_full)&&opticalTabsAllowed.length>0);
  const canSeeView=(id:PortalView)=>isCrmMenuEnabled(crmPolicy,CRM_MAIN_MENU_KEYS[id])&&(id==="optical"?canSeeOptical:!(menuAccess?.is_custom||menuAccess?.is_internal_test_full)||isCustomMenuVisible(menuAccess,PORTAL_VIEW_MENU[id]));
  const chooseView=(next:PortalView)=>{
    if(!canSeeView(next))return;
    setView(next);setMobileOpen(false);
  };

  if(checking)return <div className="bootScreen"><img className="bootLogo" src="/cpipos-logo.png" alt="CpiPOS"/><LoaderCircle className="spin"/><span>กำลังเตรียมข้อมูลร้าน...</span></div>;
  if(!context)return <Login onSuccess={restore} canInstall={Boolean(installPrompt)&&!standalone} onInstall={installApp}/>;

  // Keep navigation hidden until IT entitlement resolves; never flash unauthorized CUSTOM menus.
  const availableNav = !menuAccess ? [] : nav.filter(item=>canSeeView(item.id))
    .map(item=>({...item,label:settingsText(language,item.id==="stock" ? (stockBusinessMode==="optical"?"สต๊อกกรอบ/เลนส์":
      stockBusinessMode==="retail"?"สต๊อกสินค้า":stockBusinessMode==="mixed"?"สต๊อกตามโหมด":"วัตถุดิบ") : item.label)}));
  const activeView = !menuAccess ? null : !canSeeView(view) ? availableNav[0]?.id ?? null : view;
  const activeOpticalTab=opticalTabsAllowed.includes(opticalTab)?opticalTab:opticalTabsAllowed[0]??null;
  const showFilters=activeView!=="package";
  const opticalFinanceUiEnabled=import.meta.env.VITE_OPTICAL_OPS_V1_ENABLED==="true";
  const showPeriod=activeView==="dashboard"||activeView==="sales";
  const canInstall=Boolean(installPrompt)&&!standalone;

  return <div className={`appShell ${collapsed?"sidebarCollapsed":""} ${customBranding?"crm-custom-branded":""}`}
    style={customBranding?({"--crm-custom-accent":customBranding.accent_color,"--crm-custom-sidebar":customBranding.sidebar_color} as React.CSSProperties):undefined}>
    {mobileOpen?<button className="drawerBackdrop" aria-label="ปิดเมนู" onClick={()=>setMobileOpen(false)}/>:null}
    <aside className={`sidebar ${mobileOpen?"mobileOpen":""}`}>
      <div className="sidebarTop">
        <div className="brandBlock"><img className="brandLogo" src="/cpipos-logo.png" alt="CpiPOS"/><div><strong>{customBranding?.system_name??"CpiPOS"}</strong><span>Powered by CpiPOS</span></div></div>
        <button className="collapseButton" aria-label={collapsed?"ขยายเมนู":"ย่อเมนู"} onClick={toggleCollapsed}>{collapsed?<PanelLeftOpen size={20}/>:<PanelLeftClose size={20}/>}</button>
      </div>
      <div className="storeCard"><div className="storeAvatar">{customBranding?.logo_url?<img src={customBranding.logo_url} alt="โลโก้ร้าน"/>:context.logoUrl?<img src={context.logoUrl} alt=""/>:<Store size={22}/>}</div><div><strong>{context.tenantName}</strong><span>ร้าน {context.tenantCode}</span></div></div>
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
        <div className="brandBlock"><img className="brandLogo" src="/cpipos-logo.png" alt="CpiPOS"/><div><strong>{customBranding?.system_name??"CpiPOS"}</strong><span>Powered by CpiPOS · {context.tenantName}</span></div></div>
        <div className="mobileHeaderActions">{canInstall?<button className="iconButton" aria-label="ติดตั้งเว็บแอป" onClick={()=>void installApp()}><Download size={19}/></button>:null}<button className="iconButton" aria-label="ออกจากระบบ" onClick={()=>void logoutPortal()}><LogOut size={19}/></button></div>
      </header>

      {!online?<div className="offlineBanner"><WifiOff size={18}/><span>ออฟไลน์ — หน้าแอปยังเปิดได้ แต่ข้อมูลร้านและการบันทึกจะทำงานอีกครั้งเมื่อเชื่อมต่ออินเทอร์เน็ต</span></div>:null}
      {fatal?<div className="errorBox">{fatal}</div>:null}

      <div className="flex flex-wrap items-center justify-end gap-3 px-1 pt-3" data-testid="crm-language-currency-controls">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <span>{settingsText(language,"เปลี่ยนภาษา")}</span>
          <select aria-label={settingsText(language,"เลือกระบบภาษา")} value={language} onChange={event=>changeLanguage(event.target.value as CrmSettingsLanguage)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800">
            {languageOptions.map(option=><option key={option.code} value={option.code}>{option.label}</option>)}
          </select>
        </label>
        <span role="status" data-testid="crm-authorized-sales-currency" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          {language==="en"?"New sales currency":language==="lo"?"ສະກຸນເງິນຂາຍໃໝ່":"สกุลเงินขายใหม่"}{" : "}<strong>{context.salesCurrencyCode??"—"}</strong>
        </span>
        <button type="button" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" onClick={()=>void Promise.all([refreshContextAfterMutation(),reloadMenuAccess()])}>
          {settingsText(language,"รีเฟรช")}
        </button>
      </div>
      {showFilters?<FilterBar context={context} branchId={branchId} onBranchChange={changeBranch} range={range} onRangeChange={setRange} anchor={anchor} onAnchorChange={setAnchor} showPeriod={showPeriod}/>:null}

      {!menuAccess ? <div role="status" className="emptyState">
        <p>{menuAccessError ? "ไม่สามารถโหลดสิทธิ์เมนูได้ กรุณาลองอีกครั้ง" : "กำลังโหลดสิทธิ์เมนูจาก IT..."}</p>
        {menuAccessError ? <button type="button" onClick={()=>void reloadMenuAccess()}>ลองใหม่</button> : null}
      </div> : null}
      {activeView==="dashboard"?<DashboardView context={context} branchId={branchId||null} range={range} anchor={anchor}/>:null}
      {activeView==="sales"?<SalesView context={context} branchId={branchId||null} range={range} anchor={anchor}/>:null}
      {activeView==="products"?<ProductsView context={context} branchId={branchId||null}/>:null}
      {activeView==="stock"&&menuAccess
        ?<CustomStockRouter context={context} branchId={branchId||null} features={menuAccess}/>:null}
      {activeView==="staff"?<StaffView context={context} branchId={branchId||null}/>:null}
      {activeView==="package"?<PackageView context={context}/>:null}
      {activeView==="more"?<MoreView context={context} branchId={branchId||null} onNavigate={chooseView} language={language} menuPolicy={crmPolicy}/>:null}
      {activeView==="optical" && canSeeOptical ? <OpticalWorkspace
        context={context} branchId={branchId} language={language}
        stockBusinessMode={stockBusinessMode} activeOpticalTab={activeOpticalTab}
        opticalTabsAllowed={opticalTabsAllowed} opticalFinanceUiEnabled={opticalFinanceUiEnabled}
        canSeeStock={canSeeView("stock")} setOpticalTab={setOpticalTab}/> : null}
      {activeView==="settings"?<SettingsView context={context} branchId={branchId||null} onNavigate={chooseView} onContextChanged={refreshContextAfterMutation} menuPolicy={crmPolicy}/>:null}

      <footer>ข้อมูลและสิทธิ์ถูกจำกัดตามบัญชี {context.role==="owner"?"Owner":"Manager"} · {context.branches.length} สาขาที่เข้าถึงได้</footer>
    </main>
  </div>;
}
