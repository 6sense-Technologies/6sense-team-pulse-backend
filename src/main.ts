import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const webApp = await NestFactory.create(AppModule);
  const configService = webApp.get(ConfigService);

  if (process.env.NODE_ENV !== 'production') {
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
  }

  //updated
  // Global Pipes (validation)
  webApp.useGlobalPipes(
    new ValidationPipe({
      transform: true, // Ensures DTO transformations work
    }),
  );

  // Enable CORS for specific origins
  webApp.enableCors({
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders:
      'Content-Type, Accept, Authorization, timezone-region, Organization-Id',
  });

  // Create microservice with MQTT transport
  // const mqttMicroservice = webApp.connectMicroservice<MicroserviceOptions>({
  //   transport: Transport.MQTT,
  //   options: {
  //     url: configService.get<string>('MQTT_BROKER_URL'),
  //     username: configService.get<string>('MQTT_USERNAME'),
  //     password: configService.get<string>('MQTT_PASSWORD'),
  //   },
  // });

  // // Start the microservice first
  // await webApp.startAllMicroservices();
  // console.log('Microservice started');

  // Start the web application on port 8000
  const port = parseInt(
    process.env.PORT || configService.get('PORT') || '10000',
    10,
  );
  await webApp.listen(port, '0.0.0.0');
  const server = webApp.getHttpServer();
  const address = server.address();
  console.log(
    `Web Application started on http://${address.address}:${address.port}`,
  );
}

bootstrap();
