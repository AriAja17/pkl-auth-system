import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ArticlesModule } from './articles/articles.module';
import { AdminModule } from './admin/admin.module';
import { AuthorizationModule } from './authorization/authorization.module';
import { AuditModule } from './audit/audit.module';


@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthorizationModule, AuditModule, AuthModule, ArticlesModule, AdminModule], 
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
