import { useState, type ReactNode } from "react";
import { ChevronRight, FolderOpen } from "lucide-react";
import { Modal } from "./common";

export type TopicItem = {
  id: string;
  title: string;
  description: string;
  count?: string;
  icon?: ReactNode;
  content?: ReactNode;
  onSelect?: () => void;
  wide?: boolean;
};

export function TopicHub({ items, label = "เลือกหัวข้อที่ต้องการจัดการ" }: { items: readonly TopicItem[]; label?: string }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = items.find(item => item.id === activeId);
  return <>
    <section className="topicHub" aria-label={label}>
      <div className="topicHubIntro"><h3>{label}</h3><p>เลือกหัวข้อเพื่อเปิดรายละเอียดในหน้าต่าง โดยไม่ต้องเลื่อนอ่านทุกส่วนในหน้าเดียว</p></div>
      <div className="topicHubGrid">
        {items.map(item => <button
          type="button"
          key={item.id}
          className="topicCard"
          onClick={() => item.onSelect ? item.onSelect() : setActiveId(item.id)}
          aria-haspopup={item.onSelect ? undefined : "dialog"}
        >
          <span className="topicCardIcon" aria-hidden="true">{item.icon ?? <FolderOpen size={21}/>}</span>
          <span className="topicCardCopy"><strong>{item.title}</strong><small>{item.description}</small>{item.count ? <em>{item.count}</em> : null}</span>
          <ChevronRight className="topicCardArrow" size={19}/>
        </button>)}
      </div>
    </section>
    {active && !active.onSelect && active.content ? <Modal title={active.title} subtitle={active.description} onClose={() => setActiveId(null)} wide={active.wide !== false}>
      <div className="topicModalBody">{active.content}</div>
    </Modal> : null}
  </>;
}
