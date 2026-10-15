import {useEffect,useState} from "react";
import {supabase} from "../lib/supabase";
import {formatCurrency} from "../lib/formatters";

type Product={id:string;name:string;sku:string|null};
type Top={id:string;name:string;units:number;revenue:number};
export function OpticalBestSellers({tenantId,branchId,branchName,currency,products,onClose}:{
 tenantId:string;branchId:string;branchName:string;currency:string;
 products:Product[];onClose:()=>void
}){
 const [rows,setRows]=useState<Top[]>([]);
 const [loading,setLoading]=useState(true),[error,setError]=useState(""),[sampled,setSampled]=useState(false);
 useEffect(()=>{
  let cancelled=false;
  async function load(){
    setRows([]);setError("");setLoading(true);
    try{
      const start=new Date(Date.now()-30*86400000).toISOString();
      const {data:orders,error:e}=await supabase.from("orders").select("id")
        .eq("tenant_id",tenantId).eq("branch_id",branchId)
        .eq("status","completed").gte("created_at",start)
        .order("created_at",{ascending:false}).order("id",{ascending:false})
        .range(0,1000);
      if(e)throw e;
      const ids=(orders??[]).slice(0,1000).map(x=>x.id);
      const partial=(orders??[]).length>1000;
      const allowed=new Map(products.map(p=>[p.id,p]));
      const totals=new Map<string,{units:number;revenue:number}>();
      for(let i=0;i<ids.length;i+=80){
        const {data:items,error:err}=await supabase.from("order_items")
         .select("id,product_id,quantity,line_total")
         .eq("tenant_id",tenantId).eq("branch_id",branchId)
         .in("order_id",ids.slice(i,i+80)).gt("quantity",0)
         .order("id",{ascending:true}).range(0,999);
        if(err)throw err;
        if((items??[]).length===1000)throw new Error("รายการบิลมากเกินขีดจำกัด กรุณาลดช่วงวันที่ก่อนจัดอันดับ");
        for(const item of items??[]){
         if(!item.product_id||!allowed.has(item.product_id))continue;
         const x=totals.get(item.product_id)??{units:0,revenue:0};
         x.units+=Number(item.quantity??0);x.revenue+=Number(item.line_total??0);
         totals.set(item.product_id,x);
        }
      }
      const top=Array.from(totals.entries()).map(([id,x])=>({
       id,name:allowed.get(id)?.name??id,
       units:Number(x.units.toFixed(3)),revenue:Number(x.revenue.toFixed(2))
      })).sort((a,b)=>b.units-a.units||b.revenue-a.revenue||a.name.localeCompare(b.name)).slice(0,10);
      if(!cancelled){setRows(top);setSampled(partial);}
    }catch(e){if(!cancelled)setError(e instanceof Error?e.message:"อ่านยอดขายไม่สำเร็จ");}
    finally{if(!cancelled)setLoading(false);}
  }
  void load();
  return()=>{cancelled=true};
 },[tenantId,branchId,products]);
 return <div className="optical-stock-tables__overlay">
   <section role="dialog" aria-modal="true" aria-label="สินค้าขายดี" className="optical-stock-tables__dialog" style={{width:"min(720px,100%)"}}>
     <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}}>
       <h3>★ สินค้าขายดี 30 วันย้อนหลัง</h3><button onClick={onClose}>ปิด</button>
     </div>
     <p>{branchName} · อันดับจากจำนวนสินค้าที่ขายในบิลสำเร็จเท่านั้น</p>
     {loading?<p role="status">กำลังรวบรวมรายการ...</p>:null}
     {error?<p role="alert" style={{color:"#b91c1c"}}>{error}</p>:null}
     {sampled?<p role="note">จำนวนบิลมากกว่า 1,000 รายการ ข้อมูลแสดงอันดับจากบิลล่าสุด 1,000 รายการ</p>:null}
     {!loading&&!error?<div style={{overflowX:"auto",maxHeight:"55vh",overflowY:"auto"}}>
       <table className="productTable" style={{width:"100%"}}>
        <thead><tr><th>อันดับ</th><th>ชื่อสินค้า</th><th>จำนวนขาย</th><th>ยอดขาย ({currency})</th></tr></thead>
        <tbody>{rows.map((x,i)=><tr key={x.id}>
          <td>{i+1}</td><td>{x.name}</td><td>{x.units}</td>
          <td>{formatCurrency(x.revenue,currency)}</td>
        </tr>)}</tbody>
       </table>
       {rows.length===0?<p className="business-stock__empty">ไม่พบสินค้าขายดีในช่วงนี้</p>:null}
     </div>:null}
   </section>
 </div>;
}
