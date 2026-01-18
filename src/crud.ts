import { db, pool } from './db.ts';
import { departments, subjects } from './schema.ts';

async function main() {
  try {
    // 1) Create 4 fake departments
    const departmentSeed = [
      { name: 'Computer Science', description: 'Department of Computer Science and Engineering' },
      { name: 'Mathematics', description: 'Department of Pure and Applied Mathematics' },
      { name: 'Physics', description: 'Department of Physics and Astronomy' },
      { name: 'Literature', description: 'Department of Language and Literature' },
    ];

    const insertedDepartments = await db
      .insert(departments)
      .values(departmentSeed)
      .returning({ id: departments.id, name: departments.name });

    console.log('Inserted departments:', insertedDepartments);

    // 2) Create 4 fake subjects and attach them to existing departments (respecting relations)
    // We'll spread subjects across different departments using the IDs we just inserted.
    const depIds = insertedDepartments.map((d) => d.id);
    if (depIds.length < 4) {
      throw new Error('Expected to insert 4 departments to relate subjects to.');
    }

    const subjectSeed = [
      { name: 'Data Structures', departmentId: depIds[0] },
      { name: 'Linear Algebra', departmentId: depIds[1] },
      { name: 'Quantum Mechanics', departmentId: depIds[2] },
      { name: 'World Poetry', departmentId: depIds[3] },
    ];

    const insertedSubjects = await db
      .insert(subjects)
      .values(subjectSeed)
      .returning({ id: subjects.id, name: subjects.name, departmentId: subjects.departmentId });

    console.log('Inserted subjects:', insertedSubjects);
  }
  catch (e) {
    console.error('Seed error:', e);
    throw e;
  }
  finally {
    if (pool && typeof pool.end === 'function') {
      await pool.end();
      console.log('Database pool closed.');
    }
  }
}

main();
