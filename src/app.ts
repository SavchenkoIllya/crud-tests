import express, { Request, Response, NextFunction } from 'express';
import cors, { CorsOptions } from 'cors';
import dotenv from 'dotenv';
import { drizzleQueryMiddleware, subjectQuerySchema } from './utils/index.js';
import { subjects } from './schema.js';
import { eq } from 'drizzle-orm';
import qs from 'qs';

// Load environment variables from .env if present
dotenv.config();

const app = express();

// Parse JSON bodies
app.use(express.json());

app.set('query parser', 'extended');

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

app.use(cors(corsOptions));

// A simple test route
app.get(
  '/health',
  drizzleQueryMiddleware(subjectQuerySchema),
  async (req: Request, res: Response) => {
    try {
      // const query = req.query;
      const testObject = {
        columns: {
          id: true,
          name: true,
        },
        with: {
          department: {
            columns: {
              id: true,
              name: true,
              description: true,
            },
          },
        },
        where: {
          id: {
            eq: 1,
          },
        },
      };

      console.log(qs.stringify(testObject, { encode: false }));
      // console.log(query)

      // const testData = await db
      //   .select()
      //   .from(subjects)
      //   .then((data) => Object.groupBy(data, ({ departmentId }) => departmentId));

      // const data = await db.query.subjects
      //   .findMany({
      //     columns: {
      //       id: true,
      //       name: true,
      //     },
      //     with: {
      //       department: {
      //         columns: {
      //           id: true,
      //           name: true,
      //           description: true,
      //         },
      //       },
      //     },
      //     where: eq(subjects.id, 1),
      //   })
      //   .then((data) => Object.groupBy(data, ({ department }) => department.name));

      res.status(200);
      // .json(data);
    } catch (e) {
      console.log(e);

      const message = e instanceof Error ? e.message : 'Query failed';
      res.status(500).json({ error: message });
    }
  },
);

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
