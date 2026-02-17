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
