import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/Auth'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import Produits from './pages/Produits'
import Commandes from './pages/Commandes'
import Ventes from './pages/Ventes'
import Caisse from './pages/Caisse'
import Facturation from './pages/Facturation'
import Personnel from './pages/Personnel'
import Rapports from './pages/Rapports'
import Journal from './pages/Journal'
import Parametres from './pages/Parametres'

function Protected({ children }) {
  const { user } = useAuth()
  if (!user || !localStorage.getItem('token')) return <Navigate to="/login" replace />
  return children
}

const withBoundary = (el) => <ErrorBoundary>{el}</ErrorBoundary>

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/" element={withBoundary(<Dashboard />)} />
        <Route path="/clients" element={withBoundary(<Clients />)} />
        <Route path="/produits" element={withBoundary(<Produits />)} />
        <Route path="/commandes" element={withBoundary(<Commandes />)} />
        <Route path="/ventes" element={withBoundary(<Ventes />)} />
        <Route path="/caisse" element={withBoundary(<Caisse />)} />
        <Route path="/facturation" element={withBoundary(<Facturation />)} />
        <Route path="/personnel" element={withBoundary(<Personnel />)} />
        <Route path="/rapports" element={withBoundary(<Rapports />)} />
        <Route path="/journal" element={withBoundary(<Journal />)} />
        <Route path="/parametres" element={withBoundary(<Parametres />)} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
