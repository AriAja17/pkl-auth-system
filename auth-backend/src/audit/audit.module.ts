import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditRetentionService } from './audit-retention.service';

@Global()
@Module({
  providers: [AuditService, AuditRetentionService],
  exports: [AuditService],
})
export class AuditModule {}
