// import './instrument';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = new DocumentBuilder()
    .setTitle('Efficiency APIs')
    .setDescription('Efficiency API docs')
    .setVersion('1.0')
    .addTag('Effciency')
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
  app.enableCors({
    origin: '*', // Allows any origin
  });
  app.useGlobalPipes(new ValidationPipe());
  app.enableCors({
    origin: ['http://localhost:3000', 'https://6sense-efficiency.vercel.app'],
    methods: 'GET,POST,PUT,DELETE',
    credentials: true,
  });
  const configService = app.get(ConfigService);
  const mqttMicroservice =
    await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
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
  await app.listen(8000, 'localhost');
}

bootstrap();
