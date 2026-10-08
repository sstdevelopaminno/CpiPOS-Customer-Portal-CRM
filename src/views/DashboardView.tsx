import { useCallback, useEffect, useState } from "react";
import { Banknote, Boxes, Clock3, LoaderCircle, ReceiptText, RefreshCw, Store, TrendingUp, Warehouse } from "lucide-react";
import { loadDashboard, reportRangeLabel, type DashboardSummary, type OrderRow, type PortalContext, type ReportRange } from "../lib/portal";
import { MetricCard, Empty, ErrorPanel } from "../components/common";
import { TopicHub } from "../components/TopicHub";
import { money, number, dateTime, amount } from "../lib/formatters";

export function DashboardView({ context, branchId, range, anchor }: { context: PortalContext; branchId: string | null; range: ReportRange; anchor: string }) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await loadDashboard(context.tenantId, branchId, range, anchor);
      setSummary(data.summary);
      setOrders(data.recentOrders);
    } catch {
      setError("ไม่สามารถโหลดข้อมูลภาพรวมได้ กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }, [context.tenantId, branchId, range, anchor]);

  useEffect(() => { void refresh(); }, [refresh]);

  const topProducts = summary?.top_products ?? [];
  const maxTopSale = Math.max(1, ...topProducts.map(item=>Number(item.sales_total || 0)));
  const periodLabel = reportRangeLabel(range, anchor);

  if (loading && !summary) return <div className="loadingPanel"><LoaderCircle className="spin"/>กำลังโหลด Dashboard...</div>;

  return <>
    <div className="pageHeading">
      <div><p className="eyebrow">SALES OVERVIEW</p><h2>ภาพรวม</h2><p>ยอดขายและสถานะการดำเนินงานตามสาขาและช่วงเวลาที่เลือก</p></div>
      <button className="ghostButton" onClick={()=>void refresh()}><RefreshCw size={18}/>รีเฟรช</button>
    </div>
    {error ? <ErrorPanel message={error}/> : null}
    <section className="metricsGrid">
      <MetricCard icon={<Banknote/>} label="ยอดขาย" value={money.format(summary?.sales_total??0)} helper={periodLabel}/>
      <MetricCard icon={<ReceiptText/>} label="จำนวนบิล" value={number.format(summary?.order_count??0)} helper="เฉพาะรายการในช่วงที่เลือก"/>
      <MetricCard icon={<TrendingUp/>} label="ยอดเฉลี่ยต่อบิล" value={money.format(summary?.average_ticket??0)} helper="Average ticket"/>
      <MetricCard icon={<Clock3/>} label="กะที่เปิดอยู่" value={number.format(summary?.open_shifts??0)} helper="สถานะปัจจุบัน"/>
    </section>

    <TopicHub label="รายละเอียดและรายงาน" items={[
      {id:"recent",title:"บิลล่าสุด",description:"รายการขายและยอดเงินตามช่วงเวลา",icon:<ReceiptText size={22}/>,count:`${orders.length} บิลล่าสุด`,content:<article className="panel">
        <div className="panelHeader"><div><p className="eyebrow">RECENT SALES</p><h3>บิลล่าสุด</h3></div></div>
        {orders.length ? <div className="rows dashboardScroll">{orders.map(order=><div className="dataRow" key={order.id}><div><strong>{order.order_no||"รายการขาย"}</strong><span>{dateTime.format(new Date(order.created_at))}</span></div><div className="rowAmount"><strong>{money.format(amount(order))}</strong><span>{order.order_type||order.channel||"POS"}</span></div></div>)}</div> : <Empty>ยังไม่มีรายการขายในช่วงเวลานี้</Empty>}
      </article>},
      {id:"health",title:"สถานะร้าน",description:"สาขา สินค้า และวัตถุดิบที่ต้องสั่งซื้อ",icon:<Store size={22}/>,content:<article className="panel">
        <div className="panelHeader"><div><p className="eyebrow">STORE HEALTH</p><h3>สถานะร้าน</h3></div></div>
        <div className="healthList">
          <div><span><Store size={19}/>สาขาที่เปิดใช้งาน</span><strong>{summary?.active_branches??0}</strong></div>
          <div><span><Boxes size={19}/>สินค้าที่เปิดขาย</span><strong>{summary?.active_products??0}</strong></div>
          <div className={(summary?.low_stock_count??0)>0?"warn":""}><span><Warehouse size={19}/>วัตถุดิบถึงจุดสั่งซื้อ</span><strong>{summary?.low_stock_count??0}</strong></div>
        </div>
      </article>},
      {id:"top",title:"สินค้าขายดี",description:"อันดับยอดขายและจำนวนสินค้า",icon:<TrendingUp size={22}/>,count:`${topProducts.length} รายการ`,content:<article className="panel topProductsPanel">
      <div className="panelHeader"><div><p className="eyebrow">TOP PRODUCTS</p><h3>สินค้าขายดี</h3></div></div>
      {topProducts.length ? <div className="topProductsList dashboardScroll">{topProducts.map((item,index)=>{
        const width=Math.max(8,(Number(item.sales_total||0)/maxTopSale)*100);
        return <div className="topProductRow" key={item.name+"-"+index}>
          <div className="topProductRank">{index+1}</div>
          <div className="topProductMain">
            <div className="topProductMeta"><strong>{item.name}</strong><span>{number.format(Number(item.quantity||0))} ชิ้น · {money.format(Number(item.sales_total||0))}</span></div>
            <div className="topProductTrack"><div className="topProductBar" style={{width:`${width}%`}}/></div>
          </div>
        </div>;
      })}</div> : <Empty>ยังไม่มีข้อมูลสินค้าขายดีในช่วงเวลานี้</Empty>}
    </article>}
    ]}/>
  </>;
}
