const API_URL = import.meta.env.VITE_API_URL as string

export interface HealthResponse {
  status: 'ok' | 'degraded'
  timestamp: string
  uptimeSeconds: number
  database: 'up' | 'down'
}

export interface User {
  id: string
  email: string
  name: string
  createdAt: string
}

export interface AuthResponse {
  accessToken: string
  user: User
}

export type AccountType = 'SAVINGS' | 'CHECKING' | 'CASH' | 'CREDIT_CARD' | 'INVESTMENT' | 'OTHER'
export type AccountRole = 'OWNER' | 'MEMBER'

export interface AccountMemberSummary {
  userId: string
  name: string
  email: string
  role: AccountRole
}

export interface Account {
  id: string
  name: string
  type: AccountType
  currency: string
  initialBalance: number
  currentBalance: number
  role: AccountRole
  memberCount: number
  members: AccountMemberSummary[]
  createdAt: string
  updatedAt: string
}

export interface CreateAccountInput {
  name: string
  type: AccountType
  currency?: string
  initialBalance?: number
}

export type TransactionType = 'INCOME' | 'EXPENSE'

export interface Category {
  id: string
  name: string
  type: TransactionType
  emoji: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateCategoryInput {
  name: string
  type: TransactionType
  emoji?: string
}

export interface UpdateCategoryInput {
  name?: string
  emoji?: string
}

export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  note: string | null
  occurredAt: string
  account: { id: string; name: string; currency: string }
  category: { id: string; name: string; emoji: string | null; type: TransactionType }
  createdByUserId: string
  createdAt: string
  updatedAt: string
}

export interface CreateTransactionInput {
  accountId: string
  categoryId: string
  type: TransactionType
  amount: number
  note?: string
  occurredAt?: string
}

export type BudgetPeriod = 'WEEKLY' | 'MONTHLY'

export interface Budget {
  id: string
  category: { id: string; name: string; emoji: string | null }
  limitAmount: number
  currency: string
  period: BudgetPeriod
  spent: number
  remaining: number
  percentUsed: number
  periodStart: string
  periodEnd: string
  createdAt: string
  updatedAt: string
}

export interface CreateBudgetInput {
  categoryId: string
  limitAmount: number
  currency?: string
  period?: BudgetPeriod
}

export interface Goal {
  id: string
  name: string
  targetAmount: number
  currentAmount: number
  currency: string
  percentComplete: number
  targetDate: string | null
  account: { id: string; name: string } | null
  createdAt: string
  updatedAt: string
}

export interface CreateGoalInput {
  name: string
  targetAmount: number
  targetDate?: string
  accountId?: string
  currency?: string
}

export type DebtDirection = 'THEY_OWE_ME' | 'I_OWE_THEM'
export type DebtStatus = 'PENDING' | 'PAID_PENDING_CONFIRMATION' | 'SETTLED'

export interface Debt {
  id: string
  counterparty: { id: string; name: string; email: string }
  direction: DebtDirection
  amount: number
  currency: string
  description: string | null
  status: DebtStatus
  markedPaidByMe: boolean
  createdByMe: boolean
  createdAt: string
  updatedAt: string
  settledAt: string | null
}

export interface CreateDebtInput {
  counterpartyEmail: string
  direction: DebtDirection
  amount: number
  currency?: string
  description?: string
}

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELED'

export interface Invitation {
  id: string
  account: { id: string; name: string }
  invitedUser: { id: string; name: string; email: string }
  invitedBy: { id: string; name: string; email: string }
  status: InvitationStatus
  createdAt: string
  respondedAt: string | null
}

export type RecurrenceFrequency = 'WEEKLY' | 'SEMIMONTHLY' | 'MONTHLY' | 'YEARLY'

