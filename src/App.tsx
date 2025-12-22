import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import Login from './components/Login'
import ShiftScheduler from './components/ShiftScheduler'
import LeaveOverview from './components/LeaveOverview'
import ShiftSettings from './components/ShiftSettings'
import People from './components/People'
import ShiftPattern from './components/ShiftPattern'
import Admin from './components/Admin'
import './App.css'

function App() {
  const { user, loading, login, logout, isAuthenticated } = useAuth()

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px'
      }}>
        載入中...
      </div>
    )
  }

  if (!isAuthenticated()) {
    return <Login onLogin={login} />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout user={user} onLogout={logout}><ShiftScheduler /></Layout>} />
        <Route path="/overview" element={<Layout user={user} onLogout={logout}><LeaveOverview /></Layout>} />
        <Route path="/scheduler" element={<Layout user={user} onLogout={logout}><ShiftScheduler /></Layout>} />
        <Route path="/shift-settings" element={<Layout user={user} onLogout={logout}><ShiftSettings /></Layout>} />
        <Route path="/people" element={<Layout user={user} onLogout={logout}><People /></Layout>} />
        <Route path="/shift-pattern" element={<Layout user={user} onLogout={logout}><ShiftPattern /></Layout>} />
        <Route path="/admin" element={<Layout user={user} onLogout={logout}><Admin /></Layout>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
