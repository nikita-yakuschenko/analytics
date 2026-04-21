const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3000;

const SOURCES = [
  { regionId: 52, url: "https://xn--h1aieheg.xn--d1aqf.xn--p1ai/analytics?regionId=52" },
  { regionId: 50, url: "https://xn--h1aieheg.xn--d1aqf.xn--p1ai/analytics?regionId=50" }
];

const DIST_DIR = path.join(__dirname, "dist");
app.use(express.static(DIST_DIR));

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

function formatNumber(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
    }
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.json();
}

async function fetchCatalogMap() {
  const params = CATALOG_TYPES.map((type) => `types=${encodeURIComponent(type)}`).join("&");
  const data = await fetchJson(`${API_BASE}/catalogs?${params}`);
  const catalogMap = new Map();
  for (const catalog of data.payload || []) {
    for (const item of catalog.items || []) {
      catalogMap.set(`${catalog.type}:${item.id}`, item.name);
    }
  }
  return catalogMap;
}

function pickTopRatios(payload, catalogMap) {
  const topItems = [];
  for (const [type, values] of Object.entries(payload || {})) {
    for (const [id, ratio] of Object.entries(values || {})) {
      topItems.push({
        key: `${type}:${id}`,
        type,
        id,
        ratio: Number(ratio) || 0,
        name: catalogMap.get(`${type}:${id}`) || `${type} #${id}`
      });
    }
  }

  return topItems
    .filter((item) => item.ratio > 0)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 12)
    .map((item) => ({
      label: item.name,
      type: item.type,
      value: `${formatNumber(item.ratio)}%`
    }));
}

function mapKpis(payload) {
  if (!payload) return [];
  const metricDefs = [
    ["projectsCount", "Проектов"],
    ["contractorsCount", "Подрядчиков"],
    ["avgTotalCost", "Средняя стоимость проекта"],
    ["avgHouseArea", "Средняя площадь дома"],
    ["projectsCountWithHouseAreaBefore100", "Проектов до 100 м2"],
    ["projectsCountWithHouseAreaBetween100And200", "Проектов 100-200 м2"],
    ["projectsCountWithHouseAreaAfter200", "Проектов более 200 м2"]
  ];

  return metricDefs
    .filter(([key]) => payload[key] !== undefined && payload[key] !== null)
    .map(([key, label]) => ({
      key,
      label,
      value:
        key.includes("Cost") || key.includes("Area")
          ? formatNumber(Number(payload[key]))
          : formatNumber(Number(payload[key]))
    }));
}

function mapAreaDistribution(payload) {
  const bars = [
    { label: "до 100", value: Number(payload?.projectsCountWithHouseAreaBefore100) || 0, color: "#85c23d" },
    {
      label: "101-200",
      value: Number(payload?.projectsCountWithHouseAreaBetween100And200) || 0,
      color: "#f0c73a"
    },
    {
      label: "201-300",
      value: Number(payload?.projectsCountWithHouseAreaBetween200And300) || 0,
      color: "#1c82e8"
    },
    { label: "от 301", value: Number(payload?.projectsCountWithHouseAreaAfter300) || 0, color: "#b4b8cc" }
  ];

  const max = bars.reduce((acc, item) => Math.max(acc, item.value), 0);
  return bars.map((item) => ({ ...item, percent: max > 0 ? Math.round((item.value / max) * 100) : 0 }));
}

function mapRatioGroup(payload, catalogMap, type) {
  const entries = Object.entries(payload?.[type] || {})
    .map(([id, ratio]) => ({
      id,
      ratio: Number(ratio) || 0,
      label: catalogMap.get(`${type}:${id}`) || `${type} #${id}`
    }))
    .filter((item) => item.ratio > 0)
    .sort((a, b) => b.ratio - a.ratio);

  const top = entries.slice(0, 5);
  const rest = entries.slice(5);
  const restRatioSum = rest.reduce((acc, item) => acc + item.ratio, 0);
  const mergedTop = [...top];
  if (restRatioSum > 0) {
    mergedTop.push({
      label: "Прочее",
      ratio: restRatioSum
    });
  }

  return {
    type,
    top: mergedTop.map((item) => ({
      label: item.label,
      value: `${formatNumber(item.ratio)}%`,
      ratio: item.ratio
    })),
    rest: []
  };
}

async function fetchRegionAnalytics(source, catalogMap) {
  const metricsData = await fetchJson(`${API_BASE}/business-metrics/for-portal?regionId=${source.regionId}`);
  const ratiosData = await fetchJson(
    `${API_BASE}/business-metrics/for-portal/ratios?regionId=${source.regionId}`
  );
  const metricsPayload = metricsData.payload || {};
  const ratioPayload = ratiosData.payload || {};

  return {
    regionId: source.regionId,
    regionName: catalogMap.get(`REGION:${source.regionId}`) || `Регион ${source.regionId}`,
    sourceUrl: source.url,
    pageTitle: "Статистика по индивидуальному жилищному строительству",
    fetchedAt: new Date().toISOString(),
    projectsCount: Number(metricsPayload.projectsCount) || 0,
    projectsCountFormatted: formatNumber(Number(metricsPayload.projectsCount) || 0),
    kpis: mapKpis(metricsPayload),
    avgHouseArea: formatNumber(Number(metricsPayload.avgHouseArea) || 0),
    avgTotalCost: formatNumber(Number(metricsPayload.avgTotalCost) || 0),
    areaDistribution: mapAreaDistribution(metricsPayload),
    materialsTabs: [
      mapRatioGroup(ratioPayload, catalogMap, "OUTER_WALL_MATERIAL"),
      mapRatioGroup(ratioPayload, catalogMap, "FACADE_MATERIAL"),
      mapRatioGroup(ratioPayload, catalogMap, "ROOF_MATERIAL"),
      mapRatioGroup(ratioPayload, catalogMap, "SLAB_TYPE"),
      mapRatioGroup(ratioPayload, catalogMap, "INTERNAL_BULKHEAD_MATERIAL")
    ],
    otherTabs: [
      mapRatioGroup(ratioPayload, catalogMap, "ARCHITECTURAL_STYLE"),
      mapRatioGroup(ratioPayload, catalogMap, "INTERIOR"),
      mapRatioGroup(ratioPayload, catalogMap, "FOUNDATION_TYPE")
    ],
    topRatios: pickTopRatios(ratioPayload, catalogMap)
  };
}

app.get("/api/analytics", async (req, res) => {
  try {
    const catalogMap = await fetchCatalogMap();
    const results = [];
    for (const source of SOURCES) {
      const regionData = await fetchRegionAnalytics(source, catalogMap);
      results.push(regionData);
    }
    res.json({
      ok: true,
      total: results.length,
      generatedAt: new Date().toISOString(),
      regions: results
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Не удалось получить данные аналитики",
      details: error.message
    });
  } finally {
    // nothing to release
  }
});

app.get(/.*/, (req, res) => {
  const indexFile = path.join(DIST_DIR, "index.html");
  if (fs.existsSync(indexFile)) {
    res.sendFile(indexFile);
    return;
  }
  res
    .status(503)
    .send("Frontend is not built yet. Run `npm run build` and restart the server.");
});

app.listen(PORT, () => {
  console.log(`Server started at http://localhost:${PORT}`);
});
