import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { User } from '../hooks/useAuth'
import Sidebar from './Sidebar'

interface LayoutProps {
  children: React.ReactNode
  user: User | null
  onLogout: () => void
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  const location = useLocation()
  const navigate = useNavigate()

  // 将路由路径映射到视图
  const getViewFromPath = (path: string): 'overview' | 'settings' | 'people' | 'pattern' | 'admin' | 'scheduler' => {
    if (path === '/admin') return 'admin'
    if (path === '/settings' || path.startsWith('/shift-settings')) return 'settings'
    if (path === '/people') return 'people'
    if (path === '/pattern' || path.startsWith('/shift-pattern')) return 'pattern'
    if (path === '/scheduler') return 'scheduler'
    if (path === '/overview') return 'overview'
    return 'scheduler' // Default to scheduler instead of overview
  }

  const currentView = getViewFromPath(location.pathname)

  const handleViewChange = (view: 'overview' | 'settings' | 'people' | 'pattern' | 'admin' | 'scheduler') => {
    switch (view) {
      case 'overview':
        navigate('/overview')
        break
      case 'scheduler':
        navigate('/scheduler')
        break
      case 'settings':
        navigate('/shift-settings')
        break
      case 'people':
        navigate('/people')
        break
      case 'pattern':
        navigate('/shift-pattern')
        break
      case 'admin':
        navigate('/admin')
        break
    }
  }

  return (
    <div className="App">
      <Sidebar
        currentView={currentView}
        onViewChange={handleViewChange}
        user={user}
        onLogout={onLogout}
      />
      <div className="app-content">
        {children}
      </div>
    </div>
  )
}

export default Layout
