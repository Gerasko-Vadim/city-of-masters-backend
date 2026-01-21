import { Module } from '@nestjs/common';

@Module({})
export class QueueModule {
  static connection = {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD,
  };
}
