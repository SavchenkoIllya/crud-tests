import type { RequestHandler } from "express";
import { and, asc, count, desc, eq, type SQL } from "drizzle-orm";
import { AnyPgColumn } from "drizzle-orm/pg-core";
import { departments, subjects } from "../schema.js";
import qs from "qs";

// Drizzle-first, strongly-typed building blocks
export type Column = AnyPgColumn;

export type RelationSchema<C extends Record<string, Column>> = {
  columns: C;
};

export type QuerySchema<
  C extends Record<string, Column>,
  R extends Record<string, RelationSchema<Record<string, Column>>> = {},
  A extends Record<string, Column> = {}
> = {
  columns: C;
  relations?: R;
  aggregates?: A;
};

// Public result type of the parser
export type ParsedQuery<T extends QuerySchema<Record<string, Column>, Record<string, RelationSchema<Record<string, Column>>>, Record<string, Column>>> = {
  columns?: Partial<Record<keyof T["columns"], true>>;
  with?: {
    [K in keyof NonNullable<T["relations"]>]? : {
      columns?: Partial<Record<keyof NonNullable<T["relations"]>[K]["columns"], true>>;
    };
  };
  where?: SQL;
  orderBy?: SQL[];
  limit?: number;
  offset?: number;
  aggregates?: SQL[];
};

// Input helpers — what we accept from qs (runtime validated; type-safe output)
type Primitive = string | number | boolean;

// Narrow object-safety helpers
function hasOwn<T extends object, K extends PropertyKey>(obj: T, key: K): key is K & keyof T {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

// SELECT
export function parseSelect<T extends QuerySchema<any, any, any>>(
  selectInput: unknown,
  schema: T
): Pick<ParsedQuery<T>, "columns" | "with"> {
  const columns: Partial<Record<keyof T["columns"], true>> = {};
  const withRelations: Record<string, { columns?: Record<string, true> }> = {};

  if (selectInput && typeof selectInput === "object") {
    for (const key of Object.keys(selectInput as object)) {
      const value = (selectInput as Record<string, unknown>)[key];

      // top-level columns
      if (schema.columns && hasOwn(schema.columns, key)) {
        (columns as Record<string, true>)[key] = true;
      }

      // relations: accept array of field names
      if (schema.relations && hasOwn(schema.relations, key)) {
        const rel = schema.relations[key];
        const list = Array.isArray(value)
          ? (value as unknown[])
          : typeof value === "string"
            ? [value]
            : [];
        const relCols: Record<string, true> = {};
        for (const item of list) {
          if (typeof item === "string" && hasOwn(rel.columns, item)) {
            relCols[item] = true;
          }
        }
        if (Object.keys(relCols).length) {
          withRelations[key] = { columns: relCols };
        }
      }
    }
  }

  return {
    columns: Object.keys(columns).length ? columns : undefined,
    with: Object.keys(withRelations).length ? (withRelations as any) : undefined,
  } as Pick<ParsedQuery<T>, "columns" | "with">;
}

// FILTERS (equality only for now)
export function parseFilters<T extends QuerySchema<any, any, any>>(
  filterInput: unknown,
  schema: T
): SQL | undefined {
  if (!filterInput || typeof filterInput !== "object") return undefined;

  const conditions: SQL[] = [];
  const filter = filterInput as Record<string, unknown>;

  for (const key of Object.keys(filter)) {
    const value = filter[key];

    // top-level columns
    if (schema.columns && hasOwn(schema.columns, key) && isPrimitive(value)) {
      conditions.push(eq(schema.columns[key], value));
      continue;
    }

    // relation fields
    if (schema.relations && hasOwn(schema.relations, key)) {
      const relFilter = value;
      if (relFilter && typeof relFilter === "object") {
        const rel = schema.relations[key];
        for (const field of Object.keys(relFilter as object)) {
          const v = (relFilter as Record<string, unknown>)[field];
          if (hasOwn(rel.columns, field) && isPrimitive(v)) {
            conditions.push(eq(rel.columns[field], v));
          }
        }
      }
    }
  }

  return conditions.length ? and(...conditions) : undefined;
}

function isPrimitive(v: unknown): v is Primitive {
  const t = typeof v;
  return t === "string" || t === "number" || t === "boolean";
}

// SORT
export function parseSort<T extends QuerySchema<any, any, any>>(
  sortInput: unknown,
  schema: T
): SQL[] {
  if (!sortInput || typeof sortInput !== "object") return [];
  const result: SQL[] = [];
  const sort = sortInput as Record<string, unknown>;

  for (const key of Object.keys(sort)) {
    const dir = sort[key];

    if (schema.columns && hasOwn(schema.columns, key)) {
      result.push(dir === "desc" ? desc(schema.columns[key]) : asc(schema.columns[key]));
      continue;
    }

    if (schema.relations && hasOwn(schema.relations, key)) {
      const relSort = sort[key];
      if (relSort && typeof relSort === "object") {
        const rel = schema.relations[key];
        for (const field of Object.keys(relSort as object)) {
          const col = rel.columns[field as keyof typeof rel.columns];
          if (col) {
            const d = (relSort as Record<string, unknown>)[field];
            result.push(d === "desc" ? desc(col) : asc(col));
          }
        }
      }
    }
  }

  return result;
}

// AGGREGATES (count only, keyed by alias)
export function parseAggregates<T extends QuerySchema<any, any, any>>(
  aggInput: unknown,
  schema: T
): SQL[] | undefined {
  if (!aggInput || typeof aggInput !== "object" || !schema.aggregates) return undefined;
  const result: SQL[] = [];
  const agg = aggInput as Record<string, unknown>;

  for (const key of Object.keys(agg)) {
    if (hasOwn(schema.aggregates, key)) {
      result.push(count(schema.aggregates[key]).as(key));
    }
  }

  return result.length ? result : undefined;
}

// High-level parser
export function parseDrizzleQuery<T extends QuerySchema<any, any, any>>(
  queryInput: unknown,
  schema: T
): ParsedQuery<T> {
  const query = (queryInput ?? {}) as Record<string, unknown>;
  return {
    ...parseSelect(query.select, schema),
    where: parseFilters(query.filter, schema),
    orderBy: parseSort(query.sort, schema),
    limit: toPositiveInt(query.limit),
    offset: toPositiveInt(query.offset),
    aggregates: parseAggregates(query.aggregate, schema),
  };
}

function toPositiveInt(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isInteger(n) && n >= 0) return n;
  }
  return undefined;
}

