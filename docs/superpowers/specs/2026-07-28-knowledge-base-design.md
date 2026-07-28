# 用户经历知识库设计文档

## 背景

当前简历优化功能每次都从零开始分析，无法参考用户在优势挖掘、面试训练中已经讲述过的真实经历。知识库功能将这些经历积累下来，让 AI 在优化简历时能主动发现「你提到过但没写进简历的经历」，同时保存简历历史版本供对比参考。

---

## 目标

- 自动从优势挖掘、面试训练结果中提取经历条目，存入用户知识库
- 用户可在 dashboard 查看、添加、删除经历条目
- 简历优化时自动将知识库摘要注入 Prompt，提升建议针对性
- 自动保存简历历史版本

---

## 数据库

### `user_experiences` 表

```sql
create table user_experiences (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  source     text not null check (source in ('strengths', 'interview', 'manual')),
  source_id  uuid,        -- 来源 session id（自动提取时填写）
  content    text not null,
  created_at timestamptz not null default now()
);

alter table user_experiences enable row level security;
create policy "users manage own experiences"
  on user_experiences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

### `resume_versions` 表

```sql
create table resume_versions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  resume_text text not null,
  label       text not null default '',
  created_at  timestamptz not null default now()
);

alter table resume_versions enable row level security;
create policy "users manage own resume versions"
  on resume_versions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

---

## 自动提取流程

### 优势挖掘完成时

`/api/strengths/result` 完成后，后端异步触发提取：
- 将完整对话（messages）发给 AI，提示词要求提取 3-5 条经历片段
- 每条格式：一句话概括（不超过 100 字），突出项目名称、行动、结果
- 存入 `user_experiences`，`source='strengths'`，`source_id` 为当前 session id
- 仅对已登录用户执行

### 面试训练每轮回答时

`/api/interview/answer` 处理完后：
- 将用户的回答原文直接存一条（`source='interview'`）
- 不需要 AI 二次提取，回答本身即为经历描述

### 简历上传时

`/api/analyze` 收到请求后，保存简历版本：
- 查询该用户最新一条 `resume_versions`
- 若与当前上传内容完全相同则跳过（去重）
- 否则插入新版本，label 默认「版本 N」（N 为该用户的版本计数）

---

## 知识库注入（简历优化）

`/api/analyze` 构建 Prompt 时：

1. 查询 `user_experiences`，取最新 20 条，按 source 分组拼成摘要文本块（限 1000 字）
2. 查询 `resume_versions`，取最新 3 条标签列表（仅作参考提示）
3. 以 `knowledge_context` 字段传入 `buildUserPrompt`

```
参考经历（用户历次描述的真实经历，优先在建议中体现）：
<experiences>
[经历条目列表]
</experiences>
```

---

## 前端变更

### dashboard 新增「经历库」tab

路径：`app/dashboard/page.tsx`

- Tab 列表新增「经历库」选项
- 内容区展示经历条目列表：
  - 每条显示：来源标签（优势挖掘 / 面试训练 / 手动添加）+ 内容文本 + 删除按钮
  - 按 `created_at` 倒序排列
- 底部「+ 手动添加」按钮 → 展开文本输入框 → 提交后刷新列表
- API：`GET /api/knowledge/experiences`、`POST /api/knowledge/experiences`、`DELETE /api/knowledge/experiences/[id]`

### 简历优化页提示

路径：`app/analyze/page.tsx`

- 用户已登录且知识库有条目时，在分析按钮上方显示：
  「已找到 N 条经历记录，分析时将自动参考」
- 无需用户操作，只读提示

---

## API 路由

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/knowledge/experiences` | 获取当前用户经历列表 |
| POST | `/api/knowledge/experiences` | 手动添加一条经历 |
| DELETE | `/api/knowledge/experiences/[id]` | 删除一条经历 |
| POST | `/api/knowledge/extract` | 内部接口：AI 提取经历（strengths 完成后调用） |

---

## 约束

- 知识库仅对已登录用户生效；游客走现有流程，无知识库注入
- 每用户经历条目上限 100 条（超出时删除最旧的）
- 经历摘要注入上限 1000 字，防止 Prompt 过长
- `resume_versions` 每用户上限 20 条（超出时删除最旧的）
