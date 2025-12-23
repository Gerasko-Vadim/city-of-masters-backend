// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { seedAdmin } from './seeds/admin.seed';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ✅ Seed admin
  const dataSource = app.get(DataSource);
  await seedAdmin(dataSource);

  // Глобальная валидация DTO
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(3000);
  console.log('Server is running on http://localhost:3000');
}

bootstrap();
