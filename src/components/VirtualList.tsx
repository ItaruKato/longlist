import { useEffect, useRef, useState, type ReactNode } from 'react';

/** たくさんの行を、見えている分だけ描く一覧（5万社でも軽く動くように） */
export function VirtualList<T>({
  items,
  rowHeight,
  render,
  resetKey,
  className,
}: {
  items: T[];
  rowHeight: number;
  render: (item: T, index: number) => ReactNode;
  resetKey: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(0);
  const [height, setHeight] = useState(800);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // 絞り込みや並び順が変わったら先頭に戻る
  useEffect(() => {
    ref.current?.scrollTo({ top: 0 });
    setTop(0);
  }, [resetKey]);
  const start = Math.max(0, Math.floor(top / rowHeight) - 8);
  const end = Math.min(items.length, Math.ceil((top + height) / rowHeight) + 8);
  return (
    <div ref={ref} className={`vlist ${className ?? ''}`} onScroll={(e) => setTop(e.currentTarget.scrollTop)}>
      <div style={{ height: items.length * rowHeight, position: 'relative' }}>
        {items.slice(start, end).map((it, i) => (
          <div key={start + i} style={{ position: 'absolute', top: (start + i) * rowHeight, left: 0, right: 0, height: rowHeight }}>
            {render(it, start + i)}
          </div>
        ))}
      </div>
    </div>
  );
}
