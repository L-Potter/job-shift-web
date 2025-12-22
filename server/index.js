const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const session = require('express-session');

const app = express();
const PORT = 3001;

// 数据库文件路径
const dbPath = path.join(__dirname, '..', 'database.db');

// 中间件
app.use(cors({
  origin: 'http://localhost:5175', // Frontend URL
  credentials: true
}));
app.use(express.json());

// Session middleware
app.use(session({
  secret: 'your-secret-key', // In production, use a strong secret
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// 数据库连接
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ 无法连接数据库:', err.message);
    process.exit(1);
  }
  console.log('✅ 已连接到数据库');
});

// 启用外键约束
db.run('PRAGMA foreign_keys = ON');

// 简单的密码哈希函数（生产环境应使用 bcrypt）
const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

// 登录验证
app.post('/api/login', (req, res) => {
  const { employee_id, password } = req.body;

  if (!employee_id || !password) {
    return res.status(400).json({ error: '工號和密碼為必填項' });
  }

  // 查找用户
  db.get('SELECT user_id, name, employee_id, password_hash, shift_type, site, day_night, role FROM users WHERE employee_id = ?', [employee_id], (err, row) => {
    if (err) {
      console.error('查找用户失败:', err);
      return res.status(500).json({ error: '登入失敗' });
    }

    if (!row) {
      return res.status(401).json({ error: '工號或密碼錯誤' });
    }

    // 验证密码
    const isValidPassword = hashPassword(password) === row.password_hash;
    if (!isValidPassword) {
      return res.status(401).json({ error: '工號或密碼錯誤' });
    }

    // 登录成功，存储用户信息到session
    const userData = {
      user_id: row.user_id,
      name: row.name,
      employee_id: row.employee_id,
      shift_type: row.shift_type,
      site: row.site,
      day_night: row.day_night,
      role: row.role
    };

    req.session.user = userData;

    // 返回用户信息
    res.json(userData);
  });
});

// 登出
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('登出失败:', err);
      return res.status(500).json({ error: '登出失败' });
    }
    res.clearCookie('connect.sid'); // Clear the session cookie
    res.json({ message: '登出成功' });
  });
});

// 检查登录状态
app.get('/api/auth/status', (req, res) => {
  if (req.session.user) {
    res.json({ authenticated: true, user: req.session.user });
  } else {
    res.json({ authenticated: false });
  }
});

// 获取所有用户
app.get('/api/users', (req, res) => {
  db.all('SELECT user_id, name, employee_id, shift_type, site, day_night, role, created_at FROM users ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      console.error('获取用户列表失败:', err);
      return res.status(500).json({ error: '获取用户列表失败' });
    }
    res.json(rows);
  });
});

// 获取单个用户
app.get('/api/users/:id', (req, res) => {
  const userId = req.params.id;
  db.get('SELECT user_id, name, employee_id, shift_type, site, day_night, role, created_at FROM users WHERE user_id = ?', [userId], (err, row) => {
    if (err) {
      console.error('获取用户失败:', err);
      return res.status(500).json({ error: '获取用户失败' });
    }
    if (!row) {
      return res.status(404).json({ error: '用户不存在' });
    }
    res.json(row);
  });
});

// 创建新用户
app.post('/api/users', (req, res) => {
  const { name, employee_id, password, shift_type, site, day_night, role } = req.body;

  // 验证必填字段
  if (!name || !employee_id || !password) {
    return res.status(400).json({ error: '姓名、工號和密碼為必填項' });
  }

  // 检查工號是否已存在
  db.get('SELECT user_id FROM users WHERE employee_id = ?', [employee_id], (err, row) => {
    if (err) {
      console.error('检查工號失败:', err);
      return res.status(500).json({ error: '检查工號失败' });
    }
    if (row) {
      return res.status(400).json({ error: '此工號已存在' });
    }

    // 创建用户
    const passwordHash = hashPassword(password);
    db.run(
      'INSERT INTO users (name, employee_id, password_hash, shift_type, site, day_night, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, employee_id, passwordHash, shift_type || null, site || null, day_night || null, role || 'user'],
      function(err) {
        if (err) {
          console.error('创建用户失败:', err);
          return res.status(500).json({ error: '创建用户失败' });
        }

        // 创建用户专属数据库文件
        const userDbPath = path.join(__dirname, '..', `${employee_id}.db`);
        const userDb = new sqlite3.Database(userDbPath, (dbErr) => {
          if (dbErr) {
            console.error(`创建用户数据库失败 (${employee_id}):`, dbErr);
            // 不返回错误，因为用户已创建
          } else {
            // 创建 leave_records 表
            userDb.run(`
              CREATE TABLE leave_records (
                user_id        INTEGER NOT NULL,
                leave_type_id  INTEGER NOT NULL,
                date           DATE NOT NULL,
                total_hours    DECIMAL(4,2) NOT NULL,
                created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
              );
            `, (tableErr) => {
              if (tableErr) {
                console.error(`创建 leave_records 表失败 (${employee_id}):`, tableErr);
              } else {
                console.log(`✅ 用户数据库和表创建成功: ${employee_id}.db`);
              }
              userDb.close();
            });
          }
        });

        res.status(201).json({
          user_id: this.lastID,
          name,
          employee_id,
          shift_type,
          site,
          day_night,
          role: role || 'user'
        });
      }
    );
  });
});

