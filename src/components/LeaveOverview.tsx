import React, { useState, useMemo, useEffect } from 'react'
import { useShiftAssignmentsAPI, ShiftAssignment } from '../hooks/useShiftAssignmentsAPI'
import { useShiftSettingAPI, LeaveType } from '../hooks/useShiftSettingAPI'
import { useUsersAPI, User } from '../hooks/useUsersAPI'
import { useCalendarTags } from '../hooks/useCalendarTags'
import { useAuth } from '../hooks/useAuth'
import './LeaveOverview.css'

const LeaveOverview: React.FC = () => {
  const {
    getShiftAssignments,
    saveShiftAssignment,
    deleteShiftAssignment,
    moveShiftAssignment,
  } = useShiftAssignmentsAPI()
  const { getLeaveTypes } = useShiftSettingAPI()
  const { getUsers, getUser } = useUsersAPI()
  const { getMonthMap } = useCalendarTags()
  const { user } = useAuth()

  const [currentDate, setCurrentDate] = useState(new Date())
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const [selectedDateRow, setSelectedDateRow] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([])
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [employees, setEmployees] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [dayNightFilter, setDayNightFilter] = useState<'all' | 'D' | 'N'>('all')

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const [users, types] = await Promise.all([
          getUsers(),
          getLeaveTypes()
        ])
        setEmployees(users)
        setLeaveTypes(types)

        // Load shift assignments for all users
        const allAssignments: ShiftAssignment[] = []
        for (const user of users) {
          try {
            const userAssignments = await getShiftAssignments(user.employee_id)
            allAssignments.push(...userAssignments)
          } catch (error) {
            console.error(`Failed to load assignments for user ${user.employee_id}:`, error)
          }
        }
        setAssignments(allAssignments)
      } catch (error) {
        console.error('Failed to load data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Fetch current user's day_night information and set filter
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user?.user_id) {
        try {
          const userProfile = await getUser(user.user_id)
          if (userProfile.day_night) {
            setDayNightFilter(userProfile.day_night)
          }
        } catch (error) {
          console.error('Failed to fetch user profile:', error)
        }
      }
    }
    fetchUserProfile()
  }, [user?.user_id, getUser])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // 获取当前月的所有日期
  const dates = useMemo(() => {
    const lastDay = new Date(year, month + 1, 0)
    const days: Date[] = []
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i))
    }
    return days
  }, [year, month])

  const monthTagMap = getMonthMap(year, month)

  // 根據日期的班別標籤過濾可用的請假類型
  const getAvailableLeaveTypesForDate = (dateString: string) => {
    const tag = monthTagMap[dateString]

    if (!tag?.pattern) return leaveTypes

    const userShift = user?.shift_type || 'A'
    const isSameShift = userShift === tag.pattern

    console.log('Debug getAvailableLeaveTypesForDate:', {
      dateString,
      userShift,
      tagPattern: tag.pattern,
      isSameShift,
      user: user
    })

    // 如果用戶班別與當天班別相同，顯示工作日相關的請假類型 (is_not_workday = 0)
    // 如果不同，顯示非工作日相關的請假類型 (is_not_workday = 1，如加班)
    let filteredTypes
    if (isSameShift) {
      filteredTypes = leaveTypes.filter(type => type.is_not_workday === 0)
    } else {
      filteredTypes = leaveTypes.filter(type => type.is_not_workday === 1)
    }

    console.log('Filtered leave types:', filteredTypes.map(t => ({ name: t.name, is_not_workday: t.is_not_workday })))

    return filteredTypes
  }

  // 按is_not_workday分组假别类型
  const groupedLeaveTypes = useMemo(() => {
    const groups = {
      workday: leaveTypes.filter(lt => lt.is_not_workday === 0), // 工作日假别
      nonWorkday: leaveTypes.filter(lt => lt.is_not_workday === 1) // 非工作日假别
    }
    return groups
  }, [leaveTypes])

  // 过滤员工列表
  const filteredEmployees = useMemo(() => {
    if (dayNightFilter === 'all') return employees
    return employees.filter(employee => employee.day_night === dayNightFilter)
  }, [employees, dayNightFilter])

  // 获取指定日期和假别类型的人员列表
  const getPeopleForLeaveType = (dateString: string, leaveTypeName: string) => {
    return assignments
      .filter(a => a.date === dateString && a.shift_type === leaveTypeName)
      .map(a => {
        const employee = filteredEmployees.find(e => e.employee_id === a.employee_id)
        return employee?.name
      })
      .filter(Boolean)
  }

  // 生成日期字符串
  const formatDateString = (date: Date): string => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  // 获取星期几
  const getDayName = (date: Date): string => {
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
    return days[date.getDay()]
  }

  // 检查是否为今天
  const isToday = (date: Date): boolean => {
    const today = new Date()
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  }

  // 导航到上一个月
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  // 导航到下一个月
  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  // 选择月份和年份
  const selectMonth = (newMonth: number) => {
    setCurrentDate(new Date(year, newMonth, 1))
    setShowMonthPicker(false)
  }

  const selectYear = (newYear: number) => {
    setCurrentDate(new Date(newYear, month, 1))
  }

  const goToToday = () => {
    const today = new Date()
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1))
  }

  // 处理日期行双击
  const handleDateRowDoubleClick = (dateString: string) => {
    setSelectedDateRow(selectedDateRow === dateString ? null : dateString)
  }

  // 处理假别类型选择
  const handleLeaveTypeSelect = async (dateString: string, leaveTypeName: string) => {
    if (!user) return

    try {
      // 检查用户是否已经有该日期的假别分配
      const existingAssignment = assignments.find(
        a => a.employee_id === user.employee_id && a.date === dateString
      )

      // 如果已经存在分配且是相同的假别类型，则删除分配（取消选择）
      if (existingAssignment && existingAssignment.shift_type === leaveTypeName) {
        await deleteShiftAssignment(user.employee_id, dateString)
        // 从本地状态中移除
        setAssignments(prev => prev.filter(a => !(a.employee_id === user.employee_id && a.date === dateString)))
      } else {
        // 如果已经存在分配但选择了不同的假别类型，先删除现有的分配
        if (existingAssignment) {
          await deleteShiftAssignment(user.employee_id, dateString)
          // 从本地状态中移除
          setAssignments(prev => prev.filter(a => !(a.employee_id === user.employee_id && a.date === dateString)))
        }

        // 然后创建新的分配（PUT方法）
        const newAssignment = await saveShiftAssignment(user.employee_id, dateString, leaveTypeName)
        // 添加到本地状态
        setAssignments(prev => [...prev, newAssignment])
      }

      // 关闭菜单
      setSelectedDateRow(null)
    } catch (error) {
      console.error('保存假别分配失败:', error)
      alert('保存失敗，請重試')
    }
  }

  if (loading) {
    return <div className="leave-overview">Loading...</div>
  }

  return (
    <div className="leave-overview">
      <div className="overview-header">
        <div className="month-navigation">
          <button className="nav-arrow" onClick={goToPreviousMonth}>‹</button>
          <div className="month-display" onClick={() => setShowMonthPicker(!showMonthPicker)}>
            <span className="month-year">{month + 1}月, {year}</span>
            {showMonthPicker && (
              <div className="month-picker-dropdown">
                <div className="picker-section">
                  <div className="picker-title">选择月份</div>
                  <div className="month-grid">
                    {Array.from({ length: 12 }, (_, i) => (
                      <button key={i} className={`month-option ${i === month ? 'selected' : ''}`} onClick={() => selectMonth(i)}>{i + 1}月</button>
                    ))}
                  </div>
                </div>
                <div className="picker-section">
                  <div className="picker-title">选择年份</div>
                  <div className="year-input-group">
                    <input type="number" value={year} onChange={(e) => selectYear(parseInt(e.target.value) || year)} className="year-input" />
                  </div>
                </div>
              </div>
            )}
          </div>
          <button className="nav-arrow" onClick={goToNextMonth}>›</button>
        </div>
        <div className="header-controls">
          <button className="today-button" onClick={goToToday}>Today</button>
        </div>
      </div>

      <div className="overview-table">
        {dates.map((date) => {
          const dateString = formatDateString(date)
          const tag = monthTagMap[dateString]
          const isSelected = selectedDateRow === dateString
          return (
            <div
              key={date.getTime()}
              className={`date-row ${isSelected ? 'selected' : ''}`}
              onDoubleClick={() => handleDateRowDoubleClick(dateString)}
            >
              {/* 左侧日期 */}
              <div className={`date-column ${tag?.pattern === 'B' ? 'pattern-b' : ''}`}>
                <div className="day-name">{getDayName(date)}</div>
                <div className={`day-number ${isToday(date) ? 'today' : ''}`}>
                  {date.getDate()}
                </div>
              </div>

              {/* 右侧假别列表 */}
              <div className="leave-column">
                {/* 第一组：工作日假别 (is_not_workday = 0) */}
                <div className="leave-group">
                  {groupedLeaveTypes.workday
                    .filter((leaveType) => getPeopleForLeaveType(dateString, leaveType.name).length > 0)
                    .map((leaveType) => {
                      const people = getPeopleForLeaveType(dateString, leaveType.name)
                      return (
                        <div key={leaveType.leave_id} className="leave-item">
                          <div
                            className="leave-name"
                            style={{ backgroundColor: leaveType.color || '#ff9800' }}
                          >
                            {leaveType.name}
                          </div>
                          <div className="people-names">
                            {people.join(', ')}
                          </div>
                        </div>
                      )
                    })}
                </div>

                {/* 第二组：非工作日假别 (is_not_workday = 1) */}
                <div className="leave-group">
                  {groupedLeaveTypes.nonWorkday
                    .filter((leaveType) => getPeopleForLeaveType(dateString, leaveType.name).length > 0)
                    .map((leaveType) => {
                      const people = getPeopleForLeaveType(dateString, leaveType.name)
                      return (
                        <div key={leaveType.leave_id} className="leave-item">
                          <div
                            className="leave-name"
                            style={{ backgroundColor: leaveType.color || '#ff9800' }}
                          >
                            {leaveType.name}
                          </div>
                          <div className="people-names">
                            {people.join(', ')}
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>

              {/* 双击显示的可用假别类型菜单 */}
              {isSelected && (
                <div className="date-leave-menu">
                  <div className="menu-title">可用假別類型</div>
                  <div className="available-leave-types">
                    {getAvailableLeaveTypesForDate(dateString).map((leaveType) => {
                      const isUserAssigned = assignments.some(
                        a => a.employee_id === user?.employee_id &&
                             a.date === dateString &&
                             a.shift_type === leaveType.name
                      )
                      return (
                        <div
                          key={leaveType.leave_id}
                          className={`available-leave-item ${isUserAssigned ? 'assigned' : ''}`}
                          onClick={() => handleLeaveTypeSelect(dateString, leaveType.name)}
                        >
                          <div
                            className="leave-type-badge"
                            style={{ backgroundColor: leaveType.color || '#ff9800' }}
                          >
                            {leaveType.name}
                          </div>
                          <span className="leave-type-info">
                            {leaveType.is_not_workday === 0 ? '工作日' : '非工作日'}
                            {isUserAssigned && ' (已選擇)'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  <button
                    className="close-menu-btn"
                    onClick={() => setSelectedDateRow(null)}
                  >
                    關閉
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default LeaveOverview
