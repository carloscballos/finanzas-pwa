import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { envValidationSchema } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { AccountsModule } from './accounts/accounts.module';
import { CategoriesModule } from './categories/categories.module';
import { TransactionsModule } from './transactions/transactions.module';
import { BudgetsModule } from './budgets/budgets.module';
import { GoalsModule } from './goals/goals.module';
import { DebtsModule } from './debts/debts.module';
import { AccountInvitationsModule } from './account-invitations/account-invitations.module';
import { RecurringTransactionsModule } from './recurring-transactions/recurring-transactions.module';
import { ForecastModule } from './forecast/forecast.module';
import { FriendsModule } from './friends/friends.module';
import { ExchangeRatesModule } from './exchange-rates/exchange-rates.module';
import { TransfersModule } from './transfers/transfers.module';
import { LoansModule } from './loans/loans.module';
import { CardPurchasesModule } from './card-purchases/card-purchases.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PushModule } from './push/push.module';
import { RemindersModule } from './reminders/reminders.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    LoggerModule.forRootAsync({
      useFactory: () => ({
        pinoHttp: {
          level: process.env.LOG_LEVEL ?? 'info',
          transport:
            process.env.NODE_ENV === 'production'
              ? undefined
              : { target: 'pino-pretty', options: { singleLine: true } },
        },
      }),
    }),
    // Límite general por IP; /auth/login y /auth/register tienen uno más estricto.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    HealthModule,
    AuthModule,
    AccountsModule,
    CategoriesModule,
    TransactionsModule,
    BudgetsModule,
    GoalsModule,
    DebtsModule,
    AccountInvitationsModule,
    RecurringTransactionsModule,
    ForecastModule,
    FriendsModule,
    ExchangeRatesModule,
    TransfersModule,
    LoansModule,
    CardPurchasesModule,
    ApiKeysModule,
    NotificationsModule,
    PushModule,
    RemindersModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