// 更新用户
app.put('/api/users/:id', (req, res) => {
  const userId = req.params.id;
  const { name, employee_id, shift_type, site, day_night, role, password } = req.body;

  // 检查用户是否存在
  db.get('SELECT user_id FROM users WHERE user_id = ?', [userId], (err, row) => {
    if (err) {
      console.error('检查用户失败:', err);
      return res.status(500).json({ error: '检查用户失败' });
    }
    if (!row) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 如果提供了新工號，检查是否与其他用户冲突
    if (employee_id) {
      db.get('SELECT user_id FROM users WHERE employee_id = ? AND user_id != ?', [employee_id, userId], (err, conflictRow) => {
        if (err) {
          console.error('检查工號冲突失败:', err);
          return res.status(500).json({ error: '检查工號冲突失败' });
        }
        if (conflictRow) {
          return res.status(400).json({ error: '此工號已被其他用户使用' });
        }
        updateUser();
      });
    } else {
      updateUser();
    }

    function updateUser() {
      const updates = [];
      const values = [];

      if (name) {
        updates.push('name = ?');
        values.push(name);
      }
      if (employee_id) {
        updates.push('employee_id = ?');
        values.push(employee_id);
      }
      if (password) {
        updates.push('password_hash = ?');
        values.push(hashPassword(password));
      }
      if (shift_type !== undefined) {
        updates.push('shift_type = ?');
        values.push(shift_type);
      }
      if (site !== undefined) {
        updates.push('site = ?');
        values.push(site);
      }
      if (day_night !== undefined) {
        updates.push('day_night = ?');
        values.push(day_night);
      }
      if (role) {
        updates.push('role = ?');
        values.push(role);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: '没有提供要更新的字段' });
      }

      values.push(userId);
      const sql = `UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`;

      db.run(sql, values, function(err) {
        if (err) {
          console.error('更新用户失败:', err);
          return res.status(500).json({ error: '更新用户失败' });
        }
        res.json({ message: '用户更新成功', changes: this.changes });
      });
    }
  });
});

// 删除用户
app.delete('/api/users/:id', (req, res) => {
  const userId = req.params.id;

  // 先获取用户的 employee_id
  db.get('SELECT employee_id FROM users WHERE user_id = ?', [userId], (err, row) => {
    if (err) {
      console.error('获取用户工號失败:', err);
      return res.status(500).json({ error: '获取用户工號失败' });
    }
    if (!row) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const employeeId = row.employee_id;

    // 删除用户
    db.run('DELETE FROM users WHERE user_id = ?', [userId], function(deleteErr) {
      if (deleteErr) {
        console.error('删除用户失败:', deleteErr);
        return res.status(500).json({ error: '删除用户失败' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '用户不存在' });
      }

      // 删除用户专属数据库文件
      const userDbPath = path.join(__dirname, '..', `${employeeId}.db`);
      fs.unlink(userDbPath, (fsErr) => {
        if (fsErr && fsErr.code !== 'ENOENT') { // ENOENT means file doesn't exist, which is fine
          console.error(`删除用户数据库文件失败 (${employeeId}):`, fsErr);
          // 不返回错误，因为用户已删除
        } else {
          console.log(`✅ 用户数据库文件删除成功: ${employeeId}.db`);
        }
      });

      res.json({ message: '用户删除成功' });
    });
  });
});

// ==================== Calendar Tags API ====================

