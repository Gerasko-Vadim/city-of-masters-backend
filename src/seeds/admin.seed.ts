// src/seeds/admin.seed.ts
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Operator } from '../operators/entities/operator.entity';

export async function seedAdmin(dataSource: DataSource) {
  const repo = dataSource.getRepository(Operator);

  const exists = await repo.findOne({
    where: { username: 'admin' },
  });

  if (exists) {
    console.log('Admin already exists');
    return;
  }

  const passwordHash = await bcrypt.hash(
    process.env.ADMIN_PASSWORD || 'admin123',
    10,
  );

  await repo.save({
    username: 'admin',
    passwordHash,
    isActive: true,
  });

  console.log('Admin operator created');
}
