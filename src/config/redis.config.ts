import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => {
  const url = process.env.REDIS_URL || process.env.REDIS_PRIVATE_URL || process.env.REDIS_PUBLIC_URL;

  if (url) {
    return { url };
  }

  return {
    host: process.env.REDIS_HOST || process.env.REDISHOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || process.env.REDISPORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || process.env.REDISPASSWORD,
  };
});
