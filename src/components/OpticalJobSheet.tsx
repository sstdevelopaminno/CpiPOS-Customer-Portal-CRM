import {OpticalWorkOrderBarcode} from "./OpticalWorkOrderBarcode";
import {formatCurrency} from "../lib/formatters";
import {opticalText} from "../lib/optical-locale";
import type {CrmSettingsLanguage} from "../lib/settings-language";

export type OpticalJobLine={id:string;description_snapshot:string;sku_snapshot:string|null;quantity:number;unit_price:number;line_total:number};
export type OpticalJobCustomer={full_name:string;customer_code:string};
type Props={
  order:{id:string;status:string;currency_code:string;total_amount:number;paid_total:number;due_at:string|null};
  customer:OpticalJobCustomer;
  lines:OpticalJobLine[];
  tenantName:string;
  language:CrmSettingsLanguage;
};

/** Print-only job sheet; no payment QR, cashier action or customer medical record. */
export function OpticalJobSheet({order,customer,lines,tenantName,language}:Props){
  const T=(s:string)=>opticalText(language,s);
  return <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" id="optical-job-print-sheet">
    <style>{`@media print {
      body * { visibility: hidden !important; }
      #optical-job-print-sheet, #optical-job-print-sheet * { visibility: visible !important; }
      #optical-job-print-sheet { position: absolute; left: 0; top: 0; width: 100%; padding: 18px; border: 0; color: #000; background: #fff; }
      #optical-job-print-sheet .no-print { display: none !important; }
    }`}</style>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="text-lg font-bold">{T("ใบสั่งงานแว่นตา")} · {tenantName}</h3>
        <p className="text-xs text-slate-600">{customer.full_name} · {customer.customer_code}</p></div>
      <button type="button" className="no-print rounded-lg border border-emerald-700 px-4 py-2 font-bold text-emerald-800"
        onClick={()=>window.print()}>{language==="en"?"Print work order":language==="lo"?"ພິມໃບງານ":"พิมพ์ใบงาน"}</button>
    </div>
    <OpticalWorkOrderBarcode id={order.id}/>
    <div className="flex flex-wrap gap-3 text-sm">
      <span>{T("สถานะ")}: {T(order.status)}</span>
      <span>{T("นัดรับ")}: {order.due_at?new Date(order.due_at).toLocaleDateString(language==="lo"?"lo-LA":language==="en"?"en-US":"th-TH"):"—"}</span>
    </div>
    <table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-300">
      <th className="p-2">{T("รายการ")}</th><th className="p-2">SKU</th><th className="p-2">{language==="en"?"Qty":language==="lo"?"ຈຳນວນ":"จำนวน"}</th>
      <th className="p-2">{T("ยอดเต็ม")}</th>
    </tr></thead><tbody>{lines.map(line=><tr key={line.id} className="border-b border-slate-100">
      <td className="p-2">{line.description_snapshot}</td><td className="p-2">{line.sku_snapshot??"—"}</td>
      <td className="p-2">{line.quantity}</td><td className="p-2">{formatCurrency(line.line_total,order.currency_code)}</td>
    </tr>)}</tbody></table>
    <div className="flex flex-wrap justify-end gap-4 text-sm font-bold">
      <span>{T("ยอดเต็ม")}: {formatCurrency(order.total_amount,order.currency_code)}</span>
      <span>{T("ค้างชำระ")}: {formatCurrency(order.total_amount-order.paid_total,order.currency_code)}</span>
    </div>
    <p className="text-xs text-slate-500">Work-order locator only · not a receipt or proof of payment</p>
  </section>;
}
