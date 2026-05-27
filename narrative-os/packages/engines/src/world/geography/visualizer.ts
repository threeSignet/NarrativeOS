import type { SettingItem } from "@narrative-os/database";
import type { GeographyMapNode, GeographyMapData, MapScale, GeographyRelation } from "./types";

const SCALE_ORDER: MapScale[] = [
  "universe", "galaxy", "star_system", "planet",
  "continent", "region", "city", "district", "scene",
];

const SCALE_LABELS: Record<MapScale, string> = {
  universe: "宇宙", galaxy: "星系", star_system: "恒星系",
  planet: "星球", continent: "大陆", region: "区域",
  city: "城市", district: "街区", scene: "场景",
};

export { SCALE_ORDER, SCALE_LABELS };

export function getNodesByScale(nodes: GeographyMapNode[], scale: MapScale): GeographyMapNode[] {
  return nodes.filter((n) => n.scale === scale);
}

export function getNodeTree(nodes: GeographyMapNode[]): GeographyMapNode[] {
  const nodeMap = new Map<string, GeographyMapNode>();
  const roots: GeographyMapNode[] = [];

  for (const node of nodes) {
    nodeMap.set(node.id, { ...node, children: [] });
  }

  for (const node of nodeMap.values()) {
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export function buildMapData(
  settingItems: SettingItem[],
  relations: { sourceItemId: string; targetItemId: string; relationType: string; label: string | null }[],
): GeographyMapData {
  const geographyItems = settingItems.filter(
    (i) => i.type === "geography" && i.status === "confirmed",
  );

  const itemMap = new Map(geographyItems.map((i) => [i.id, i]));
  const nameMap = new Map(geographyItems.map((i) => [i.name, i]));

  const nodes: GeographyMapNode[] = geographyItems.map((item) => {
    const content = (item.content || {}) as Record<string, any>;
    const parentId = content.parentName
      ? nameMap.get(content.parentName)?.id ?? null
      : item.parentItemId ?? null;

    return {
      id: item.id,
      name: item.name,
      subtype: (item.itemSubtype as GeographyMapNode["subtype"]) || "location",
      scale: (content.scale as MapScale) || "region",
      x: content.coordinates?.x ?? Math.random() * 800 + 100,
      y: content.coordinates?.y ?? Math.random() * 800 + 100,
      parentId,
      children: [],
      summary: item.summary || "",
      content,
    };
  });

  const geoRelations: GeographyRelation[] = relations
    .filter((r) => itemMap.has(r.sourceItemId) && itemMap.has(r.targetItemId))
    .map((r) => ({
      sourceName: itemMap.get(r.sourceItemId)!.name,
      targetName: itemMap.get(r.targetItemId)!.name,
      relationType: (r.relationType as GeographyRelation["relationType"]) || "geographic",
      label: r.label || "",
    }));

  const currentScale = inferScale(nodes);

  return { nodes, relations: geoRelations, currentScale };
}

function inferScale(nodes: GeographyMapNode[]): MapScale {
  const scales = new Set(nodes.map((n) => n.scale));
  for (const s of SCALE_ORDER) {
    if (scales.has(s)) return s;
  }
  return "region";
}

export function getZoomLevel(scale: MapScale): number {
  return SCALE_ORDER.indexOf(scale);
}

export function canZoomIn(scale: MapScale): boolean {
  return getZoomLevel(scale) < SCALE_ORDER.length - 1;
}

export function canZoomOut(scale: MapScale): boolean {
  return getZoomLevel(scale) > 0;
}

export function zoomIn(scale: MapScale): MapScale {
  const idx = getZoomLevel(scale);
  return SCALE_ORDER[Math.min(idx + 1, SCALE_ORDER.length - 1)];
}

export function zoomOut(scale: MapScale): MapScale {
  const idx = getZoomLevel(scale);
  return SCALE_ORDER[Math.max(idx - 1, 0)];
}

export function getChildScales(scale: MapScale): MapScale[] {
  const idx = getZoomLevel(scale);
  return SCALE_ORDER.slice(idx + 1);
}
