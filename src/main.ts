import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  // Create the web application
  const webApp = await NestFactory.create(AppModule);
  
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
  const documentFactory = () => SwaggerModule.createDocument(webApp, config);
  SwaggerModule.setup('api', webApp, documentFactory);

  // Global Pipes (validation)
  webApp.useGlobalPipes(new ValidationPipe());

  // Enable CORS for specific origins
  webApp.enableCors({
    origin: ['http://localhost:3000', 'https://o4t-under-development.vercel.app', 'https://o4t-under-development-for-tester.vercel.app'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization',
    credentials: true,
  });

  // Create application context and retrieve config service
  const appContext = await NestFactory.createApplicationContext(AppModule);
  const configService = appContext.get(ConfigService);

  // Create microservice with MQTT transport
  const mqttMicroservice = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.MQTT,
    options: {
      url: configService.get('MQTT_BROKER_URL'),
      username: configService.get('MQTT_USERNAME'),
      password: configService.get('MQTT_PASSWORD'),
    },
  });

  // Start the microservice
  await mqttMicroservice.listen();
  console.log("Microservice started")
  // Start the web application on port 8000
  await webApp.listen(8000, 'localhost');
  console.log('Web Application started on http://localhost:8000');
}

bootstrap();
