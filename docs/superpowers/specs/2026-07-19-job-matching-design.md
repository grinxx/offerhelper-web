# 岗位匹配功能设计文档

## 概述

为 OfferHelper Web 添加「岗位匹配」模式。用户填入简历文本（支持 PDF/DOCX 上传或粘贴）+ 最多 5 个 JD，AI 流式逐个评估每个 JD 的匹配度，输出 0-100 分 + 三档推荐等级 + 理由 + 优势/差距，最后给出总结推荐。登录用户结果保存至数据库，未登录可使用但不保存。

---

## 数据库

### 新增表：`match_sessions`

```sql
create table match_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  resume_text  text not null,
  jd_list      jsonb not null default '[]',
  results      jsonb not null default '[]',
  summary      text not null default '',
  status       text not null default 'active'
                    check (status in ('active', 'done')),
  created_at   timestamptz not null default now()
);

alter table match_sessions enable row level security;

create policy "users see own match sessions"
  on match_sessions for select
  using (auth.uid() = user_id);

create policy "users insert own match sessions"
  on match_sessions for insert
  with check (auth.uid() = user_id);

create policy "users update own match sessions"
  on match_sessions for update
  using (auth.uid() = user_id);
```

注：`user_id` 可为 null（未登录用户不写库）。

---

## API 端点

### `POST /api/match/analyze`（流式，ndjson）

**入参：**
```json
{
  "resume_text": "string",
  "jd_list": [{ "title": "string（选填）", "content": "string" }],
  "session_id": "uuid | null"
}
```

**逻辑：**
1. 读取 session user（可未登录，未登录跳过数据库操作）
2. 验证：`resume_text` 非空、`jd_list` 长度 1-5
3. 如已登录且无 `session_id`：用 service role 新建 `match_sessions`（写入 user_id、resume_text、jd_list），获取新 session_id
4. 串行处理每个 JD：
   - 调用 Claude（非流式），输出单个 JD 的匹配结果 JSON
   - 立即 flush 一行 `{ "type": "result", ... }` 到客户端
5. 所有 JD 处理完后，调用 Claude 生成总结推荐（非流式）
6. flush 一行 `{ "type": "summary", "text": "..." }`
7. 如已登录：更新 `match_sessions`（写入 results、summary，status 改 done）
8. flush 最后一行 `{ "type": "done", "session_id": "uuid | null" }`

**流式输出（ndjson，每行一个 JSON）：**
```
{ "type": "result", "jd_index": 0, "score": 82, "level": "强烈推荐", "reason": "string（100-150字）", "strengths": ["string", ...], "gaps": ["string", ...] }
{ "type": "result", "jd_index": 1, ... }
{ "type": "summary", "text": "string（100-150字，综合推荐）" }
{ "type": "done", "session_id": "uuid | null" }
```

错误时 flush：`{ "type": "error", "jd_index": number, "message": "string" }`（单个 JD 失败不中断其他 JD）

---

## Prompt 设计

### `MATCH_EVAL_SYSTEM`

```
你是职业顾问，评估应聘者简历与目标 JD 的匹配程度。

规则：
1. score：0-100 的整数，代表匹配程度
2. level：根据 score 判断 —— score>=75 为「强烈推荐」，50-74 为「可以投」，<50 为「不建议」
3. reason：100-150 字，说明匹配或不匹配的核心原因
4. strengths：2-4 条简历中与 JD 最相关的优势，每条一句话
5. gaps：1-3 条简历与 JD 要求的主要差距，每条一句话；若无明显差距可为空数组
6. 严格输出 JSON，格式：{"score":N,"level":"...","reason":"...","strengths":["..."],"gaps":["..."]}
7. 不加 markdown 代码块，不输出其他内容
```

`buildMatchEvalPrompt(resumeText: string, jdContent: string, jdTitle: string | null): string`

### `MATCH_SUMMARY_SYSTEM`

```
你是职业顾问，根据多个岗位的匹配评估结果给出投递策略建议。

规则：
1. 100-150 字，说明应优先投哪些岗位及理由
2. 如有明显最佳选择，明确指出；如都适合/都不适合，给出相应建议
3. 直接输出文字，不加任何格式标记
```

`buildMatchSummaryPrompt(results: MatchResult[], jdList: JdItem[]): string`

注：`lib/prompts.ts` 需要 `import type { MatchResult, JdItem } from '@/types'` 以使用这两个类型。

---

## 前端页面：`/match`

Client Component，使用 `<Suspense>` 包裹（Next.js 16 要求）。无 URL 参数。

### 状态机

```
idle → analyzing → done
```

**`idle`**
- `ResumeUploader`（复用 `components/ResumeUploader.tsx`）
- `JdListInput` 组件：默认 2 条 JD 输入，最多 5 条
- 未登录提示：「登录后可保存记录」
- 「开始匹配」按钮（需简历文本 + 至少 1 条 JD 内容才可点击）

**`analyzing`**
- 顶部进度：「正在评估 第 N 个 / 共 M 个岗位...」
- 每评完一个 JD 立刻追加渲染 `MatchCard`
- 所有 JD 完成后显示总结段落（流式追加）

**`done`**
- 所有 `MatchCard` + 总结段落
- 「重新匹配」按钮（重置回 idle，清空结果）

---

## 组件

### `JdListInput`

Props：`{ value: JdItem[]; onChange: (v: JdItem[]) => void }`

- 每条 JD：标题输入框（placeholder「岗位名称，选填」）+ 内容文本框（placeholder「粘贴 JD 内容...」）+ 删除按钮（当条数 > 1 时显示）
- 底部「＋ 添加岗位」按钮（当条数 < 5 时显示）
- 全部使用 zinc 色阶 + dark: 变体

### `MatchCard`

Props：`{ result: MatchResult; title?: string; loading?: boolean }`

- 顶部：岗位标题（若有）+ 分数（大字号）+ 推荐等级 chip（颜色区分三档）
  - 「强烈推荐」：绿色（`bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400`）
  - 「可以投」：黄色（`bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400`）
  - 「不建议」：红色（`bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400`）
- 中部：匹配理由段落
- 底部：优势列表（绿色标记）+ 差距列表（红色标记）
- `loading=true` 时显示骨架屏（animate-pulse）

---

## 类型定义（新增到 `types/index.ts`）

```typescript
export interface JdItem {
  title?: string
  content: string
}

export interface MatchResult {
  jd_index: number
  score: number
  level: '强烈推荐' | '可以投' | '不建议'
  reason: string
  strengths: string[]
  gaps: string[]
}

export interface MatchSession {
  id: string
  user_id: string | null
  resume_text: string
  jd_list: JdItem[]
  results: MatchResult[]
  summary: string
  status: 'active' | 'done'
  created_at: string
}
```

---

## 入口

**首页（`app/page.tsx`）：**
- 已登录 header：「历史记录 | 面试训练 | 优势挖掘 | **岗位匹配** | 退出」
- 未登录 header：「登录 | 面试训练 | 优势挖掘 | **岗位匹配**」（直接跳转，未登录可用）

---

## 文件清单

| 操作 | 路径 |
|------|------|
| 新增 | `supabase/migrations/005_match_sessions.sql` |
| 修改 | `types/index.ts` |
| 修改 | `lib/prompts.ts` |
| 新增 | `app/api/match/analyze/route.ts` |
| 新增 | `components/JdListInput.tsx` |
| 新增 | `components/MatchCard.tsx` |
| 新增 | `app/match/page.tsx` |
| 修改 | `app/page.tsx` |
