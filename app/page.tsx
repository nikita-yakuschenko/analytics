"use client";

import { useEffect, useMemo, useState } from "react";

type RatioItem = { label: string; value: string; ratio: number };
type RatioGroup = { type: string; top: RatioItem[] };
type AreaBar = { label: string; value: number; percent: number; color: string };
type Region = {
  regionId: number;
  regionName?: string;
  avgHouseArea?: string;
  avgTotalCost?: string;
  projectsCountFormatted?: string;
  areaDistribution: AreaBar[];
  materialsTabs: RatioGroup[];
  otherTabs: RatioGroup[];
};

const TAB_LABELS: Record<string, string> = {
  OUTER_WALL_MATERIAL: "Внешние стены",
  FACADE_MATERIAL: "Фасад",
  ROOF_MATERIAL: "Кровля",
  SLAB_TYPE: "Перекрытия",
  INTERNAL_BULKHEAD_MATERIAL: "Внутренние перегородки",
  ARCHITECTURAL_STYLE: "Архитектурный стиль",
  INTERIOR: "Тип отделки",
  FOUNDATION_TYPE: "Тип фундамента"
};

const COLORS = ["#85c23d", "#f0c73a", "#1c82e8", "#f3923f", "#d7e7f4", "#afb4cb"];

function donutBackground(items: RatioItem[]) {
  let sum = 0;
  const parts = items.slice(0, 6).map((item, i) => {
    const from = sum;
    sum += Number(item.ratio) || 0;
    return `${COLORS[i]} ${from}% ${sum}%`;
  });
  if (sum < 100) parts.push(`#c5cada ${sum}% 100%`);
  return `conic-gradient(${parts.join(", ")})`;
}

function RatioWidget({
  title,
  groups,
  activeType,
  onChange
}: {
  title: string;
  groups: RatioGroup[];
  activeType: string | null;
  onChange: (value: string) => void;
}) {
  const safeType = activeType && groups.some((g) => g.type === activeType) ? activeType : groups[0]?.type;
  const group = groups.find((g) => g.type === safeType);
  if (!group) return null;

  return (
    <div className="card tabs-block">
      <h3>{title}</h3>
      <div className="tabs">
        {groups.map((g) => (
          <button key={g.type} className={`tab ${safeType === g.type ? "active" : ""}`} onClick={() => onChange(g.type)}>
            {TAB_LABELS[g.type] ?? g.type}
          </button>
        ))}
      </div>
      <div className="ratio-content">
        <div className="donut" style={{ background: donutBackground(group.top) }} />
        <div>
          {group.top.map((item, i) => (
            <div key={`${item.label}-${i}`} className="legend-item">
              <span className="dot" style={{ background: COLORS[i] }} />
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(false);
  const [materialsTab, setMaterialsTab] = useState<string | null>(null);
  const [otherTab, setOtherTab] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/analytics");
    const data = await res.json();
    setRegions(data.regions ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const ordered = useMemo(() => {
    const order: Record<number, number> = { 52: 0, 50: 1 };
    return [...regions].sort((a, b) => (order[a.regionId] ?? 99) - (order[b.regionId] ?? 99));
  }, [regions]);

  return (
    <main className="app">
      <header className="topbar">
        <h1>Статистика по сегменту ИЖС по данным банка ДОМ.РФ</h1>
        <button className="btn" onClick={load} disabled={loading}>
          {loading ? "Обновление..." : "Обновить данные"}
        </button>
      </header>
      <section className="grid2">
        {ordered.map((region) => (
          <article key={region.regionId} className="region">
            <div className="region-head">
              <h2>{region.regionName ?? `Регион ${region.regionId}`}</h2>
              <div className="muted">{region.projectsCountFormatted ?? "0"} проектов</div>
            </div>

            <div className="kpi-row">
              <div className="kpi-left">
                <div className="card">
                  <h3>Средняя площадь дома</h3>
                  <p className="kpi-value">{region.avgHouseArea ?? "—"} м²</p>
                </div>
                <div className="card">
                  <h3>Средняя стоимость дома</h3>
                  <p className="kpi-value">{region.avgTotalCost ?? "—"}</p>
                </div>
              </div>
              <div className="card">
                <h3>Площадь домов по диапазонам</h3>
                <div className="bars">
                  {region.areaDistribution?.map((bar) => (
                    <div key={bar.label} className="bar-row">
                      <span className="muted">{bar.label}</span>
                      <div className="track">
                        <div className="fill" style={{ width: `${bar.percent}%`, background: bar.color }} />
                      </div>
                      <strong style={{ textAlign: "right" }}>{Number(bar.value).toLocaleString("ru-RU")}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <RatioWidget title="Материалы" groups={region.materialsTabs ?? []} activeType={materialsTab} onChange={setMaterialsTab} />
            <RatioWidget title="Другие характеристики" groups={region.otherTabs ?? []} activeType={otherTab} onChange={setOtherTab} />
          </article>
        ))}
      </section>
    </main>
  );
}