export interface RecurringTransaction {
  id: string
  account: { id: string; name: string; currency: string }
  category: { id: string; name: string; emoji: string | null; type: TransactionType }
  type: TransactionType
  amount: number
  note: string | null
  frequency: RecurrenceFrequency
  startDate: string
  nextRunDate: string
  endDate: string | null
  active: boolean
  lastRunAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateRecurringTransactionInput {
  accountId: string
  categoryId: string
  type: TransactionType
  amount: number
  note?: string
  frequency?: RecurrenceFrequency
  startDate: string
  endDate?: string
}

export interface UpdateRecurringTransactionInput {
  amount?: number
  note?: string
  active?: boolean
  endDate?: string
}

export interface ForecastSummary {
  currency: string
  projectedMonthlyIncome: number
  projectedMonthlyExpense: number
  projectedMonthlyNet: number
}

export interface BudgetSuggestion {
  category: { id: string; name: string; emoji: string | null }
  currency: string
  averageMonthlySpend: number
  existingBudget: { id: string; limitAmount: number; period: BudgetPeriod } | null
}

class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (options.token) headers.Authorization = `Bearer ${options.token}`

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!res.ok) {
    const payload = await res.json().catch(() => null)
    const message = payload?.message ?? `Error ${res.status}`
    throw new ApiError(res.status, Array.isArray(message) ? message.join(', ') : message)
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

export function getHealth(): Promise<HealthResponse> {
  return request('/health')
}

export function register(input: { email: string; name: string; password: string }) {
  return request<AuthResponse>('/api/v1/auth/register', { method: 'POST', body: input })
}

export function login(input: { email: string; password: string }) {
  return request<AuthResponse>('/api/v1/auth/login', { method: 'POST', body: input })
}

export function getCurrentUser(token: string) {
  return request<User>('/api/v1/auth/me', { token })
}

export function getAccounts(token: string) {
  return request<Account[]>('/api/v1/accounts', { token })
}

export function getAccount(token: string, id: string) {
  return request<Account>(`/api/v1/accounts/${id}`, { token })
}

export function createAccount(token: string, input: CreateAccountInput) {
  return request<Account>('/api/v1/accounts', { method: 'POST', body: input, token })
}

export function deleteAccount(token: string, id: string) {
  return request<void>(`/api/v1/accounts/${id}`, { method: 'DELETE', token })
}

export function getCategories(token: string) {
  return request<Category[]>('/api/v1/categories', { token })
}

export function createCategory(token: string, input: CreateCategoryInput) {
  return request<Category>('/api/v1/categories', { method: 'POST', body: input, token })
}

export function updateCategory(token: string, id: string, input: UpdateCategoryInput) {
  return request<Category>(`/api/v1/categories/${id}`, { method: 'PATCH', body: input, token })
}

export function deleteCategory(token: string, id: string) {
  return request<void>(`/api/v1/categories/${id}`, { method: 'DELETE', token })
}

export function getTransactions(token: string, filters: { accountId?: string } = {}) {
  const params = new URLSearchParams()
  if (filters.accountId) params.set('accountId', filters.accountId)
  const qs = params.toString()
  return request<Transaction[]>(`/api/v1/transactions${qs ? `?${qs}` : ''}`, { token })
}

export function createTransaction(token: string, input: CreateTransactionInput) {
  return request<Transaction>('/api/v1/transactions', { method: 'POST', body: input, token })
}

export function deleteTransaction(token: string, id: string) {
  return request<void>(`/api/v1/transactions/${id}`, { method: 'DELETE', token })
}

export function getBudgets(token: string) {
  return request<Budget[]>('/api/v1/budgets', { token })
}

export function createBudget(token: string, input: CreateBudgetInput) {
  return request<Budget>('/api/v1/budgets', { method: 'POST', body: input, token })
}

export function deleteBudget(token: string, id: string) {
  return request<void>(`/api/v1/budgets/${id}`, { method: 'DELETE', token })
}

export function getGoals(token: string) {
  return request<Goal[]>('/api/v1/goals', { token })
}

export function createGoal(token: string, input: CreateGoalInput) {
  return request<Goal>('/api/v1/goals', { method: 'POST', body: input, token })
}

export function contributeToGoal(token: string, id: string, amount: number) {
  return request<Goal>(`/api/v1/goals/${id}/contributions`, {
    method: 'POST',
    body: { amount },
    token,
  })
}

export function deleteGoal(token: string, id: string) {
  return request<void>(`/api/v1/goals/${id}`, { method: 'DELETE', token })
}

export function getDebts(token: string) {
  return request<Debt[]>('/api/v1/debts', { token })
}

export function createDebt(token: string, input: CreateDebtInput) {
  return request<Debt>('/api/v1/debts', { method: 'POST', body: input, token })
}

export function markDebtPaid(token: string, id: string) {
  return request<Debt>(`/api/v1/debts/${id}/mark-paid`, { method: 'POST', token })
}

export function confirmDebt(token: string, id: string) {
  return request<Debt>(`/api/v1/debts/${id}/confirm`, { method: 'POST', token })
}

export function rejectDebt(token: string, id: string) {
  return request<Debt>(`/api/v1/debts/${id}/reject`, { method: 'POST', token })
}

export function deleteDebt(token: string, id: string) {
  return request<void>(`/api/v1/debts/${id}`, { method: 'DELETE', token })
}

export function removeAccountMember(token: string, accountId: string, userId: string) {
  return request<void>(`/api/v1/accounts/${accountId}/members/${userId}`, {
    method: 'DELETE',
    token,
  })
}

export function getMyInvitations(token: string) {
  return request<Invitation[]>('/api/v1/account-invitations', { token })
}

export function getAccountInvitations(token: string, accountId: string) {
  return request<Invitation[]>(`/api/v1/account-invitations?accountId=${accountId}`, { token })
}

export function createInvitation(token: string, accountId: string, email: string) {
  return request<Invitation>('/api/v1/account-invitations', {
    method: 'POST',
    body: { accountId, email },
    token,
  })
}

export function acceptInvitation(token: string, id: string) {
  return request<Invitation>(`/api/v1/account-invitations/${id}/accept`, { method: 'POST', token })
}

export function declineInvitation(token: string, id: string) {
  return request<Invitation>(`/api/v1/account-invitations/${id}/decline`, { method: 'POST', token })
}

export function cancelInvitation(token: string, id: string) {
  return request<Invitation>(`/api/v1/account-invitations/${id}/cancel`, { method: 'POST', token })
}

export function getRecurringTransactions(token: string) {
  return request<RecurringTransaction[]>('/api/v1/recurring-transactions', { token })
}

export function createRecurringTransaction(token: string, input: CreateRecurringTransactionInput) {
  return request<RecurringTransaction>('/api/v1/recurring-transactions', {
    method: 'POST',
    body: input,
    token,
  })
}

export function updateRecurringTransaction(
  token: string,
  id: string,
  input: UpdateRecurringTransactionInput,
) {
  return request<RecurringTransaction>(`/api/v1/recurring-transactions/${id}`, {
    method: 'PATCH',
    body: input,
    token,
  })
}

export function deleteRecurringTransaction(token: string, id: string) {
  return request<void>(`/api/v1/recurring-transactions/${id}`, { method: 'DELETE', token })
}

export function getForecastSummary(token: string) {
  return request<ForecastSummary[]>('/api/v1/forecast/summary', { token })
}

export function getBudgetSuggestions(token: string) {
  return request<BudgetSuggestion[]>('/api/v1/forecast/budget-suggestions', { token })
}

export { ApiError }
