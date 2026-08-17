# OfferHelper MCP Server 文档

> 面向开发者/技术用户的 MCP 集成指南，以及内部维护说明

---

## 一、功能概述

OfferHelper MCP Server 将 OfferHelper 的四大核心功能以 MCP 工具的形式暴露出去，让支持 MCP 协议的客户端（Claude Desktop、Cursor 等）可以直接调用，无需打开浏览器。

**npm 包**：[@offerhelper/mcp](https://www.npmjs.com/package/@offerhelper/mcp)  
**源码**：`/Users/i758469/offerhelper-mcp/`  
**协议**：[Model Context Protocol (MCP)](https://modelcontextprotocol.io)，stdio 模式

---

## 二、用户使用流程

### 方式一：一键安装（推荐）

```bash
npx @offerhelper/mcp setup
```

按提示操作：
1. 脚本提示去 `https://offerhelper.cloud/settings` 生成 Token
2. 粘贴 Token（格式 `oh_xxx`）
3. 脚本自动写入 Claude Desktop 配置文件
4. 重启 Claude Desktop

### 方式二：手动配置

在 Claude Desktop 配置文件中加入：

| 系统 | 配置文件路径 |
|---|---|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

```json
{
  "mcpServers": {
    "offerhelper": {
      "command": "npx",
      "args": ["-y", "@offerhelper/mcp"],
      "env": {
        "OFFERHELPER_TOKEN": "oh_你的token"
      }
    }
  }
}
```

---

## 三、可用工具列表

| 工具名 | 对应功能 | 主要入参 |
|---|---|---|
| `analyze_resume` | 简历分析 | `resume_text`, `jd_text` |
| `match_jobs` | 岗位匹配评分 | `resume_text`, `jd_list`（最多 5 个） |
| `start_interview` | 开始面试训练 | `jd_text`, `question_type` |
| `answer_interview` | 提交面试回答 | `session_id`, `question_index`, `question`, `user_answer` |
| `mine_strengths` | 优势挖掘对话 | `messages`, `session_id`, `jd_text` |

---

## 四、认证机制（API Token）

### 设计决策

MCP Server 运行在用户本地，调用 OfferHelper 后端 API 时通过 `Authorization: Bearer oh_xxx` 鉴权，而不是复用 Supabase Session Cookie——原因是 MCP Server 无浏览器环境，拿不到 Cookie。

### Token 生命周期

```
用户在设置页生成 Token
  → 后端生成随机字符串（oh_ + 32位随机hex）
  → 仅存储 SHA-256 hash，明文只展示一次
  → MCP Server 每次请求时，后端对比 hash 鉴权
  → 用户可随时在设置页撤销（软删除，设 revoked_at）
```

### 数据库表

**表名**：`api_tokens`（migration `006_api_tokens.sql`）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `user_id` | uuid | 关联 auth.users |
| `name` | text | Token 备注名 |
| `token_hash` | text | SHA-256 哈希，unique |
| `prefix` | text | 前11位，用于 UI 展示（`oh_xxxxxxxx`） |
| `created_at` | timestamptz | 创建时间 |
| `last_used_at` | timestamptz | 最近使用时间（异步更新） |
| `revoked_at` | timestamptz | 撤销时间，null 表示有效 |

### 相关代码

- **Token 管理 API**：`app/api/settings/tokens/route.ts`（GET / POST / DELETE）
- **鉴权工具函数**：`lib/auth/token.ts`（`validateBearerToken(request)`）
- **前端 UI**：`app/settings/page.tsx` → `ApiTokensSection` 组件

---

## 五、MCP Server 源码结构

```
offerhelper-mcp/
├── src/
│   ├── index.ts      ← MCP Server 主入口，注册 5 个工具
│   └── setup.ts      ← npx setup 安装助手
├── dist/             ← 编译产物（tsc 生成）
├── package.json
├── tsconfig.json
└── README.md
```

### 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|---|---|---|---|
| `OFFERHELPER_TOKEN` | ✅ | — | 用户 API Token |
| `OFFERHELPER_API_URL` | ❌ | `https://offerhelper.cloud` | API 地址，本地开发时改为 `http://localhost:3000` |

---

## 六、本地开发调试

### Claude Desktop 指向本地

`~/Library/Application Support/Claude/claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "offerhelper": {
      "command": "node",
      "args": ["/Users/i758469/offerhelper-mcp/dist/index.js"],
      "env": {
        "OFFERHELPER_TOKEN": "oh_你的开发token",
        "OFFERHELPER_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

### 修改后重新编译

```bash
cd ~/offerhelper-mcp
npm run build      # 重新编译
# 然后重启 Claude Desktop
```

---

## 七、发布新版本

```bash
cd ~/offerhelper-mcp

# 1. 修改 src/ 下的代码
# 2. 编译
npm run build

# 3. 更新版本号（patch / minor / major）
npm version patch

# 4. 发布
npm publish --access public
```

> **注意**：发布前确保 `OFFERHELPER_API_URL` 默认值是 `https://offerhelper.cloud`，不要把本地地址发出去。

---

## 八、后续规划

- [ ] 在现有 API 路由中接入 `validateBearerToken`，让 MCP 调用走真实鉴权（当前 API 仍以 Session Cookie 鉴权为主）
- [ ] 支持面试会话的多轮交互（目前 start + answer 需要用户自己维护 session_id）
- [ ] 发布到 Smithery 等 MCP 市场，提升曝光
