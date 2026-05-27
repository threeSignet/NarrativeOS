import { db } from "@narrative-os/database";
import * as schema from "@narrative-os/database";
import { eq, and, like, desc } from "drizzle-orm";
import type { Tool, ToolDefinition, ToolParameterSchema, ToolContext, ToolResult } from "./types";

const EXCLUDED_TABLES = new Set(["llmLogs", "notificationReads"]);

function drizzleTypeToJsonSchema(dataType: string): string {
  switch (dataType) {
    case "number": return "integer";
    case "boolean": return "boolean";
    case "json": return "object";
    case "date": return "string";
    default: return "string";
  }
}

interface ColumnMeta {
  name: string;
  dataType: string;
}

function inspectTable(table: any): { columns: ColumnMeta[]; hasProjectId: boolean } {
  const columns: ColumnMeta[] = [];
  for (const [key, col] of Object.entries(table)) {
    if (col && typeof col === "object" && "dataType" in (col as any)) {
      columns.push({ name: key, dataType: (col as any).dataType });
    }
  }
  const hasProjectId = columns.some((c) => c.name === "projectId");
  return { columns, hasProjectId };
}

function isPgTable(obj: any): boolean {
  if (!obj || typeof obj !== "object") return false;
  let colCount = 0;
  for (const val of Object.values(obj)) {
    if (val && typeof val === "object" && "dataType" in (val as any)) colCount++;
  }
  return colCount >= 2;
}

function buildQueryParams(columns: ColumnMeta[]): ToolParameterSchema {
  const properties: ToolParameterSchema["properties"] = {};

  const filterable = columns.filter((c) =>
    c.dataType === "string" || c.dataType === "number" || c.dataType === "date"
  );

  for (const col of filterable) {
    const jsType = drizzleTypeToJsonSchema(col.dataType);
    properties[`${col.name}_eq`] = {
      type: jsType,
      description: `Filter by exact ${col.name}`,
    };
    if (col.dataType === "string") {
      properties[`${col.name}_like`] = {
        type: "string",
        description: `Filter by ${col.name} partial match`,
      };
    }
  }

  properties["limit"] = {
    type: "integer",
    description: "Max rows (default 50, max 200)",
  };
  properties["orderBy"] = {
    type: "string",
    description: "Column to sort by",
    enum: columns.map((c) => c.name),
  };
  properties["orderDir"] = {
    type: "string",
    enum: ["asc", "desc"],
    description: "Sort direction (default desc)",
  };

  return { type: "object", properties, required: [] };
}

function generateTableTool(tableKey: string, table: any, meta: ReturnType<typeof inspectTable>): Tool {
  const friendlyName = tableKey.replace(/([A-Z])/g, " $1").trim().toLowerCase();

  const definition: ToolDefinition = {
    name: `query_${tableKey}`,
    description:
      `Query the ${friendlyName} table for the current project. ` +
      (meta.hasProjectId ? "Results are scoped to this project." : "Not project-scoped.") +
      ` Columns: ${meta.columns.map((c) => c.name).join(", ")}.`,
    parameters: buildQueryParams(meta.columns),
  };

  const executor = async (args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> => {
    const limit = Math.min((args.limit as number) || 50, 200);
    const orderByCol = args.orderBy as string | undefined;
    const orderDir = (args.orderDir as string) || "desc";

    const conditions: any[] = [];

    if (meta.hasProjectId && table.projectId) {
      conditions.push(eq(table.projectId, ctx.projectId));
    }

    for (const col of meta.columns) {
      const eqVal = args[`${col.name}_eq`];
      if (eqVal !== undefined && table[col.name]) {
        conditions.push(eq(table[col.name], eqVal));
      }
      const likeVal = args[`${col.name}_like`];
      if (likeVal !== undefined && typeof likeVal === "string" && table[col.name]) {
        conditions.push(like(table[col.name], `%${likeVal}%`));
      }
    }

    let query: any = db.select().from(table);
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    if (orderByCol && table[orderByCol]) {
      query = orderDir === "desc" ? query.orderBy(desc(table[orderByCol])) : query.orderBy(table[orderByCol]);
    }

    const rows = await query.limit(limit);
    return {
      data: rows,
      display: `Queried ${friendlyName}: ${rows.length} row(s)`,
    };
  };

  return { definition, execute: executor };
}

export function generateSchemaTools(): Tool[] {
  const tools: Tool[] = [];

  for (const [key, value] of Object.entries(schema)) {
    if (EXCLUDED_TABLES.has(key)) continue;
    if (!isPgTable(value)) continue;

    const meta = inspectTable(value);
    if (meta.columns.length === 0) continue;

    tools.push(generateTableTool(key, value, meta));
  }

  return tools;
}
