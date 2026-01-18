import express, { Request, Response, NextFunction } from 'express';
import cors, { CorsOptions } from 'cors';
import dotenv from 'dotenv';
// import { drizzleQueryMiddleware, subjectQuerySchema } from './utils/index.js';
// import { subjects } from './schema.js';
import { ParsedQs } from 'qs';
import {
  and,
  eq,
  gt,
  gte,
  lt,
  lte,
  ne,
  or,
  inArray,
  notInArray,
  is,
  like,
  ilike,
} from 'drizzle-orm';

// Load environment variables from .env if present
dotenv.config();

const app = express();

// Parse JSON bodies
app.use(express.json());

// CORS configuration
// Configure allowed origins via env: ALLOWED_ORIGINS as comma-separated list
const rawOrigins = process.env.ALLOWED_ORIGINS;

if (!rawOrigins)
  throw new Error(
    'ALLOWED_ORIGINS environment variable is not set. Please set it to a comma-separated list of allowed origins.',
  );

const allowedOrigins = rawOrigins
  .split(',')
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin like mobile apps or curl
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS: Origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

type ParsedQueryForRequest = {
  columns?: {
    [key: string]: true;
  };
  with?: {
    [key: string]:
      | {
          columns?: {
            [key: string]: true;
          };
        }
      | true;
  };
  where?: string;
};

app.use(cors(corsOptions));

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

const processSelectFn = (values: string): any =>
  values.split(',').reduce((acc, val) => {
    if (val.includes('.')) {
      const [table, column] = val.split('.');
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
  }, {});

const parseFilterFn = (values: string) => {
  const [_, operator, value] = values.match(/^(\w+)\((.*)\)$/) ?? [undefined, undefined, undefined];

  if (!operator || !value) return;

  const mappedOperator = mapLogicOperators[operator];

  if (!mappedOperator) return;

  return { [operator]: value };
};

const mapOperatorsActions = {
  columns: processSelectFn,
  where: parseFilterFn,
};

const queryParserConfig = {
  depth: 2,
};

const parser = (query?: ParsedQs) => {
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

// A simple test route
app.get('/health', async (req: Request, res: Response) => {
  try {
    const parsedQuery = req.query;

    const responseData = parser(parsedQuery);

    res.status(200).json(responseData);
  } catch (e) {
    console.error(e);

    const message = e instanceof Error ? e.message : 'Query failed';
    res.status(500).json({ error: message });
  }
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

// Error handler
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : 'Internal Server Error';
  const status = 500;
  res.status(status).json({ error: message });
});

export default app;
