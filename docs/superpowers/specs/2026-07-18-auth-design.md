# OfferHelper Web — 登录注册功能设计文档

**日期：** 2026-07-18
**状态：** 已审批
**范围：** 登录注册 Modal + case 关联

---

## 1. 功能定位

为 OfferHelper Web 添加用户认证，支持：
- 邮箱 + 密码 注册/登录
- Magic Link（无密码邮件登录）
- 分析完成后注册，自动把匿名 case 关联到账号
- 已登录用户分析时直接关联 user_id

---

## 2. 用户流程

**场景 1：未登录用户完成分析后注册**
```
分析完成 → 点「注册保存」
    ↓
弹出 AuthModal（默认注册 tab）
    ↓
填写邮箱 + 密码 → 注册成功 → 自动登录
    ↓
POST /api/claim-case { case_id, user_id }
    ↓
跳转 /dashboard
```

**场景 2：已有账号用户登录**
```
点首页右上角「登录 / 历史记录」
    ↓
弹出 AuthModal（默认登录 tab）
    ↓
邮箱+密码 或 Magic Link
    ↓
登录成功 → 关闭 Modal → 跳转 /dashboard
```

**场景 3：已登录用户**
```
首页右上角显示「历史记录 | 退出」
分析时 case 直接关联 user_id
分析完成后显示「查看历史记录」而非「注册保存」
```

**Magic Link 流程**
```
输入邮箱 → supabase.auth.signInWithOtp()
    ↓
Supabase 发邮件，链接指向 /auth/callback
    ↓
/auth/callback/route.ts 验证 token，建立 session
    ↓
重定向回首页，onAuthStateChange 触发 onSuccess
```

---

## 3. 组件与文件

### 新增

| 文件 | 职责 |
|---|---|
| `components/AuthModal.tsx` | Modal 容器，tab 切换，监听登录成功 |
| `components/LoginForm.tsx` | 邮箱+密码登录 + Magic Link |
| `components/SignupForm.tsx` | 邮箱+密码注册 |
| `app/api/claim-case/route.ts` | POST：更新匿名 case 的 user_id |
| `app/auth/callback/route.ts` | Magic Link 回调处理 |

### 修改

| 文件 | 改动 |
|---|---|
| `app/page.tsx` | AuthModal 状态管理；已登录显示「历史记录\|退出」；已登录时分析传入 user_id |
| `app/api/analyze/route.ts` | 读取 session，insert 时填入 user_id |

---

## 4. 接口定义

**POST /api/claim-case**
- Request: `{ case_id: string }`
- Auth: 必须已登录（从 session 读取 user_id）
- Response: `{ success: true }` 或 `{ error: string }`
- 逻辑：更新 `cases.user_id = auth.uid()` where `id = case_id AND user_id IS NULL`

---

## 5. UI 细节

### AuthModal 布局

```
┌─────────────────────────────────────┐
│  [登录]      [注册]              ✕  │  ← tab + 关闭
├─────────────────────────────────────┤
│  邮箱                               │
│  ┌─────────────────────────────┐   │
│  │ example@email.com           │   │
│  └─────────────────────────────┘   │
│  密码（注册/登录 tab 显示）          │
│  ┌─────────────────────────────┐   │
│  │ ••••••••                    │   │
│  └─────────────────────────────┘   │
│  [ 登录 / 注册 ]                    │
│  ── 或者 ──                         │
│  [ 发送 Magic Link 邮件 ]           │
└─────────────────────────────────────┘
```

### 状态与提示

| 状态 | UI 表现 |
|---|---|
| loading | 按钮显示「处理中...」，表单禁用 |
| 错误 | 表单下方红色提示文字 |
| Magic Link 发送成功 | 替换为「邮件已发送，请查收」 |
| 注册成功 | 切换到登录 tab，提示「注册成功，请登录」 |

### 首页 header

```
未登录：OfferHelper          登录 / 历史记录
已登录：OfferHelper          历史记录  |  退出
```

---

## 6. 范围外

- 第三方登录（GitHub、Google）
- 忘记密码功能（Magic Link 本身可替代）
- 邮箱验证后才能使用
- 用户资料页