// 获取所有日历标签
app.get('/api/calendar-tags', (req, res) => {
  db.all('SELECT * FROM calendar_tags ORDER BY date', (err, rows) => {
    if (err) {
      console.error('获取日历标签失败:', err);
      return res.status(500).json({ error: '获取日历标签失败' });
    }
    res.json(rows);
  });
});

// 获取特定日期的标签
app.get('/api/calendar-tags/:date', (req, res) => {
  const date = req.params.date;
  db.get('SELECT * FROM calendar_tags WHERE date = ?', [date], (err, row) => {
    if (err) {
      console.error('获取日历标签失败:', err);
      return res.status(500).json({ error: '获取日历标签失败' });
    }
    res.json(row || null);
  });
});

// 设置或更新日历标签
app.put('/api/calendar-tags/:date', (req, res) => {
  const date = req.params.date;
  const { is_holiday, shift_type } = req.body;

  // 检查日期是否已存在
  db.get('SELECT date FROM calendar_tags WHERE date = ?', [date], (err, row) => {
    if (err) {
      console.error('检查日期失败:', err);
      return res.status(500).json({ error: '检查日期失败' });
    }

    if (row) {
      // 更新现有记录
      const updates = [];
      const values = [];

      if (is_holiday !== undefined) {
        updates.push('is_holiday = ?');
        values.push(is_holiday ? 1 : 0);
      }
      if (shift_type !== undefined) {
        updates.push('shift_type = ?');
        values.push(shift_type);
      }
      updates.push('updated_at = CURRENT_TIMESTAMP');

      if (updates.length === 1) { // 只有 updated_at
        return res.status(400).json({ error: '没有提供要更新的字段' });
      }

      values.push(date);
      const sql = `UPDATE calendar_tags SET ${updates.join(', ')} WHERE date = ?`;

      db.run(sql, values, function(err) {
        if (err) {
          console.error('更新日历标签失败:', err);
          return res.status(500).json({ error: '更新日历标签失败' });
        }
        res.json({ message: '日历标签更新成功', date });
      });
    } else {
      // 插入新记录
      db.run(
        'INSERT INTO calendar_tags (date, is_holiday, shift_type) VALUES (?, ?, ?)',
        [date, is_holiday ? 1 : 0, shift_type || null],
        function(err) {
          if (err) {
            console.error('创建日历标签失败:', err);
            return res.status(500).json({ error: '创建日历标签失败' });
          }
          res.status(201).json({ message: '日历标签创建成功', date });
        }
      );
    }
  });
});

// 删除日历标签
app.delete('/api/calendar-tags/:date', (req, res) => {
  const date = req.params.date;

  db.run('DELETE FROM calendar_tags WHERE date = ?', [date], function(err) {
    if (err) {
      console.error('删除日历标签失败:', err);
      return res.status(500).json({ error: '删除日历标签失败' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: '日历标签不存在' });
    }
    res.json({ message: '日历标签删除成功' });
  });
});

// 批量设置日历标签
app.post('/api/calendar-tags/batch', (req, res) => {
  const { tags } = req.body; // tags: Array<{ date, is_holiday?, shift_type? }>

  if (!Array.isArray(tags) || tags.length === 0) {
    return res.status(400).json({ error: '无效的标签数组' });
  }

  const stmt = db.prepare(`
    INSERT INTO calendar_tags (date, is_holiday, shift_type) 
    VALUES (?, ?, ?)
    ON CONFLICT(date) 
    DO UPDATE SET 
      is_holiday = excluded.is_holiday,
      shift_type = excluded.shift_type,
      updated_at = CURRENT_TIMESTAMP
  `);

  let completed = 0;
  let errors = [];

  tags.forEach((tag, index) => {
    stmt.run([tag.date, tag.is_holiday ? 1 : 0, tag.shift_type || null], (err) => {
      if (err) {
        errors.push({ index, date: tag.date, error: err.message });
      }
      completed++;

      if (completed === tags.length) {
        stmt.finalize();
        if (errors.length > 0) {
          res.status(207).json({ 
            message: '批量操作完成，但有部分失败', 
            errors,
            success: tags.length - errors.length,
            total: tags.length
          });
        } else {
          res.json({ message: '批量操作成功', count: tags.length });
        }
      }
    });
  });
});

// ==================== Shift Assignments API ====================

