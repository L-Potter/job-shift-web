import React, { useState, useEffect } from 'react'
import { useUsersAPI, User, CreateUserData } from '../hooks/useUsersAPI'
import './Admin.css'

const Admin: React.FC = () => {
  const { getUsers, createUser, deleteUser } = useUsersAPI()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState<CreateUserData>({
    name: '',
    employee_id: '',
    password: '',
    shift_type: 'A',
    site: 'P1',
    day_night: 'D',
    role: 'user',
  })
  const [showSuccess, setShowSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // 加载用户列表
  useEffect(() => {
    loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const data = await getUsers()
      setUsers(data)
    } catch (error) {
      console.error('加载用户列表失败:', error)
      alert('加载用户列表失败: ' + (error instanceof Error ? error.message : '未知错误'))
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim() || !formData.employee_id.trim() || !formData.password.trim()) {
      alert('請填寫姓名、工號和密碼')
      return
    }

    try {
      await createUser(formData)
      setShowSuccess(true)
      setFormData({
        name: '',
        employee_id: '',
        password: '',
        shift_type: 'A',
        site: 'P1',
        day_night: 'D',
        role: 'user',
      })
      setShowPassword(false)
      
      // 重新加载用户列表
      await loadUsers()
      
      setTimeout(() => setShowSuccess(false), 3000)
    } catch (error) {
      alert(error instanceof Error ? error.message : '創建用戶失敗')
    }
  }

  const handleDelete = async (userId: number, name: string) => {
    if (window.confirm(`確定要刪除員工「${name}」嗎？`)) {
      try {
        await deleteUser(userId)
        // 重新加载用户列表
        await loadUsers()
      } catch (error) {
        alert(error instanceof Error ? error.message : '刪除用戶失敗')
      }
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>管理員 - 用戶管理</h1>
      </div>

      <div className="admin-content">
        {/* 創建用戶表單 */}
        <div className="create-user-section">
          <h2>新增員工</h2>
          {showSuccess && (
            <div className="success-message">✓ 員工已成功新增</div>
          )}
          <form onSubmit={handleSubmit} className="user-form">
            <div className="form-group">
              <label htmlFor="name">姓名 *</label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="請輸入姓名"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="employee_id">工號 *</label>
              <input
                id="employee_id"
                type="text"
                value={formData.employee_id}
                onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                placeholder="請輸入工號"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">密碼 *</label>
              <div className="password-input-wrapper">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="請輸入密碼"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? '隱藏密碼' : '顯示密碼'}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="shift_type">班別 *</label>
              <select
                id="shift_type"
                value={formData.shift_type}
                onChange={(e) => setFormData({ ...formData, shift_type: e.target.value as CreateUserData['shift_type'] })}
                required
              >
                <option value="A">A 班</option>
                <option value="B">B 班</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="site">廠區 *</label>
              <select
                id="site"
                value={formData.site}
                onChange={(e) => setFormData({ ...formData, site: e.target.value as CreateUserData['site'] })}
                required
              >
                <option value="P1">P1</option>
                <option value="P2">P2</option>
                <option value="P3">P3</option>
                <option value="P4">P4</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="day_night">日夜班 *</label>
              <select
                id="day_night"
                value={formData.day_night}
                onChange={(e) => setFormData({ ...formData, day_night: e.target.value as CreateUserData['day_night'] })}
                required
              >
                <option value="D">日班</option>
                <option value="N">夜班</option>
              </select>
            </div>

            <button type="submit" className="submit-btn">新增員工</button>
          </form>
        </div>

        {/* 員工列表 */}
        <div className="user-list-section">
          <h2>員工列表 ({users.length})</h2>
          {loading ? (
            <div style={{ padding: '20px', textAlign: 'center' }}>載入中...</div>
          ) : (
            <div className="user-table-container">
              <table className="user-table">
                <thead>
                  <tr>
                    <th>姓名</th>
                    <th>工號</th>
                    <th>班別</th>
                    <th>廠區</th>
                    <th>日夜班</th>
                    <th>角色</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                        尚無員工資料
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.user_id}>
                        <td>{user.name}</td>
                        <td>{user.employee_id}</td>
                        <td>
                          {user.shift_type ? (
                            <span className="badge shift-badge">{user.shift_type}</span>
                          ) : (
                            <span style={{ color: '#999' }}>-</span>
                          )}
                        </td>
                        <td>
                          {user.site ? (
                            <span className="badge factory-badge">{user.site}</span>
                          ) : (
                            <span style={{ color: '#999' }}>-</span>
                          )}
                        </td>
                        <td>
                          {user.day_night ? (
                            <span className="badge day-night-badge">{user.day_night === 'D' ? '日班' : '夜班'}</span>
                          ) : (
                            <span style={{ color: '#999' }}>-</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${user.role === 'admin' ? 'role-admin' : 'role-user'}`}>
                            {user.role === 'admin' ? '管理員' : '一般用戶'}
                          </span>
                        </td>
                        <td>
                          <button
                            className="delete-btn"
                            onClick={() => handleDelete(user.user_id, user.name)}
                          >
                            刪除
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Admin
