import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { assertRoutePolicyConsistency } from './authorization/policy-consistency';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  assertRoutePolicyConsistency(app.getHttpAdapter().getInstance());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: 'http://localhost:3000' });
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();