// 获取用户的排班数据
app.get('/api/shift-assignments/:employeeId', (req, res) => {
  const employeeId = req.params.employeeId;
  const userDbPath = path.join(__dirname, '..', `${employeeId}.db`);

  // 检查用户数据库是否存在
  if (!fs.existsSync(userDbPath)) {
    return res.status(404).json({ error: '用户数据库不存在' });
  }

  // 以只读模式打开数据库，避免误修改其他用户数据
  const userDb = new sqlite3.Database(userDbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error(`连接用户数据库失败 (${employeeId}):`, err);
      return res.status(500).json({ error: '连接用户数据库失败' });
    }
  });

  // 确保 shift_assignments 表存在
  userDb.run(`
    CREATE TABLE IF NOT EXISTS shift_assignments (
      employee_id    TEXT NOT NULL,
      date           DATE NOT NULL,
      shift_type     TEXT NOT NULL,
      created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (employee_id, date)
    );
  `, (tableErr) => {
    if (tableErr) {
      console.error(`创建 shift_assignments 表失败 (${employeeId}):`, tableErr);
      userDb.close();
      return res.status(500).json({ error: '创建表失败' });
    }

    // 获取所有排班数据
    userDb.all('SELECT * FROM shift_assignments ORDER BY date', (err, rows) => {
      userDb.close();
      if (err) {
        console.error('获取排班数据失败:', err);
        return res.status(500).json({ error: '获取排班数据失败' });
      }
      res.json(rows);
    });
  });
});

// 创建或更新排班
app.put('/api/shift-assignments/:employeeId/:date', (req, res) => {
  const employeeId = req.params.employeeId;
  const date = req.params.date;
  const { shift_type } = req.body;

  if (!shift_type) {
    return res.status(400).json({ error: '排班类型为必填项' });
  }

  const userDbPath = path.join(__dirname, '..', `${employeeId}.db`);

  // 检查用户数据库是否存在
  if (!fs.existsSync(userDbPath)) {
    return res.status(404).json({ error: '用户数据库不存在' });
  }

  const userDb = new sqlite3.Database(userDbPath, (err) => {
    if (err) {
      console.error(`连接用户数据库失败 (${employeeId}):`, err);
      return res.status(500).json({ error: '连接用户数据库失败' });
    }
  });

  // 确保 shift_assignments 表存在
  userDb.run(`
    CREATE TABLE IF NOT EXISTS shift_assignments (
      employee_id    TEXT NOT NULL,
      date           DATE NOT NULL,
      shift_type     TEXT NOT NULL,
      created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (employee_id, date)
    );
  `, (tableErr) => {
    if (tableErr) {
      console.error(`创建 shift_assignments 表失败 (${employeeId}):`, tableErr);
      userDb.close();
      return res.status(500).json({ error: '创建表失败' });
    }

    // 插入或更新排班
    userDb.run(
      `INSERT INTO shift_assignments (employee_id, date, shift_type)
       VALUES (?, ?, ?)
       ON CONFLICT(employee_id, date)
       DO UPDATE SET
         shift_type = excluded.shift_type,
         updated_at = CURRENT_TIMESTAMP`,
      [employeeId, date, shift_type],
      function(err) {
        userDb.close();
        if (err) {
          console.error('保存排班失败:', err);
          return res.status(500).json({ error: '保存排班失败' });
        }
        res.json({
          employee_id: employeeId,
          date,
          shift_type,
          message: '排班保存成功'
        });
      }
    );
  });
});

// 删除排班
app.delete('/api/shift-assignments/:employeeId/:date', (req, res) => {
  const employeeId = req.params.employeeId;
  const date = req.params.date;
  const userDbPath = path.join(__dirname, '..', `${employeeId}.db`);

  // 检查用户数据库是否存在
  if (!fs.existsSync(userDbPath)) {
    return res.status(404).json({ error: '用户数据库不存在' });
  }

  const userDb = new sqlite3.Database(userDbPath, (err) => {
    if (err) {
      console.error(`连接用户数据库失败 (${employeeId}):`, err);
      return res.status(500).json({ error: '连接用户数据库失败' });
    }
  });

  userDb.run(
    'DELETE FROM shift_assignments WHERE employee_id = ? AND date = ?',
    [employeeId, date],
    function(err) {
      userDb.close();
      if (err) {
        console.error('删除排班失败:', err);
        return res.status(500).json({ error: '删除排班失败' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '排班不存在' });
      }
      res.json({ message: '排班删除成功' });
    }
  );
});

