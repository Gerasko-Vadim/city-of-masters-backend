import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  host: process.env.REDIS_HOST || process.env.REDISHOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || process.env.REDISPORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || process.env.REDISPASSWORD,
}));