// Express middleware factory with strong typing
export function drizzleQueryMiddleware<T extends QuerySchema<any, any, any>>(schema: T): RequestHandler {
  return (req, _res, next) => {
    try {
      const url = (req as any).originalUrl ?? req.url ?? "";
      const qsIndex = typeof url === "string" ? url.indexOf("?") : -1;
      const rawQuery = qsIndex >= 0 ? url.slice(qsIndex + 1) : "";
      const parsed = rawQuery ? qs.parse(rawQuery) : {};
      (req as any).drizzleQuery = parseDrizzleQuery(parsed, schema);
    } catch (_e) {
      (req as any).drizzleQuery = parseDrizzleQuery({}, schema);
    } finally {
      next();
    }
  };
}

// Example schema for subjects (kept for local usage and tests/demo)
export const subjectQuerySchema = {
  columns: {
    id: subjects.id,
    name: subjects.name,
    departmentId: subjects.departmentId,
  },
  relations: {
    department: {
      columns: {
        id: departments.id,
        name: departments.name,
        description: departments.description,
      },
    },
  },
  aggregates: {
    count: subjects.id,
  },
} satisfies QuerySchema<
  {
    id: typeof subjects.id;
    name: typeof subjects.name;
    departmentId: typeof subjects.departmentId;
  },
  {
    department: RelationSchema<{
      id: typeof departments.id;
      name: typeof departments.name;
      description: typeof departments.description;
    }>;
  },
  { count: typeof subjects.id }
>;