// 移动排班（用于拖拽功能）
app.post('/api/shift-assignments/:employeeId/move', (req, res) => {
  const employeeId = req.params.employeeId;
  const { from_date, to_employee_id, to_date } = req.body;

  if (!from_date || !to_employee_id || !to_date) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  const userDbPath = path.join(__dirname, '..', `${employeeId}.db`);

  // 检查用户数据库是否存在
  if (!fs.existsSync(userDbPath)) {
    return res.status(404).json({ error: '用户数据库不存在' });
  }

  const userDb = new sqlite3.Database(userDbPath, (err) => {
    if (err) {
      console.error(`连接用户数据库失败 (${employeeId}):`, err);
      return res.status(500).json({ error: '连接用户数据库失败' });
    }
  });

  // 获取要移动的排班
  userDb.get(
    'SELECT shift_type FROM shift_assignments WHERE employee_id = ? AND date = ?',
    [employeeId, from_date],
    (err, row) => {
      if (err) {
        console.error('获取排班失败:', err);
        userDb.close();
        return res.status(500).json({ error: '获取排班失败' });
      }

      if (!row) {
        userDb.close();
        return res.status(404).json({ error: '源排班不存在' });
      }

      const shiftType = row.shift_type;

      // 检查目标位置是否已有排班
      userDb.get(
        'SELECT shift_type FROM shift_assignments WHERE employee_id = ? AND date = ?',
        [to_employee_id, to_date],
        (targetErr, targetRow) => {
          if (targetErr) {
            console.error('检查目标位置失败:', targetErr);
            userDb.close();
            return res.status(500).json({ error: '检查目标位置失败' });
          }

          if (targetRow) {
            // 交换排班
            userDb.run(
              `UPDATE shift_assignments SET shift_type = ?, updated_at = CURRENT_TIMESTAMP
               WHERE employee_id = ? AND date = ?`,
              [shiftType, to_employee_id, to_date],
              (updateErr1) => {
                if (updateErr1) {
                  console.error('更新目标位置失败:', updateErr1);
                  userDb.close();
                  return res.status(500).json({ error: '更新目标位置失败' });
                }

                userDb.run(
                  `UPDATE shift_assignments SET shift_type = ?, updated_at = CURRENT_TIMESTAMP
                   WHERE employee_id = ? AND date = ?`,
                  [targetRow.shift_type, employeeId, from_date],
                  (updateErr2) => {
                    userDb.close();
                    if (updateErr2) {
                      console.error('更新源位置失败:', updateErr2);
                      return res.status(500).json({ error: '更新源位置失败' });
                    }
                    res.json({ message: '排班交换成功' });
                  }
                );
              }
            );
          } else {
            // 移动到新位置
            userDb.run(
              `UPDATE shift_assignments SET employee_id = ?, date = ?, updated_at = CURRENT_TIMESTAMP
               WHERE employee_id = ? AND date = ?`,
              [to_employee_id, to_date, employeeId, from_date],
              (moveErr) => {
                userDb.close();
                if (moveErr) {
                  console.error('移动排班失败:', moveErr);
                  return res.status(500).json({ error: '移动排班失败' });
                }
                res.json({ message: '排班移动成功' });
              }
            );
          }
        }
      );
    }
  );
});

// ==================== Leave Types API ====================

// 获取所有请假类型
app.get('/api/leave-types', (req, res) => {
  db.all('SELECT * FROM leave_types ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      console.error('获取请假类型失败:', err);
      return res.status(500).json({ error: '获取请假类型失败' });
    }
    res.json(rows);
  });
});

// 获取员工的请假类型（支持employee_id参数）
app.get('/api/leave-types/:employeeId', (req, res) => {
  const employeeId = req.params.employeeId;

  // 验证员工是否存在
  db.get('SELECT user_id FROM users WHERE employee_id = ?', [employeeId], (err, userRow) => {
    if (err) {
      console.error('验证员工失败:', err);
      return res.status(500).json({ error: '验证员工失败' });
    }

    if (!userRow) {
      return res.status(404).json({ error: '员工不存在' });
    }

    // 返回所有请假类型（可以根据员工角色或班别进行过滤）
    db.all('SELECT * FROM leave_types ORDER BY created_at DESC', (err, rows) => {
      if (err) {
        console.error('获取请假类型失败:', err);
        return res.status(500).json({ error: '获取请假类型失败' });
      }
      res.json({
        employee_id: employeeId,
        leave_types: rows
      });
    });
  });
});

