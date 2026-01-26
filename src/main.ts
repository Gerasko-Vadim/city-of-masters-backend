// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { seedAdmin } from './seeds/admin.seed';

async function bootstrap() {
  console.log('--- SYSTEM STARTING ---');
  console.log('PORT:', process.env.PORT || 3000);
  console.log('DB_URL:', process.env.DATABASE_URL ? 'PRESENT' : 'MISSING');
  console.log('REDIS_URL:', process.env.REDIS_URL ? 'PRESENT' : 'MISSING');

  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true,
    credentials: true,
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
