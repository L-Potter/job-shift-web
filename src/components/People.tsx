import React, { useState, useEffect } from 'react'
import { useUsersAPI, User } from '../hooks/useUsersAPI'
import { useCalendarTagsAPI } from '../hooks/useCalendarTagsAPI'
import EmployeeDetailPanel from './EmployeeDetailPanel'
import './People.css'

const People: React.FC = () => {
  const { getUsers } = useUsersAPI()
  const { getCalendarTags } = useCalendarTagsAPI()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showDetailPanel, setShowDetailPanel] = useState(false)

  useEffect(() => {
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
    loadUsers()
  }, [])

  const handleOpenDetail = (user: User) => {
    setSelectedUser(user)
    setShowDetailPanel(true)
  }

  const handleCloseDetail = () => {
    setShowDetailPanel(false)
    setSelectedUser(null)
  }

  return (
    <>
      <div className={`people-page ${showDetailPanel ? 'dimmed' : ''}`}>
        <div className="people-header">
          <h1>員工管理</h1>
        </div>

        <div className="people-table-container">
          {loading ? (
            <div style={{ padding: '20px', textAlign: 'center' }}>載入中...</div>
          ) : (
            <table className="people-table">
              <thead>
                <tr>
                  <th>姓名</th>
                  <th>工號</th>
                  <th>班別</th>
                  <th>廠區</th>
                  <th className="action-column"></th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
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
                          <span className="badge shift-badge">{user.shift_type} 班</span>
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
                      <td className="action-column">
                        <button
                          className="action-menu-btn"
                          onClick={() => handleOpenDetail(user)}
                          title="編輯資訊"
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="1"/>
                            <circle cx="12" cy="5" r="1"/>
                            <circle cx="12" cy="19" r="1"/>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showDetailPanel && selectedUser && (
        <EmployeeDetailPanel
          user={selectedUser}
          onClose={handleCloseDetail}
        />
      )}
    </>
  )
}

export default People
