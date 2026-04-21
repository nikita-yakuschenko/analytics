import { NextResponse } from "next/server";

const SOURCES = [
  { regionId: 52, url: "https://xn--h1aieheg.xn--d1aqf.xn--p1ai/analytics?regionId=52" },
  { regionId: 50, url: "https://xn--h1aieheg.xn--d1aqf.xn--p1ai/analytics?regionId=50" }
];

const API_BASE = "https://xn--h1aieheg.xn--d1aqf.xn--p1ai/api/v1";
const CATALOG_TYPES = [
  "SLAB_TYPE",
  "ROOF_MATERIAL",
  "FOUNDATION_TYPE",
  "OUTER_WALL_MATERIAL",
  "INTERNAL_BULKHEAD_MATERIAL",
  "PROJECT_TYPE",
  "FACADE_MATERIAL",
  "ARCHITECTURAL_STYLE",
  "INTERIOR",
  "ROOF_TYPE",
  "HEATING",
  "HEAT_SUPPLY",
  "WATER_SUPPLY",
  "VENTILATION",
  "REGION"
];

const formatNumber = (value: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);

async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
    },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

async function fetchCatalogMap() {
  const params = CATALOG_TYPES.map((type) => `types=${encodeURIComponent(type)}`).join("&");
  const data = await fetchJson(`${API_BASE}/catalogs?${params}`);
  const map = new Map<string, string>();
  for (const catalog of data.payload || []) {
    for (const item of catalog.items || []) {
      map.set(`${catalog.type}:${item.id}`, item.name);
    }
  }
  return map;
}

function mapAreaDistribution(payload: Record<string, number>) {
  const bars = [
    { label: "до 100", value: Number(payload?.projectsCountWithHouseAreaBefore100) || 0, color: "#85c23d" },
    { label: "101-200", value: Number(payload?.projectsCountWithHouseAreaBetween100And200) || 0, color: "#f0c73a" },
    { label: "201-300", value: Number(payload?.projectsCountWithHouseAreaBetween200And300) || 0, color: "#1c82e8" },
    { label: "от 301", value: Number(payload?.projectsCountWithHouseAreaAfter300) || 0, color: "#b4b8cc" }
  ];
  const max = Math.max(...bars.map((x) => x.value), 0);
  return bars.map((x) => ({ ...x, percent: max > 0 ? Math.round((x.value / max) * 100) : 0 }));
}

function mapRatioGroup(payload: Record<string, Record<string, number>>, catalogMap: Map<string, string>, type: string) {
  const entries = Object.entries(payload?.[type] || {})
    .map(([id, ratio]) => ({
      id,
      label: catalogMap.get(`${type}:${id}`) || `${type} #${id}`,
      ratio: Number(ratio) || 0
    }))
    .filter((x) => x.ratio > 0)
    .sort((a, b) => b.ratio - a.ratio);

  const top = entries.slice(0, 5);
  const restSum = entries.slice(5).reduce((acc, item) => acc + item.ratio, 0);
  if (restSum > 0) top.push({ id: "other", label: "Прочее", ratio: restSum });

  return {
    type,
    top: top.map((item) => ({ label: item.label, ratio: item.ratio, value: `${formatNumber(item.ratio)}%` })),
    rest: []
  };
}

async function fetchRegion(source: { regionId: number; url: string }, catalogMap: Map<string, string>) {
  const metricsData = await fetchJson(`${API_BASE}/business-metrics/for-portal?regionId=${source.regionId}`);
  const ratiosData = await fetchJson(`${API_BASE}/business-metrics/for-portal/ratios?regionId=${source.regionId}`);
  const metrics = metricsData.payload || {};
  const ratios = ratiosData.payload || {};

  return {
    regionId: source.regionId,
    regionName: catalogMap.get(`REGION:${source.regionId}`) || `Регион ${source.regionId}`,
    sourceUrl: source.url,
    avgHouseArea: formatNumber(Number(metrics.avgHouseArea) || 0),
    avgTotalCost: formatNumber(Number(metrics.avgTotalCost) || 0),
    projectsCountFormatted: formatNumber(Number(metrics.projectsCount) || 0),
    areaDistribution: mapAreaDistribution(metrics),
    materialsTabs: [
      mapRatioGroup(ratios, catalogMap, "OUTER_WALL_MATERIAL"),
      mapRatioGroup(ratios, catalogMap, "FACADE_MATERIAL"),
      mapRatioGroup(ratios, catalogMap, "ROOF_MATERIAL"),
      mapRatioGroup(ratios, catalogMap, "SLAB_TYPE"),
      mapRatioGroup(ratios, catalogMap, "INTERNAL_BULKHEAD_MATERIAL")
    ],
    otherTabs: [
      mapRatioGroup(ratios, catalogMap, "ARCHITECTURAL_STYLE"),
      mapRatioGroup(ratios, catalogMap, "INTERIOR"),
      mapRatioGroup(ratios, catalogMap, "FOUNDATION_TYPE")
    ]
  };
}

export async function GET() {
  try {
    const catalogMap = await fetchCatalogMap();
    const regions = [];
    for (const source of SOURCES) {
      regions.push(await fetchRegion(source, catalogMap));
    }
    return NextResponse.json({
      ok: true,
      total: regions.length,
      generatedAt: new Date().toISOString(),
      regions
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: "Не удалось получить данные аналитики", details: (error as Error).message },
      { status: 500 }
    );
  }
}
