import {integer, pgTable, serial, text, timestamp} from 'drizzle-orm/pg-core';
import {relations} from "drizzle-orm";

export const sharedFields = {
  id: serial('id').primaryKey(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(()=>new Date()).notNull(),
}

export const subjects = pgTable('subjects', {
...sharedFields,
  name: text('name').notNull(),
  departmentId: integer('department_id').notNull(),
});

export const departments = pgTable('departments', {
  ...sharedFields,
  name: text('name').notNull(),
  description: text('description'),
});

export const departmentRelations = relations(departments, ({ many }) => ({
  subjects: many(subjects)
}));

export const subjectsRelations = relations(subjects, ({ one }) => ({
  department: one(departments, {fields: [subjects.departmentId], references: [departments.id]}),
}));


export type Subject = typeof subjects.$inferSelect;
export type NewSubject = typeof subjects.$inferInsert;

export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;