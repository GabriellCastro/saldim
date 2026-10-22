import { Module } from '@nestjs/common';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';

@Module({ controllers: [LoansController], providers: [LoansService], exports: [LoansService] })
export class LoansModule {}