// 获取特定请假类型
app.get('/api/leave-types/:id', (req, res) => {
  const leaveId = req.params.id;
  db.get('SELECT * FROM leave_types WHERE leave_id = ?', [leaveId], (err, row) => {
    if (err) {
      console.error('获取请假类型失败:', err);
      return res.status(500).json({ error: '获取请假类型失败' });
    }
    if (!row) {
      return res.status(404).json({ error: '请假类型不存在' });
    }
    res.json(row);
  });
});

// 创建新请假类型
app.post('/api/leave-types', (req, res) => {
  const { name, is_not_workday, color } = req.body;

  // 验证必填字段
  if (!name) {
    return res.status(400).json({ error: '请假类型名稱為必填項' });
  }

  // 检查名稱是否已存在
  db.get('SELECT leave_id FROM leave_types WHERE name = ?', [name], (err, row) => {
    if (err) {
      console.error('检查名稱失败:', err);
      return res.status(500).json({ error: '检查名稱失败' });
    }
    if (row) {
      return res.status(400).json({ error: '此名稱已存在' });
    }

    // 创建请假类型
    db.run(
      'INSERT INTO leave_types (name, is_not_workday, color) VALUES (?, ?, ?)',
      [name, is_not_workday ? 1 : 0, color || '#ff9800'],
      function(err) {
        if (err) {
          console.error('创建请假类型失败:', err);
          return res.status(500).json({ error: '创建请假类型失败' });
        }
        res.status(201).json({
          leave_id: this.lastID,
          name,
          is_not_workday: is_not_workday ? 1 : 0,
          color: color || '#ff9800'
        });
      }
    );
  });
});

// 更新请假类型
app.put('/api/leave-types/:id', (req, res) => {
  const leaveId = req.params.id;
  const { name, is_not_workday, color } = req.body;

  // 检查请假类型是否存在
  db.get('SELECT leave_id FROM leave_types WHERE leave_id = ?', [leaveId], (err, row) => {
    if (err) {
      console.error('检查请假类型失败:', err);
      return res.status(500).json({ error: '检查请假类型失败' });
    }
    if (!row) {
      return res.status(404).json({ error: '请假类型不存在' });
    }

    // 如果提供了新名稱，检查是否与其他请假类型冲突
    if (name) {
      db.get('SELECT leave_id FROM leave_types WHERE name = ? AND leave_id != ?', [name, leaveId], (err, conflictRow) => {
        if (err) {
          console.error('检查名稱冲突失败:', err);
          return res.status(500).json({ error: '检查名稱冲突失败' });
        }
        if (conflictRow) {
          return res.status(400).json({ error: '此名稱已被其他请假类型使用' });
        }
        updateLeaveType();
      });
    } else {
      updateLeaveType();
    }

    function updateLeaveType() {
      const updates = [];
      const values = [];

      if (name) {
        updates.push('name = ?');
        values.push(name);
      }
      if (is_not_workday !== undefined) {
        updates.push('is_not_workday = ?');
        values.push(is_not_workday ? 1 : 0);
      }
      if (color) {
        updates.push('color = ?');
        values.push(color);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: '没有提供要更新的字段' });
      }

      values.push(leaveId);
      const sql = `UPDATE leave_types SET ${updates.join(', ')} WHERE leave_id = ?`;

      db.run(sql, values, function(err) {
        if (err) {
          console.error('更新请假类型失败:', err);
          return res.status(500).json({ error: '更新请假类型失败' });
        }
        res.json({ message: '请假类型更新成功', changes: this.changes });
      });
    }
  });
});

// 删除请假类型
app.delete('/api/leave-types/:id', (req, res) => {
  const leaveId = req.params.id;

  db.run('DELETE FROM leave_types WHERE leave_id = ?', [leaveId], function(err) {
    if (err) {
      console.error('删除请假类型失败:', err);
      return res.status(500).json({ error: '删除请假类型失败' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: '请假类型不存在' });
    }
    res.json({ message: '请假类型删除成功' });
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 API 服务器运行在 http://localhost:${PORT}`);
});

// 优雅关闭
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('关闭数据库连接失败:', err);
    } else {
      console.log('✅ 数据库连接已关闭');
    }
    process.exit(0);
  });
});
