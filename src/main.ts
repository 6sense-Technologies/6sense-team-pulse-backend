import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const webApp = await NestFactory.create(AppModule);
  const configService = webApp.get(ConfigService);

  // Swagger configuration
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
  const document = SwaggerModule.createDocument(webApp, config);
  SwaggerModule.setup('api', webApp, document);

  //updated
  // Global Pipes (validation)
  webApp.useGlobalPipes(
    new ValidationPipe({
      transform: true, // Ensures DTO transformations work
    }),
  );

  // Enable CORS for specific origins
  webApp.enableCors({
    origin: [
      'http://localhost:3000',
      'https://o4t-under-development.vercel.app',
      'https://o4t-under-development-for-tester.vercel.app',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization',
    credentials: true,
  });

  // Create microservice with MQTT transport
  const mqttMicroservice = webApp.connectMicroservice<MicroserviceOptions>({
    transport: Transport.MQTT,
    options: {
      url: configService.get<string>('MQTT_BROKER_URL'),
      username: configService.get<string>('MQTT_USERNAME'),
      password: configService.get<string>('MQTT_PASSWORD'),
    },
  });

  // Start the microservice first
  await webApp.startAllMicroservices();
  console.log('Microservice started');

  // Start the web application on port 8000
  await webApp.listen(8000, '0.0.0.0');
  console.log('Web Application started on http://localhost:8000');
}

bootstrap();
