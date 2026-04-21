import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const REGION_NAME_BY_ID = {
  50: "Московская область",
  52: "Нижегородская область"
};

const TAB_LABELS = {
  OUTER_WALL_MATERIAL: "Внешние стены",
  FACADE_MATERIAL: "Фасад",
  ROOF_MATERIAL: "Кровля",
  SLAB_TYPE: "Перекрытия",
  INTERNAL_BULKHEAD_MATERIAL: "Внутренние перегородки",
  ARCHITECTURAL_STYLE: "Архитектурный стиль",
  INTERIOR: "Тип отделки",
  FOUNDATION_TYPE: "Тип фундамента"
};

const DONUT_COLORS = ["#85c23d", "#f0c73a", "#1c82e8", "#f3923f", "#d7e7f4", "#afb4cb"];
const formatPercent = (value) =>
  `${new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}%`;
const KPI_VALUE_CLASS =
  "mt-2 max-w-full whitespace-nowrap text-[clamp(24px,2.2vw,40px)] font-medium leading-none text-accent";

function buildDonutStyle(items = []) {
  const slices = items.slice(0, 6).map((item, index) => ({
    ratio: Number(item.ratio) || 0,
    color: DONUT_COLORS[index] || "#bcc2d8"
  }));
  if (slices.length === 0) return {};
  let acc = 0;
  const parts = slices.map((slice) => {
    const start = acc;
    acc += slice.ratio;
    return `${slice.color} ${start}% ${acc}%`;
  });
  if (acc < 100) parts.push(`#c5cada ${acc}% 100%`);
  return { background: `conic-gradient(${parts.join(", ")})` };
}

function Legend({ group }) {
  const allItems = [...(group?.top || []), ...(group?.rest || [])];
  const firstFive = allItems.slice(0, 5);
  const restSum = allItems
    .slice(5)
    .reduce((acc, item) => acc + (Number(item.ratio) || 0), 0);
  const top = restSum > 0 ? [...firstFive, { label: "Прочее", ratio: restSum, value: formatPercent(restSum) }] : firstFive;
  return (
    <>
      <ul className="space-y-1">
        {top.length === 0 ? (
          <li className="text-sm text-muted">Нет данных</li>
        ) : (
          top.map((item, idx) => (
            <li key={`${item.label}-${idx}`} className="grid grid-cols-[16px_1fr_auto] items-center gap-2 text-sm">
              <span className="h-[16px] w-[16px] rounded-[4px]" style={{ background: DONUT_COLORS[idx] }} />
              <span>{item.label}</span>
              <strong>{item.value ?? formatPercent(Number(item.ratio) || 0)}</strong>
            </li>
          ))
        )}
      </ul>
    </>
  );
}

function RatioTabs({ title, tabs, selectedType, onTypeChange }) {
  const defaultType = tabs?.[0]?.type;
  if (!defaultType) {
    return (
      <Card className="mt-3">
        <CardContent>
          <h3 className="mb-2 text-2xl font-semibold">{title}</h3>
          <p className="text-sm text-muted">Нет данных</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-2">
      <CardContent className="p-3">
        <h3 className="mb-2 text-xl font-semibold">{title}</h3>
        <Tabs defaultValue={defaultType} value={selectedType || defaultType} onValueChange={onTypeChange}>
          <TabsList className="mb-2">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.type} value={tab.type}>
                {TAB_LABELS[tab.type] || tab.type}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((tab) => (
            <TabsContent key={tab.type} value={tab.type} className="grid gap-3 md:grid-cols-[130px_1fr]">
              <div className="flex justify-center">
                <div className="relative h-[112px] w-[112px] rounded-full" style={buildDonutStyle(tab.top)}>
                  <div className="absolute inset-[28px] rounded-full bg-card" />
                </div>
              </div>
              <Legend group={tab} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default function App() {
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [linkedTabs, setLinkedTabs] = useState({
    materials: null,
    other: null
  });

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/analytics");
      if (!response.ok) throw new Error(`Ошибка запроса: ${response.status}`);
      const payload = await response.json();
      setRegions(payload.regions || []);
    } catch (e) {
      setError(e.message || "Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const displayedRegions = [...regions].sort((a, b) => {
    const order = { 52: 0, 50: 1 };
    const aOrder = order[a.regionId] ?? 99;
    const bOrder = order[b.regionId] ?? 99;
    return aOrder - bOrder;
  });

  return (
    <main className="mx-auto h-screen max-w-[1680px] overflow-hidden p-4 text-text">
      <header className="mb-3 flex flex-col justify-between gap-3 md:flex-row">
        <div>
          <h1 className="text-2xl font-semibold">Статистика по сегменту ИЖС по данным банка ДОМ.РФ</h1>
        </div>
        <Button onClick={loadData} disabled={loading}>
          {loading ? "Обновление..." : "Обновить данные"}
        </Button>
      </header>

      {error && <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-700">{error}</div>}

      <section className="grid h-[calc(100vh-88px)] gap-3 lg:grid-cols-2">
        {displayedRegions.map((region) => {
          const regionTitle = region.regionName || REGION_NAME_BY_ID[region.regionId] || `Регион ${region.regionId}`;
          const avgHouseArea = region.avgHouseArea || "—";
          const avgTotalCost = region.avgTotalCost || "—";
          const projectsCount = region.projectsCountFormatted || "0";
          const areaDistribution = Array.isArray(region.areaDistribution) ? region.areaDistribution : [];
          const materialsTabs = Array.isArray(region.materialsTabs) ? region.materialsTabs : [];
          const otherTabs = Array.isArray(region.otherTabs) ? region.otherTabs : [];

          return (
            <article
              key={region.regionId}
              className="h-full overflow-hidden rounded-2xl border border-[#dde3cd] bg-region p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-[21px] font-semibold">{regionTitle}</h2>
                <div className="whitespace-nowrap text-base text-muted">{projectsCount} проектов</div>
              </div>

              <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_1.2fr]">
                <div className="grid gap-2">
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-base font-semibold">Средняя площадь дома</p>
                      <p className={KPI_VALUE_CLASS}>
                        {avgHouseArea} м²
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-base font-semibold">Средняя стоимость дома</p>
                      <p className={KPI_VALUE_CLASS}>
                        {avgTotalCost}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardContent className="p-3">
                    <h3 className="mb-2 text-base font-semibold">Площадь домов по диапазонам</h3>
                    <div className="space-y-1.5">
                      {areaDistribution.map((bar) => (
                        <div key={bar.label} className="grid grid-cols-[56px_1fr_72px] items-center gap-2 text-sm">
                          <span className="text-[#666d7a]">{bar.label}</span>
                          <div className="h-2 w-full rounded-full bg-[#dfe3ea]">
                            <div className="h-2 rounded-full" style={{ width: `${bar.percent || 0}%`, background: bar.color }} />
                          </div>
                          <span className="text-right font-semibold tabular-nums text-[#606776]">
                            {Number(bar.value).toLocaleString("ru-RU")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="mt-2">
                <RatioTabs
                  title="Материалы"
                  tabs={materialsTabs}
                  selectedType={linkedTabs.materials}
                  onTypeChange={(type) => setLinkedTabs((prev) => ({ ...prev, materials: type }))}
                />
              </div>
              <div className="mt-2">
                <RatioTabs
                  title="Другие характеристики"
                  tabs={otherTabs}
                  selectedType={linkedTabs.other}
                  onTypeChange={(type) => setLinkedTabs((prev) => ({ ...prev, other: type }))}
                />
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
