import { useState, useEffect } from 'react'

export interface User {
  user_id: number
  name: string
  employee_id: string
  shift_type: 'A' | 'B' | null
  site: 'P1' | 'P2' | 'P3' | 'P4' | null
  day_night: 'D' | 'N' | null
  role: 'user' | 'admin'
}

const API_BASE_URL = '/api'

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Check if user is logged in on app start
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/status`, {
          credentials: 'include'
        })
        if (response.ok) {
          const data = await response.json()
          if (data.authenticated) {
            setUser(data.user)
          }
        }
      } catch (error) {
        console.error('Failed to check auth status:', error)
      } finally {
        setLoading(false)
      }
    }
    checkAuth()
  }, [])

  // Login function
  const login = async (employeeId: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          employee_id: employeeId,
          password: password,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '登入失敗')
      }

      const userData = await response.json()
      setUser(userData)
      return true
    } catch (error) {
      console.error('Login failed:', error)
      return false
    }
  }

  // Logout function
  const logout = async () => {
    try {
      await fetch(`${API_BASE_URL}/logout`, {
        method: 'POST',
        credentials: 'include'
      })
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      setUser(null)
    }
  }

  // Check if user is authenticated
  const isAuthenticated = () => {
    return user !== null
  }

  return {
    user,
    loading,
    login,
    logout,
    isAuthenticated,
  }
}
