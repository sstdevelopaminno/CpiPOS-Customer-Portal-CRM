import { CalendarDays, ChevronLeft, ChevronRight, CircleAlert, Store, X } from "lucide-react";
import { type PortalContext, type ReportRange } from "../lib/portal";
import { number } from "../lib/formatters";

export function MetricCard({ icon, label, value, helper }: { icon: React.ReactNode; label: string; value: string; helper: string }) {
  return <article className="metricCard"><div className="metricIcon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{helper}</small></div></article>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="emptyState">{children}</div>;
}

export function ErrorPanel({ message }: { message: string }) {
  return <div className="errorPanel"><CircleAlert size={19}/><span>{message}</span></div>;
}

export function Pagination({page,pageCount,onPageChange,disabled=false}:{page:number;pageCount:number;onPageChange:(page:number)=>void;disabled?:boolean}) {
  if(pageCount<=1)return null;
  const current=page+1;
  const pages:Array<number|string>=[];
  const add=(value:number|string)=>{if(pages[pages.length-1]!==value)pages.push(value);};
  const candidates=new Set([1,pageCount,current-2,current-1,current,current+1,current+2].filter(value=>typeof value==="number"&&value>=1&&value<=pageCount) as number[]);
  let last=0;
  [...candidates].sort((a,b)=>a-b).forEach(value=>{if(last&&value-last>1)add("…");add(value);last=value;});
  return <div className="paginationBar">
    <button className="secondaryButton" disabled={page<=0||disabled} onClick={()=>onPageChange(Math.max(0,page-1))}><ChevronLeft size={17}/>ก่อนหน้า</button>
    <div className="pageNumbers">{pages.map((item,index)=>item==="…"?<span key={"ellipsis-"+index}>…</span>:<button key={item} disabled={disabled} className={Number(item)===current?"active":""} onClick={()=>onPageChange(Number(item)-1)}>{item}</button>)}</div>
    <button className="secondaryButton" disabled={page+1>=pageCount||disabled} onClick={()=>onPageChange(Math.min(pageCount-1,page+1))}>ถัดไป<ChevronRight size={17}/></button>
  </div>;
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide=false
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return <div className="modalBackdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)onClose();}}>
    <section className={`formModal ${wide?"wide":""}`} role="dialog" aria-modal="true">
      <div className="modalHeader">
        <div><h3>{title}</h3>{subtitle?<span>{subtitle}</span>:null}</div>
        <button className="iconButton" aria-label="ปิด" onClick={onClose}><X size={20}/></button>
      </div>
      {children}
    </section>
  </div>;
}

export function FilterBar({
  context,
  branchId,
  onBranchChange,
  range,
  onRangeChange,
  anchor,
  onAnchorChange,
  showPeriod
}: {
  context: PortalContext;
  branchId: string;
  onBranchChange: (value: string) => void;
  range: ReportRange;
  onRangeChange: (value: ReportRange) => void;
  anchor: string;
  onAnchorChange: (value: string) => void;
  showPeriod: boolean;
}) {
  return <div className="portalFilters">
    <label className="branchFilter">
      <Store size={18}/>
      <span>สาขา</span>
      <select value={branchId} onChange={e=>onBranchChange(e.target.value)}>
        <option value="">ทุกสาขาที่เข้าถึงได้</option>
        {context.branches.map(branch=><option key={branch.id} value={branch.id}>{branch.name}</option>)}
      </select>
    </label>
    {showPeriod ? <div className="reportControls">
      <label className="anchorPicker"><CalendarDays size={17}/><input type="date" value={anchor} onChange={e=>onAnchorChange(e.target.value)}/></label>
      <div className="rangeTabs" aria-label="ช่วงเวลารายงาน">
        {(["day","month","year"] as ReportRange[]).map(item=><button key={item} className={range===item?"active":""} onClick={()=>onRangeChange(item)}>{item==="day"?"รายวัน":item==="month"?"รายเดือน":"รายปี"}</button>)}
      </div>
    </div> : null}
  </div>;
}
