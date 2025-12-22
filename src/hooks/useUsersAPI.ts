export interface User {
  user_id: number
  name: string
  employee_id: string
  shift_type: 'A' | 'B' | null
  site: 'P1' | 'P2' | 'P3' | 'P4' | null
  day_night: 'D' | 'N' | null
  role: 'user' | 'admin'
  created_at: string
}

export interface CreateUserData {
  name: string
  employee_id: string
  password: string
  shift_type?: 'A' | 'B'
  site?: 'P1' | 'P2' | 'P3' | 'P4'
  day_night?: 'D' | 'N'
  role?: 'user' | 'admin'
}

const API_BASE_URL = '/api'

export const useUsersAPI = () => {
  // 获取所有用户
  const getUsers = async (): Promise<User[]> => {
    const response = await fetch(`${API_BASE_URL}/users`)
    if (!response.ok) {
      throw new Error('获取用户列表失败')
    }
    return response.json()
  }

  // 获取单个用户
  const getUser = async (id: number): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/users/${id}`)
    if (!response.ok) {
      throw new Error('获取用户失败')
    }
    return response.json()
  }

  // 创建用户
  const createUser = async (userData: CreateUserData): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || '创建用户失败')
    }
    
    return response.json()
  }

  // 更新用户
  const updateUser = async (id: number, updates: Partial<CreateUserData>): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/users/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || '更新用户失败')
    }
  }

  // 删除用户
  const deleteUser = async (id: number): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/users/${id}`, {
      method: 'DELETE',
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || '删除用户失败')
    }
  }

  return {
    getUsers,
    getUser,
    createUser,
    updateUser,
    deleteUser,
  }
}
