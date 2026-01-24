import { Provider } from '@nestjs/common';
import Redis from 'ioredis';
export const REDIS_CLIENT = 'REDIS_CLIENT';

export const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: () => {
    const url = process.env.REDIS_URL || process.env.REDIS_PRIVATE_URL || process.env.REDIS_PUBLIC_URL;
    const redis = url ? new Redis(url, {
      retryStrategy: (times) => Math.min(times * 50, 2000),
    }) : new Redis({
      host: process.env.REDISHOST || process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDISPORT || process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDISPASSWORD || process.env.REDIS_PASSWORD,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    redis.on('error', (err) => {
      console.error('Redis connection error:', err);
    });

    redis.on('connect', () => {
      console.log('Redis connected successfully');
    });

    return redis;
  },
};
