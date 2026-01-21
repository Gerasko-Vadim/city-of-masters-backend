import { Provider } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: (configService: ConfigService) => {
    const url = configService.get<string>('redis.url');
    const retryStrategy = (times) => Math.min(times * 50, 2000);

    const redis = url
      ? new Redis(url, { retryStrategy })
      : new Redis({
          host: configService.get('redis.host'),
          port: configService.get('redis.port'),
          password: configService.get('redis.password'),
          retryStrategy,
        });

    redis.on('error', (err) => {
      console.error('Redis connection error:', err);
    });

    redis.on('connect', () => {
      console.log('Redis connected successfully');
    });

    return redis;
  },
  inject: [ConfigService],
};
