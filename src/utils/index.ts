import { ParsedQs } from 'qs';
import {
  and,
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
} from 'drizzle-orm';

const mapQueryOperators = {
  select: 'columns',
  filter: 'where',
};

const mapLogicOperators = {
  and: and,
  or: or,
};

const mapComparisonOperators = {
  eq: eq,
  ne: ne,
  gt: gt,
  gte: gte,
  lt: lt,
  lte: lte,
  in: inArray,
  nin: notInArray,
  is: is,
  like: like,
  ilike: ilike,
};

const processSelectFn = (values: string) =>
  values.split(',').reduce(
    (acc, val) => {
      if (val.includes('.')) {
        const [table, column] = val.split('.') ?? [undefined, undefined];
        if (!table || !column) return acc;

        acc[table] = { [column]: true };
        return acc;
      }

      if (val.includes('(*)')) {
        acc = {
          ...acc,
          with: {
            [val.replace('(*)', '')]: true,
          },
        };
        return acc;
      }

      acc[val] = true;
      return acc;
    },
    {} satisfies Record<string, boolean>,
  );

const processFilterFn = (values: string) => {
  const [_, operator, value] = values.match(/^(\w+)\((.*)\)$/) ?? [undefined, undefined, undefined];

  if (!operator || !value) return;

  const mappedOperator = mapLogicOperators[operator];

  if (!mappedOperator) return;

  return { [operator]: value };
};

const mapOperatorsActions = {
  columns: processSelectFn,
  where: processFilterFn,
};

const queryParserConfig = {
  depth: 2,
};

export const parser = (query?: ParsedQs) => {
  let result = {};

  if (!query || Object.keys(query).length === 0) return result;

  Object.entries(query).forEach(([key, value]) => {
    if (!value || !key) return;
    const mappedKey = mapQueryOperators[key];

    if (!mappedKey) return;

    const parsed = mapOperatorsActions[mappedKey](value);

    result = { ...result, [mappedKey]: parsed };
  });

  return result;
};
