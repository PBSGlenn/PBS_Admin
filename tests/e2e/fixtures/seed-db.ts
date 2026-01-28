// Test Database Seeder
// Seeds the test database with dog and cat clients for template ID logging tests

import { spawnSync } from 'child_process';

export interface SeedOptions {
  dbUrl: string;
}

/**
 * Seed the test database with test clients and tasks
 * Creates:
 * - "Dog Client" with a dog pet and questionnaire task
 * - "Cat Client" with a cat pet and questionnaire task
 */
export async function seedTestDb({ dbUrl }: SeedOptions): Promise<void> {
  if (!dbUrl) {
    throw new Error('DATABASE_URL is required for test DB seeding');
  }

  const res = spawnSync('npm', ['run', 'db:seed:test'], {
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: 'inherit',
    shell: true,
  });

  if (res.status !== 0) {
    throw new Error(`Seed failed with exit code ${res.status}`);
  }
}

/**
 * Reset the test database to a clean state
 */
export async function resetTestDb({ dbUrl }: SeedOptions): Promise<void> {
  if (!dbUrl) {
    throw new Error('DATABASE_URL is required for test DB reset');
  }

  const res = spawnSync('npx', ['prisma', 'migrate', 'reset', '--force'], {
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: 'inherit',
    shell: true,
  });

  if (res.status !== 0) {
    throw new Error(`Reset failed with exit code ${res.status}`);
  }
}
