import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. WebSocket Adapter
  app.useWebSocketAdapter(new IoAdapter(app));

  // 2. Configuration (Cookies, Pipes, etc.) AVANT le listen
  app.use(cookieParser());

  const corsOrigin =
    process.env.CORS_ORIGIN ??
    process.env.FRONTEND_URL ??
    'http://localhost:5173';

  const origins = corsOrigin
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origins.length === 1 ? origins[0] : origins,
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Cache-Control',
    ],
    exposedHeaders: ['Content-Type'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 3. UN SEUL ET UNIQUE LISTEN À LA FIN
  // On utilise process.env.PORT pour Render et '0.0.0.0' pour l'accessibilité réseau
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');

  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
