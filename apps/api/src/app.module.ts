import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './common/jwt-auth.guard';
import { PrismaModule } from './prisma/prisma.module';
import { CategoriesModule } from './categories/categories.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AccountsModule } from './accounts/accounts.module';
import { ImportsModule } from './imports/imports.module';
import { TransactionsModule } from './transactions/transactions.module';
import { PayslipsModule } from './payslips/payslips.module';
import { LoansModule } from './loans/loans.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { BudgetsModule } from './budgets/budgets.module';
import { GoalsModule } from './goals/goals.module';
import { OpenFinanceModule } from './open-finance/open-finance.module';
import { AssistantModule } from './assistant/assistant.module';
import { HealthController } from './common/health.controller';

// Cada feature registra seu módulo aqui (uma linha por módulo).
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'dev-secret',
      signOptions: { expiresIn: '7d' },
    }),
    PrismaModule,
    CategoriesModule,
    AuthModule,
    UsersModule,
    AccountsModule,
    ImportsModule,
    TransactionsModule,
    PayslipsModule,
    LoansModule,
    DashboardModule,
    BudgetsModule,
    GoalsModule,
    AssistantModule,
    OpenFinanceModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
