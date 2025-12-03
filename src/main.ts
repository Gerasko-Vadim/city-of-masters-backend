// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Глобальная валидация DTO
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // удаляет лишние поля
      forbidNonWhitelisted: true, // запрещает лишние поля
      transform: true, // автоматически превращает строки в числа, boolean и т.д.
    }),
  );

  await app.listen(3000);
  console.log('Server is running on http://localhost:3000');
}

bootstrap();
