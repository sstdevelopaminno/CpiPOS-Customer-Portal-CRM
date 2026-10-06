import { useMemo,useState } from "react";
import { Pencil,Search } from "lucide-react";
import { Empty,Modal } from "../../components/common";
import { mutatePosAdmin } from "../../lib/api/pos-admin";
import type { PortalContext } from "../../types/portal";
import type { KitchenAdminSnapshot,KitchenProductAdmin } from "../../types/pos-admin";

export function KitchenProductRouting({context,branchId,snapshot,onRefresh,onError}:{context:PortalContext;branchId:string;snapshot:KitchenAdminSnapshot;onRefresh:()=>Promise<void>;onError:(m:string)=>void}){
  const [query,setQuery]=useState("");const [product,setProduct]=useState<KitchenProductAdmin|null>(null);const [selected,setSelected]=useState<string[]>([]);const [saving,setSaving]=useState(false);
  const routeMap=useMemo(()=>{const map=new Map<string,string[]>();for(const rule of snapshot.routing_rules){if(!rule.product_id||!rule.is_active)continue;map.set(rule.product_id,[...(map.get(rule.product_id)??[]),rule.zone_id]);}return map;},[snapshot.routing_rules]);
  const products=useMemo(()=>{const q=query.trim().toLowerCase();return snapshot.products.filter(p=>!q||[p.name,p.sku??"",p.category??""].some(v=>v.toLowerCase().includes(q)));},[snapshot.products,query]);
  function open(row:KitchenProductAdmin){setProduct(row);setSelected(routeMap.get(row.id)??[]);}
  async function save(){if(!product)return;setSaving(true);onError("");try{await mutatePosAdmin(context.tenantId,branchId,"kitchen.routes.replace",{scope_type:"product",product_id:product.id,category_name:null,zone_ids:selected});setProduct(null);await onRefresh();}catch(err){onError(err instanceof Error?err.message:"บันทึกเส้นทางครัวไม่สำเร็จ");}finally{setSaving(false);}}
  return <section className="panel adminPanel"><div className="panelHeader"><div><p className="eyebrow">PRODUCT ROUTING</p><h3>กำหนดครัวรายสินค้า</h3><small>Product route มีลำดับความสำคัญเหนือ route ตามหมวดหมู่</small></div></div>
    <div className="toolbar kitchenRouteToolbar"><label className="searchBox"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ค้นหาสินค้า SKU หรือหมวดหมู่..."/></label></div>
    <div className="tableWrap boundedTable"><table><thead><tr><th>สินค้า</th><th>หมวดหมู่</th><th>ส่งไปครัว</th><th></th></tr></thead><tbody>{products.length?products.map(p=>{const zones=routeMap.get(p.id)??[];return <tr key={p.id}><td><strong>{p.name}</strong><br/><small>{p.sku||"—"}</small></td><td>{p.category||"—"}</td><td>{zones.length?zones.map(id=>snapshot.zones.find(z=>z.id===id)?.zone_name||id).join(", "):"ใช้ route หมวดหมู่/ค่าเริ่มต้น"}</td><td><button className="tableAction" onClick={()=>open(p)}><Pencil size={14}/>กำหนดครัว</button></td></tr>}):<tr><td colSpan={4}><Empty>ไม่พบสินค้า</Empty></td></tr>}</tbody></table></div>
    {product?<Modal title={`เส้นทางครัว · ${product.name}`} onClose={()=>setProduct(null)}><div className="linkedModuleBody"><p>เลือกได้มากกว่า 1 โซนครัว หากไม่เลือกเลย ระบบจะกลับไปใช้ route ตามหมวดหมู่หรือค่าเริ่มต้น</p><div className="adminCheckGrid">{snapshot.zones.filter(z=>z.is_active).map(z=><label key={z.id}><input type="checkbox" checked={selected.includes(z.id)} onChange={e=>setSelected(cur=>e.target.checked?[...cur,z.id]:cur.filter(id=>id!==z.id))}/><span>{z.zone_name} · {z.zone_code}</span></label>)}</div><div className="modalActions"><button className="secondaryButton" onClick={()=>setProduct(null)}>ยกเลิก</button><button className="primaryAction" disabled={saving} onClick={()=>void save()}>บันทึก route</button></div></div></Modal>:null}
  </section>;
}
