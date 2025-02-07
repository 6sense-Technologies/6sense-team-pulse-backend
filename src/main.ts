import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as express from 'express';
import { Transport } from '@nestjs/microservices';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  // Set up Swagger
  const config = new DocumentBuilder()
    .setTitle('Efficiency APIs')
    .setDescription('Efficiency API docs')
    .setVersion('1.0')
    .addTag('Efficiency')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'JWT',
      description: 'Enter JWT Token',
      in: 'header',
    })
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  // Apply global validation pipes
  app.useGlobalPipes(new ValidationPipe());

  // Enable CORS for all origins
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://o4t-under-development.vercel.app',
      'https://o4t-under-development-for-tester.vercel.app',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization',
    credentials: true,
  });

  // Set up MQTT microservice
  const configService = app.get(ConfigService);
  const mqttMicroservice = await NestFactory.createMicroservice(AppModule, {
    transport: Transport.MQTT,
    options: {
      url: configService.get('MQTT_BROKER_URL'),
      userProperties: { 'x-version': '1.0.0' },
      subscribeOptions: {
        qos: 2,
      },
      username: configService.get('MQTT_USERNAME'),
      password: configService.get('MQTT_PASSWORD'),
    },
  });
  await mqttMicroservice.listen();

  // For Vercel, use Express (Vercel functions are based on Express)
  const expressApp = app.getHttpAdapter().getInstance();
  
  // Set up the handler for serverless function
  module.exports = expressApp;
}

bootstrap();
