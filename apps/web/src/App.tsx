import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { AccountsPage } from './pages/AccountsPage'
import { AccountTransactionsPage } from './pages/AccountTransactionsPage'
import { CategoriesPage } from './pages/CategoriesPage'
import { BudgetsPage } from './pages/BudgetsPage'
import { GoalsPage } from './pages/GoalsPage'
import { DebtsPage } from './pages/DebtsPage'
import { InvitationsPage } from './pages/InvitationsPage'
import { ForecastPage } from './pages/ForecastPage'
import { ProtectedRoute } from './components/ProtectedRoute'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/accounts/:accountId/transactions" element={<AccountTransactionsPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/budgets" element={<BudgetsPage />} />
        <Route path="/goals" element={<GoalsPage />} />
        <Route path="/debts" element={<DebtsPage />} />
        <Route path="/invitations" element={<InvitationsPage />} />
        <Route path="/forecast" element={<ForecastPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/accounts" replace />} />
    </Routes>
  )
}

export default App
