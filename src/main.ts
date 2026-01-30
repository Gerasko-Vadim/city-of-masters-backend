// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { seedAdmin } from './seeds/admin.seed';

async function bootstrap() {
  console.log('--- SYSTEM STARTING ---');
  console.log('PORT:', process.env.PORT || 3000);
  console.log('Environment Variables Check:');
  console.log('- DATABASE_URL:', process.env.DATABASE_URL ? 'OK' : 'MISSING');
  console.log('- PGHOST:', process.env.PGHOST ? 'OK' : 'MISSING');
  console.log('- PGPORT:', process.env.PGPORT ? 'OK' : 'MISSING');
  console.log('- REDIS_URL:', process.env.REDIS_URL ? 'OK' : 'MISSING');
  console.log('- REDISHOST:', process.env.REDISHOST ? 'OK' : 'MISSING');
  console.log('- REDISPORT:', process.env.REDISPORT ? 'OK' : 'MISSING');
  console.log('- NODE_ENV:', process.env.NODE_ENV || 'not set');

  const app = await NestFactory.create(AppModule);

  // ✅ Verify database connection and apply manual patches if needed
  try {
    const dataSource = app.get(DataSource);
    await dataSource.query('SELECT 1');
    console.log('✅ Database connection verified successfully');
    
    // Manual patch for missing columns if synchronize didn't pick them up
    console.log('Checking for missing columns...');
    await dataSource.query('ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP WITH TIME ZONE');
    await dataSource.query('ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP WITH TIME ZONE');
    await dataSource.query('ALTER TABLE "chat_message" ADD COLUMN IF NOT EXISTS "isRead" BOOLEAN DEFAULT FALSE');
    console.log('Column check/patch completed');
  } catch (error) {
    console.error('❌ Database verification/patch failed:', error.message);
    throw error; // Re-throw to trigger bootstrap catch
  }

  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // ✅ Seed admin (wrapped in try-catch to prevent startup crash if DB is not ready)
  try {
    const dataSource = app.get(DataSource);
    await seedAdmin(dataSource);
  } catch (error) {
    console.warn('[WARNING] Failed to seed admin user:', error.message);
  }

  // Глобальная валидация DTO
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`--- SUCCESS: Server is running on port ${port} ---`);
}

bootstrap().catch((err) => {
  console.error('--- CRITICAL FATAL ERROR DURING BOOTSTRAP ---');
  console.error(err);
  process.exit(1);
});
