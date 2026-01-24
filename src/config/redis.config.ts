import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  url: process.env.REDIS_URL,
  host: process.env.REDIS_HOST || process.env.REDISHOST,
  port: process.env.REDISPORT ? parseInt(process.env.REDISPORT, 10) : undefined,
  password: process.env.REDISPASSWORD,
}));
