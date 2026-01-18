import { ParsedQs } from 'qs';
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  is,
  like,
  lt,
  lte,
  ne,
  notInArray,
  or,
  SQL,
  Table,
} from 'drizzle-orm';

export interface DrizzleQueryOptions {
  columns?: Record<string, boolean>;
  with?: Record<string, any>;
  where?: SQL;
  orderBy?: any[];
  limit?: number;
  offset?: number;
}

type DrizzleTable = Table;

const mapLogicOperators = { and, or };

const mapComparisonOperators = {
  eq,
  ne,
  gt,
  gte,
  lt,
  lte,
  in: inArray,
  nin: notInArray,
  is,
  like,
  ilike,
};

/**
 * Parses the select parameter into Drizzle-compatible columns and with structures.
 */
const processSelectFn = (values: string) => {
  const result: any = { columns: {} };

  splitByTopLevelComma(values).forEach((val) => {
    const cleanVal = val.trim();
    if (!cleanVal) return;

    if (cleanVal.includes('(*)')) {
      handleNestedSelect(result, cleanVal.replace('(*)', ''), { columns: {} });
      return;
    }

    const match = cleanVal.match(/^([\w.]+)\((.*)\)$/);
    if (match) {
      handleNestedSelect(result, match[1], processSelectFn(match[2]));
      return;
    }

    handleNestedSelect(result, cleanVal, true);
  });

  return finalizeResult(result);
};

const finalizeResult = (result: any) => {
  if (result.columns && Object.keys(result.columns).length === 0) delete result.columns;
  if (result.with && Object.keys(result.with).length === 0) {
    delete result.with;
  } else if (result.with) {
    for (const key of Object.keys(result.with)) {
      const relation = result.with[key];
      if (
        relation &&
        typeof relation === 'object' &&
        (!relation.columns || Object.keys(relation.columns).length === 0) &&
        (!relation.with || Object.keys(relation.with).length === 0)
      ) {
        result.with[key] = true;
      }
    }
  }
  return result;
};

/**
 * Helper to handle nested selection paths like "department.contact"
 */
const handleNestedSelect = (acc: any, path: string, value: any) => {
  const parts = path.split('.');
  let current = acc;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isLast = i === parts.length - 1;

    if (isLast) {
      updateLastPart(current, part, value);
    } else {
      current.with = current.with || {};
      current.with[part] = current.with[part] || { columns: {} };
      current = current.with[part];
    }
  }
};

const updateLastPart = (current: any, part: string, value: any) => {
  if (value === true) {
    current.columns = current.columns || {};
    current.columns[part] = true;
  } else {
    current.with = current.with || {};
    current.with[part] = deepMerge(current.with[part] || {}, value);
  }
};

const deepMerge = (target: any, source: any) => {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] instanceof Object && key in result && result[key] instanceof Object) {
      result[key] = deepMerge(result[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
};

/**
 * Recursively parses filter strings into Drizzle ORM conditions.
 */
const processFilterFn = (value: string, tableSchema: DrizzleTable): SQL | undefined => {
  const logicMatch = value.match(/^(\w+)\((.*)\)$/);
  if (logicMatch && mapLogicOperators[logicMatch[1]]) {
    const args = splitByTopLevelComma(logicMatch[2])
      .map((arg) => processFilterFn(arg.trim(), tableSchema))
      .filter(Boolean);
    return mapLogicOperators[logicMatch[1]](...args);
  }

  const compMatch = value.match(/^([\w.]+)\.(\w+)\((.*)\)$/);
  if (compMatch) {
    const [, path, operator, valStr] = compMatch;
    const col = tableSchema[path.split('.').pop()!];
    const op = mapComparisonOperators[operator];

    if (col && op) {
      const values = valStr.split(',').map((v) => coerceValue(v));
      return ['in', 'nin'].includes(operator) ? op(col, values) : op(col, values[0]);
    }
  }
  return undefined;
};

/**
 * Splits a string by comma, but only those not inside parentheses.
 */
const splitByTopLevelComma = (str: string) => {
  const result: string[] = [];
  let current = '',
    depth = 0;
  for (const char of str) {
    if (char === '(') depth++;
    else if (char === ')') depth--;
    else if (char === ',' && depth === 0) {
      result.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  result.push(current);
  return result;
};

const coerceValue = (val: string) => {
  const v = val.trim();
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null') return null;
  if (!isNaN(Number(v)) && v !== '') return Number(v);
  if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) {
    return v.substring(1, v.length - 1);
  }
  return v;
};

/**
 * Parses sort parameter into Drizzle orderBy array.
 */
const processSortFn = (value: string, tableSchema: any) => {
  return value
    .split(',')
    .map((item) => {
      const cleanItem = item.trim();
      let [field, direction] = cleanItem.startsWith('-')
        ? [cleanItem.substring(1), 'desc']
        : [cleanItem, 'asc'];

      if (field.includes('.')) {
        const parts = field.split('.');
        if (['asc', 'desc'].includes(parts[parts.length - 1])) {
          direction = parts.pop()!;
          field = parts.join('.');
        }
      }

      const col = tableSchema[field.split('.').pop()!];
      return col ? (direction === 'desc' ? desc(col) : asc(col)) : undefined;
    })
    .filter(Boolean);
};

export const parser = (query?: ParsedQs, tableSchema?: any): DrizzleQueryOptions => {
  const result: DrizzleQueryOptions = {};
  if (!query) return result;

  if (query.select) {
    const { columns, with: withRelations } = processSelectFn(query.select as string);
    if (columns) result.columns = columns;
    if (withRelations) result.with = withRelations;
  }

  if (query.filter && tableSchema) {
    result.where = processFilterFn(query.filter as string, tableSchema);
  }

  if (query.sort && tableSchema) {
    result.orderBy = processSortFn(query.sort as string, tableSchema);
  }

  if (query.limit && !isNaN(Number(query.limit))) result.limit = Number(query.limit);
  if (query.offset && !isNaN(Number(query.offset))) result.offset = Number(query.offset);

  return result;
};
