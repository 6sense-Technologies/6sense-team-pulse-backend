import './instrument';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cors from 'cors';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.use(cors());

  app.enableCors({
    origin: ['http://localhost:3000', 'https://6sense-efficiency.vercel.app'],
    methods: 'GET,POST,PUT,DELETE',
    credentials: true,
  });

  await app.listen(3000);
}

bootstrap();
