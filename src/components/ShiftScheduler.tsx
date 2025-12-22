import React, { useState, useMemo, useEffect } from 'react'
import { useShiftTypes, ShiftType } from '../hooks/useShiftTypes'
import { useUsersAPI, User } from '../hooks/useUsersAPI'
import { useShiftAssignmentsAPI, ShiftAssignment } from '../hooks/useShiftAssignmentsAPI'
import { useCalendarTags } from '../hooks/useCalendarTags'
import { useShiftSettingAPI, LeaveType } from '../hooks/useShiftSettingAPI'
import { useAuth } from '../hooks/useAuth'
import './ShiftScheduler.css'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const MONTHS_ZH = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月'
]

const ShiftScheduler: React.FC = () => {
  const { shiftTypes } = useShiftTypes()
  const { getUsers } = useUsersAPI()
  const {
    getShiftAssignments,
    saveShiftAssignment,
    deleteShiftAssignment,
    moveShiftAssignment,
  } = useShiftAssignmentsAPI()
  const { getMonthMap } = useCalendarTags()
  const { getLeaveTypes } = useShiftSettingAPI()
  const { user } = useAuth()
  const [currentDate, setCurrentDate] = useState(new Date()) // Today
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const [selectedShiftType, setSelectedShiftType] = useState<'A' | 'B'>(user?.shift_type || 'A')
  const [selectedCell, setSelectedCell] = useState<{ employeeId: string; date: string } | null>(null)
  // const [draggedShift, setDraggedShift] = useState<{ employeeId: string; date: string; type: string } | null>(null)
  // const [hoveredCell, setHoveredCell] = useState<{ employeeId: string; date: string } | null>(null)
  const [employees, setEmployees] = useState<User[]>([])
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([])
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load data on component mount
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

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const monthName = MONTHS[month]
  const monthNameZh = MONTHS_ZH[month]

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

    // 如果用戶班別與當天班別相同，顯示工作日相關的請假類型 (is_not_workday = 1)
    // 如果不同，顯示非工作日相關的請假類型 (is_not_workday = 0，如加班)
    let filteredTypes
    if (isSameShift) {
      filteredTypes = leaveTypes.filter(type => type.is_not_workday === 0)
    } else {
      filteredTypes = leaveTypes.filter(type => type.is_not_workday === 1)
    }

    console.log('Filtered leave types:', filteredTypes.map(t => ({ name: t.name, is_not_workday: t.is_not_workday })))

    return filteredTypes
  }

  // 获取星期几
  const getDayName = (date: Date): string => {
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
    return days[date.getDay()]
  }

  // 导航到上一个月
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  // 导航到下一个月
  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  // 导航到今天
  const goToToday = () => {
    const today = new Date()
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1))
  }

  // 选择月份和年份
  const selectMonth = (newMonth: number) => {
    setCurrentDate(new Date(year, newMonth, 1))
    setShowMonthPicker(false)
  }

  const selectYear = (newYear: number) => {
    setCurrentDate(new Date(newYear, month, 1))
  }

  // 获取某个员工在某一天的排班类型
  const getShiftForDate = (employeeId: string, date: string): ShiftType | null => {
    const assignment = assignments.find(a => a.employee_id === employeeId && a.date === date)
    if (!assignment) return null
    const leaveType = leaveTypes.find(t => t.name === assignment.shift_type)
    if (leaveType) {
      return { id: leaveType.name, label: leaveType.name, color: leaveType.color || '#ff9800' }
    }
    const shiftType = shiftTypes.find(t => t.id === assignment.shift_type)
    if (shiftType) {
      return shiftType
    }
    return null
  }

  // 处理日期单元格点击
  const handleDateClick = (employeeId: string, date: string) => {
    setSelectedCell({ employeeId, date })
  }

  // 删除排班
  const handleDeleteShift = async (employeeId: string, date: string) => {
    try {
      await deleteShiftAssignment(employeeId, date)
      setAssignments(assignments.filter(a => !(a.employee_id === employeeId && a.date === date)))
      setSelectedCell(null)
      setError(null)
    } catch (error) {
      console.error('Failed to delete shift assignment:', error)
      setError(error instanceof Error ? error.message : '刪除排班失敗')
    }
  }


  // 拖拽开始
  // const handleDragStart = (e: React.DragEvent, employeeId: string, date: string, shiftType: string) => {
  //   e.dataTransfer.effectAllowed = 'move'
  //   e.dataTransfer.setData('text/plain', '') // 某些浏览器需要
  //   setDraggedShift({ employeeId, date, type: shiftType })
  //   const img = new Image()
  //   e.dataTransfer.setDragImage(img, 0, 0)
  // }

  // 拖拽悬停
  // const handleDragOver = (e: React.DragEvent, employeeId: string, date: string) => {
  //   e.preventDefault()
  //   e.dataTransfer.dropEffect = 'move'
  //   setHoveredCell({ employeeId, date })
  // }

  // 拖拽离开
  // const handleDragLeave = () => {
  //   setHoveredCell(null)
  // }

  // 拖拽放下
  // const handleDrop = async (e: React.DragEvent, targetEmployeeId: string, targetDate: string) => {
  //   e.preventDefault()
  //   if (!draggedShift) return
  //   if (draggedShift.employeeId === targetEmployeeId && draggedShift.date === targetDate) {
  //     setDraggedShift(null)
  //     setHoveredCell(null)
  //     return
  //   }

  //   try {
  //     await moveShiftAssignment(draggedShift.employeeId, draggedShift.date, targetEmployeeId, targetDate)
  //     // Reload assignments after move
  //     const updatedAssignments = await getShiftAssignments(draggedShift.employeeId)
  //     setAssignments(updatedAssignments)
  //     setError(null)
  //   } catch (error) {
  //     console.error('Failed to move shift assignment:', error)
  //     setError(error instanceof Error ? error.message : '移動排班失敗')
  //   }

  //   setDraggedShift(null)
  //   setHoveredCell(null)
  // }

  // 拖拽结束
  // const handleDragEnd = () => {
  //   setDraggedShift(null)
  //   setHoveredCell(null)
  // }


  // 处理排班类型选择
  const handleShiftSelect = async (shiftType: string) => {
    if (!selectedCell) return

    try {
      const existing = assignments.find(a => a.employee_id === selectedCell.employeeId && a.date === selectedCell.date)
      if (existing) {
        if (existing.shift_type === shiftType) {
          await deleteShiftAssignment(selectedCell.employeeId, selectedCell.date)
          setAssignments(assignments.filter(a => !(a.employee_id === selectedCell.employeeId && a.date === selectedCell.date)))
        } else {
          const updated = await saveShiftAssignment(selectedCell.employeeId, selectedCell.date, shiftType)
          setAssignments(assignments.map(a =>
            a.employee_id === selectedCell.employeeId && a.date === selectedCell.date
              ? { ...a, shift_type: shiftType }
              : a
          ))
        }
      } else {
        const newAssignment = await saveShiftAssignment(selectedCell.employeeId, selectedCell.date, shiftType)
        setAssignments([...assignments, {
          employee_id: selectedCell.employeeId,
          date: selectedCell.date,
          shift_type: shiftType
        }])
      }
      setSelectedCell(null)
      setError(null)
    } catch (error) {
      console.error('Failed to save shift assignment:', error)
      setError(error instanceof Error ? error.message : '保存排班失敗')
    }
  }

  // 生成日期字符串
  const formatDateString = (date: Date): string => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
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

  if (loading) {
    return <div className="shift-scheduler">Loading...</div>
  }

  return (
    <div className="shift-scheduler">
      {/* 头部控制栏 */}
      <div className="scheduler-header">
        <div className="month-navigation">
          <button className="nav-arrow" onClick={goToPreviousMonth}>‹</button>
          <div className="month-display" onClick={() => setShowMonthPicker(!showMonthPicker)}>
            <span className="month-year">{monthNameZh}, {year}</span>
            {showMonthPicker && (
              <div className="month-picker-dropdown">
                <div className="picker-section">
                  <div className="picker-title">选择月份</div>
                  <div className="month-grid">
                    {MONTHS_ZH.map((m, index) => (
                      <button key={index} className={`month-option ${index === month ? 'selected' : ''}`} onClick={() => selectMonth(index)}>{m}</button>
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
        <button className="today-button" onClick={goToToday}>Today</button>
      </div>

      {/* 错误消息显示 */}
      {error && (
        <div className="error-banner">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <span className="error-text">{error}</span>
            <button
              className="error-close"
              onClick={() => setError(null)}
              title="關閉"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 日历表格 */}
      <div className="calendar-container">
        <div className="shift-calendar-grid">
          {/* 左侧员工列表 */}
          <div className="employee-column">
            <div className="employee-header">
              <div className="shift-type-selector">
                <span>班別: </span>
                <button
                  className={`shift-type-btn ${selectedShiftType === 'A' ? 'active' : ''}`}
                  onClick={() => setSelectedShiftType('A')}
                >
                  A
                </button>
                <button
                  className={`shift-type-btn ${selectedShiftType === 'B' ? 'active' : ''}`}
                  onClick={() => setSelectedShiftType('B')}
                >
                  B
                </button>
              </div>
            </div>
            {employees
              .filter(employee => employee.shift_type === selectedShiftType)
              .map((employee) => (
                <div key={employee.employee_id} className="employee-row">{employee.name}</div>
              ))}
          </div>

          {/* 日期区域 */}
          <div className="dates-section">
            {/* 日期头部 */}
            <div className="dates-header">
              {dates.map((date) => {
                const ds = formatDateString(date)
                const tag = monthTagMap[ds]
                return (
                  <div key={date.getTime()} className="date-header-cell">
                    <div className="day-name">{getDayName(date)}</div>
                    <div className={`day-number ${isToday(date) ? 'today' : ''}`}>
                      {date.getDate()}
                    </div>
                    {tag?.isHoliday && <div style={{ marginTop: 4, fontSize: 10, color: '#c62828' }}>假</div>}
                    {tag?.pattern && <div style={{ marginTop: 2, fontSize: 10, color: '#1976d2' }}>{tag.pattern}</div>}
                  </div>
                )
              })}
            </div>

            {/* 员工排班行 */}
            {employees
              .filter(employee => employee.shift_type === selectedShiftType)
              .map((employee) => (
                <div key={employee.employee_id} className="employee-shifts-row">
                  {dates.map((date) => {
                    const dateString = formatDateString(date)
                    const tag = monthTagMap[dateString]
                    const shift = getShiftForDate(employee.employee_id, dateString)
                    const isSelected = selectedCell?.employeeId === employee.employee_id && selectedCell?.date === dateString
                    // const isHovered = hoveredCell?.employeeId === employee.employee_id && hoveredCell?.date === dateString
                    // const isDragging = draggedShift?.employeeId === employee.employee_id && draggedShift?.date === dateString

                    return (
                      <div
                        key={dateString}
                        className={`shift-cell ${tag?.pattern === 'B' ? 'pattern-b' : ''} ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleDateClick(employee.employee_id, dateString)}
                        // onDragOver={(e) => handleDragOver(e, employee.employee_id, dateString)}
                        // onDragLeave={handleDragLeave}
                        // onDrop={(e) => handleDrop(e, employee.employee_id, dateString)}
                      >
                        {shift && (
                          <div
                            className="shift-badge"
                            style={{ backgroundColor: shift.color }}
                            // draggable
                            // onDragStart={(e) => handleDragStart(e, employee.employee_id, dateString, shift.id)}
                            // onDragEnd={handleDragEnd}
                            onClick={(e) => { e.stopPropagation(); setSelectedCell({ employeeId: employee.employee_id, date: dateString }) }}
                          >
                            {shift.label}
                          </div>
                        )}
                        {isSelected && (
                          <div className="shift-menu">
                            <div className="menu-title">{shift ? '編輯排班' : '選擇類型'}</div>
                            {!shift && getAvailableLeaveTypesForDate(dateString).map((type) => (
                              <button key={type.leave_id} className="shift-option" style={{ backgroundColor: type.color || '#ff9800' }} onClick={(e) => { e.stopPropagation(); handleShiftSelect(type.name) }}>{type.name}</button>
                            ))}
                            {shift && (
                              <>
                                <div className="menu-subtitle">更改類型</div>
                                {getAvailableLeaveTypesForDate(dateString).map((type) => (
                                  <button key={type.leave_id} className={`shift-option ${type.name === shift.id ? 'current' : ''}`} style={{ backgroundColor: type.color || '#ff9800' }} onClick={(e) => { e.stopPropagation(); handleShiftSelect(type.name) }}>
                                    {type.name} {type.name === shift.id ? '（目前）' : ''}
                                  </button>
                                ))}
                                <div className="menu-divider"></div>
                                <button className="shift-option delete" onClick={(e) => { e.stopPropagation(); handleDeleteShift(employee.employee_id, dateString) }}>🗑️ 刪除</button>
                              </>
                            )}
                            <button className="shift-option cancel" onClick={(e) => { e.stopPropagation(); setSelectedCell(null) }}>取消</button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* 排班类型图例 */}
      <div className="legend">
        <div className="legend-title">請假類型</div>
        <div className="legend-items">
          {leaveTypes.map((type) => (
            <div key={type.leave_id} className="legend-item">
              <div className="legend-color" style={{ backgroundColor: type.color || '#ff9800' }}></div>
              <span>{type.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ShiftScheduler
