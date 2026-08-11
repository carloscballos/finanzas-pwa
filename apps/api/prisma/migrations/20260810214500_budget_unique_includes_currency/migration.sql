DROP INDEX "budgets_userId_categoryId_period_key";

CREATE UNIQUE INDEX "budgets_userId_categoryId_period_currency_key" ON "budgets"("userId", "categoryId", "period", "currency");
