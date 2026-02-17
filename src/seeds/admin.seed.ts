// src/seeds/admin.seed.ts
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Operator } from '../operators/entities/operator.entity';

export async function seedAdmin(dataSource: DataSource) {
  const repo = dataSource.getRepository(Operator);

  const exists = await repo.findOne({
    where: { username: 'cityofmaster' },
  });

  if (exists) {
    return;
  }

  console.log('--- ADMIN SEED: FIRST RUN DETECTED ---');
  console.log('--- CLEARING DATABASE ---');
  await dataSource.query('TRUNCATE "chat_message" CASCADE');
  await dataSource.query('TRUNCATE "order" CASCADE');
  await dataSource.query('TRUNCATE "specialist" CASCADE');
  await dataSource.query('TRUNCATE "operator" CASCADE');
  console.log('--- DATABASE CLEARED ---');

  const passwordHash = await bcrypt.hash(
    'cityofmaster987',
    10,
  );

  await repo.save({
    username: 'cityofmaster',
    passwordHash,
    isActive: true,
  });

  console.log('Admin operator "cityofmaster" created');
}
