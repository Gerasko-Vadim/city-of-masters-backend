import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => {
  const url = process.env.REDIS_URL || process.env.REDIS_PUBLIC_URL;
  
  if (url) {
    try {
      const parsed = new URL(url);
      return {
        host: parsed.hostname,
        port: parseInt(parsed.port, 10),
        password: parsed.password,
        username: parsed.username,
        url: url, // Keep raw url just in case
      };
    } catch (e) {
      // invalid url, fall back
    }
  }

  return {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  };
});
