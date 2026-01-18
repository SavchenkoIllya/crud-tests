import 'dotenv/config';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import {departmentRelations, departments, subjects, subjectsRelations} from "./schema.js";

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined');
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, {
      schema: {
        subjects,
        departments,
        subjectsRelations,
        departmentRelations
      }
    }
);

export const pool: { end: () => Promise<void> } | undefined = undefined;
