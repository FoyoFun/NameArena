import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { registerRoutes } from './routes';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = Fastify({
  logger: { transport: undefined, level: 'info' },
});

await app.register(cors, { origin: true });
registerRoutes(app);

// 生产模式：同时托管前端构建产物（hash 路由，无需 SPA fallback），单进程单端口
const webDist = join(__dirname, '..', '..', 'web', 'dist');
if (existsSync(webDist)) {
  await app.register(fastifyStatic, { root: webDist, prefix: '/', wildcard: false });
}

const port = Number(process.env.PORT ?? 8787);
await app.listen({ port, host: '0.0.0.0' });
console.log(`NameArena server listening on http://localhost:${port}`);
