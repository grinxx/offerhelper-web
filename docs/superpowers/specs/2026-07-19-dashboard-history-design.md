# Dashboard 历史记录扩展设计文档

## 概述

扩展现有 `/dashboard` 页面，将面试训练（`interview_sessions`）、优势挖掘（`strength_sessions`）、岗位匹配（`match_sessions`）的历史记录与简历分析（`cases`）整合到统一的时间线列表中。新增三个详情页，复用现有组件展示各类记录的完整内容，并提供「再次开始」入口。

---

## Dashboard 列表页（修改）

**文件：** `app/dashboard/page.tsx`

**逻辑：**
1. 并行查四张表（Server Component，`Promise.all`）：
   - `cases`：`id, jd_text, status, created_at, result_json`，`status='done'`，最近 20 条
   - `interview_sessions`：`id, jd_text, case_id, status, created_at`，`status='done'`，最近 20 条
   - `strength_sessions`：`id, jd_text, summary, status, created_at`，`status='done'`，最近 20 条
   - `match_sessions`：`id, jd_list, summary, status, created_at`，`status='done'`，最近 20 条
2. 合并四个数组，每条加 `type` 字段，按 `created_at` 倒序排序，取前 50 条
3. 渲染统一卡片列表

**统一记录类型定义（仅用于页面内部）：**
```typescript
type RecordType = 'analysis' | 'interview' | 'strengths' | 'match'

interface TimelineRecord {
  id: string
  type: RecordType
  summary: string        // 显示在卡片上的摘要文字
  created_at: string
  href: string           // 详情页路径
}
```

**各类型摘要文字提取规则：**
- `analysis`（cases）：`jd_text.slice(0, 60)`
- `interview`（interview_sessions）：`jd_text ? jd_text.slice(0, 60) : '面试训练'`
- `strengths`（strength_sessions）：`summary ? summary.slice(0, 60) : '优势挖掘'`
- `match`（match_sessions）：`jd_list[0]?.title || jd_list[0]?.content?.slice(0, 40) || '岗位匹配'`

**各类型标签颜色（Tailwind）：**
- `analysis`：`bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400`，标签文字「简历分析」
- `interview`：`bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400`，标签文字「面试训练」
- `strengths`：`bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400`，标签文字「优势挖掘」
- `match`：`bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400`，标签文字「岗位匹配」

**详情页路径：**
- `analysis`：`/dashboard/${id}`（现有路径，不变）
- `interview`：`/dashboard/interview/${id}`
- `strengths`：`/dashboard/strengths/${id}`
- `match`：`/dashboard/match/${id}`

**卡片布局：**
```
[类型标签] [摘要文字（line-clamp-1）]        [时间]
```
整体可点击，hover 有背景变色。

---

## 面试训练详情页（新增）

**文件：** `app/dashboard/interview/[id]/page.tsx`

**数据查询：**
- `interview_sessions`：`id, jd_text, questions, status, created_at, case_id`，`.eq('id', id).eq('user_id', user.id)`
- `interview_turns`：`question_index, question, user_answer, scores, feedback, reference_answer`，`.eq('session_id', id).order('question_index', ascending: true)`

**页面内容：**
1. 标题：「面试训练记录」+ 创建时间
2. 如有 jd_text：展示目标 JD（line-clamp-4，可展开）
3. 每道题展示一张卡片（复用 `ScoreCard` 组件）：
   - 题目文字
   - 用户回答（灰色文字）
   - `ScoreCard`（scores、feedback、reference_answer）
4. 如果该 session 关联了 case（`case_id` 非 null），底部显示：
   - 「再次面试训练（基于此 JD）」→ `/interview?case_id=${case_id}`
   - 「查看关联简历分析」→ `/dashboard/${case_id}`
5. 如果没有关联 case，底部显示：
   - 「再次面试训练」→ `/interview`

---

## 优势挖掘详情页（新增）

**文件：** `app/dashboard/strengths/[id]/page.tsx`

**数据查询：**
- `strength_sessions`：`id, jd_text, messages, result, status, created_at`，`.eq('id', id).eq('user_id', user.id)`

**页面内容：**
1. 标题：「优势挖掘记录」+ 创建时间
2. 如有 jd_text：展示目标 JD（line-clamp-4）
3. 对话记录：遍历 `messages`，用 `ChatBubble` 渲染每条消息
4. 优势结果：若 `result` 为 null，显示「该记录未完成优势提炼」；否则用 `StrengthsResult` 组件渲染 `result.strengths` 和 `result.summary`
5. 底部：「重新挖掘优势」→ `/strengths`

---

## 岗位匹配详情页（新增）

**文件：** `app/dashboard/match/[id]/page.tsx`

**数据查询：**
- `match_sessions`：`id, jd_list, results, summary, status, created_at`，`.eq('id', id).eq('user_id', user.id)`

**页面内容：**
1. 标题：「岗位匹配记录」+ 创建时间
2. 每个 JD 的匹配结果：用 `MatchCard` 组件渲染，title 取 `jd_list[r.jd_index]?.title`
3. 投递建议总结段落
4. 底部：「重新匹配」→ `/match`

---

## 文件清单

| 操作 | 路径 |
|------|------|
| 修改 | `app/dashboard/page.tsx` |
| 新增 | `app/dashboard/interview/[id]/page.tsx` |
| 新增 | `app/dashboard/strengths/[id]/page.tsx` |
| 新增 | `app/dashboard/match/[id]/page.tsx` |

**复用现有组件（无需新建）：**
- `ScoreCard` — 面试评分
- `ChatBubble` — 优势挖掘对话
- `StrengthsResult` — 优势结果
- `MatchCard` — 岗位匹配卡片
- `SuggestionCard` — 简历分析建议（现有详情页已用）

**无需新 API 端点，无需数据库变更。**
