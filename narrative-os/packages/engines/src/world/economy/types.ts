/**
 * 经济体系 — 类型定义
 *
 * 覆盖资源分布、货币系统、贸易路线、市场、商会/行会
 * 为势力冲突提供经济动机，为物品定价提供参考系
 */
export type EconomySubtype = "resource" | "currency" | "trade_route" | "market" | "guild";

export interface EconomyItem {
  subtype: EconomySubtype;
  name: string;
  summary: string;
  content: {
    // ── resource（资源）──
    /** 资源类型：mineral/herb/animal/magical/energy/strategic/luxury */
    resource_type?: "mineral" | "herb" | "animal" | "magical" | "energy" | "strategic" | "luxury";
    /** 主要产地（必须使用地理引擎中已确认的区域名） */
    source_regions?: string[];
    /** 稀缺度：abundant/common/uncommon/rare/extremely_rare/near_extinct */
    scarcity?: "abundant" | "common" | "uncommon" | "rare" | "extremely_rare" | "near_extinct";
    /** 主要用途 */
    uses?: string[];
    /** 控制该资源的势力（必须使用已确认的势力名） */
    controlled_by?: string[];
    /** 采集/开采难度 */
    extraction_difficulty?: string;
    /** 是否可以再生 */
    renewable?: boolean;

    // ── currency（货币）──
    /** 货币形式：coin/stone/crystal/energy/barter/credit */
    currency_form?: "coin" | "stone" | "crystal" | "energy" | "barter" | "credit";
    /** 发行方（必须使用已确认的势力名） */
    issued_by?: string;
    /** 流通范围（必须使用已确认的区域名/势力名） */
    circulation_area?: string[];
    /** 与其他货币的兑换关系 */
    exchange_rate?: string;
    /** 货币的内在价值支撑（黄金/灵石/信用等） */
    value_backing?: string;
    /** 是否有假币/劣币问题 */
    counterfeiting_issue?: string;

    // ── trade_route（贸易路线）──
    /** 运输方式：caravan/ship/airship/teleportation/caravan_beast */
    transport_method?: "caravan" | "ship" | "airship" | "teleportation" | "caravan_beast";
    /** 起始地点（必须使用已确认的地点名） */
    origin_point?: string;
    /** 终点/途经点（必须使用已确认的地点名） */
    route_points?: string[];
    /** 主要运输货物 */
    goods_transported?: string[];
    /** 路线上的风险 */
    hazards?: string[];
    /** 控制此路线的势力（必须使用已确认的势力名） */
    route_controlled_by?: string[];
    /** 通行费用/税收 */
    tolls?: string;

    // ── market（市场/交易中心）──
    /** 所在地点（必须使用已确认的地点名） */
    location?: string;
    /** 市场规模：local/regional/national/international/black_market */
    market_scale?: "local" | "regional" | "national" | "international" | "black_market";
    /** 特色商品 */
    specialty_goods?: string[];
    /** 经营势力（必须使用已确认的势力名） */
    operated_by?: string;
    /** 市场规则/特色 */
    trade_rules?: string;

    // ── guild（商会/行会）──
    /** 行会类型：merchant/craft/adventurer/assassin/alchemist/information */
    guild_type?: "merchant" | "craft" | "adventurer" | "assassin" | "alchemist" | "information";
    /** 总部所在地（必须使用已确认的地点名） */
    headquarters?: string;
    /** 行会规模 */
    member_count?: string;
    /** 垄断的行业/领域 */
    monopoly?: string;
    /** 与其他势力的关系 */
    political_connections?: string;
  };
}

export interface EconomyRelation {
  sourceName: string;
  targetName: string;
  relationType: "geographic" | "dependency" | "affiliation" | "opposition" | "reference" | "hierarchy";
  label: string;
}

export interface EconomyPayload {
  name: string;
  items: EconomyItem[];
  relations: EconomyRelation[];
}
