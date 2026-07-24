import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()
  if (!user) return Response.json({ error: '未登录' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = 20
  const from = (page - 1) * limit
  const to = from + limit - 1

  const supabase = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data, count } = await supabase
    .from('applications')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('applied_at', { ascending: false })
    .range(from, to)

  return Response.json({ applications: data ?? [], total: count ?? 0, page, limit })
}

export async function POST(request: NextRequest) {
  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()
  if (!user) return Response.json({ error: '未登录' }, { status: 401 })

  let body: { company?: string; position?: string; platform?: string; applied_at?: string; status?: string; note?: string; case_id?: string } = {}
  try { body = await request.json() } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 })
  }

  if (!body.company?.trim() || !body.position?.trim()) {
    return Response.json({ error: '公司和岗位为必填项' }, { status: 400 })
  }

  const supabase = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data, error } = await supabase.from('applications').insert({
    user_id: user.id,
    company: body.company,
    position: body.position,
    platform: body.platform ?? '',
    applied_at: body.applied_at ?? new Date().toISOString().slice(0, 10),
    status: body.status ?? 'submitted',
    note: body.note ?? '',
    case_id: body.case_id ?? null,
  }).select('id').single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ id: data.id })
}

export async function PATCH(request: NextRequest) {
  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()
  if (!user) return Response.json({ error: '未登录' }, { status: 401 })

  let body: { id?: string; status?: string; note?: string } = {}
  try { body = await request.json() } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 })
  }

  if (!body.id) return Response.json({ error: '缺少 id' }, { status: 400 })

  const supabase = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  // 先取出旧数据（用于邮件内容）
  const { data: appRow } = await supabase.from('applications')
    .select('company, position, status')
    .eq('id', body.id)
    .eq('user_id', user.id)
    .single()

  const { error } = await supabase.from('applications')
    .update({ status: body.status, note: body.note, updated_at: new Date().toISOString() })
    .eq('id', body.id)
    .eq('user_id', user.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // 状态变为「约面试」时发提醒邮件
  if (body.status === 'interview_scheduled' && appRow && user.email) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'OfferHelper <noreply@offerhelper.cloud>',
          to: user.email,
          subject: `🎉 面试邀约：${appRow.company} · ${appRow.position}`,
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#18181b">
              <h2 style="font-size:18px;font-weight:600;margin-bottom:8px">你收到了面试邀约！</h2>
              <p style="font-size:14px;color:#52525b;margin-bottom:16px">
                <strong>${appRow.company}</strong> 的 <strong>${appRow.position}</strong> 岗位已更新为「约面试」状态。
              </p>
              <p style="font-size:14px;color:#52525b;margin-bottom:24px">建议你：</p>
              <ul style="font-size:14px;color:#52525b;margin-bottom:24px;padding-left:20px">
                <li>复习岗位 JD 和自我介绍</li>
                <li>在 OfferHelper 面试训练中练习几道题</li>
                <li>确认面试时间、地点和形式</li>
              </ul>
              <a href="https://offerhelper.cloud/applications" style="display:inline-block;padding:10px 24px;background:#18181b;color:#fff;text-decoration:none;border-radius:8px;font-size:14px">
                查看投递记录
              </a>
              <p style="font-size:12px;color:#a1a1aa;margin-top:24px">— OfferHelper 团队</p>
            </div>
          `,
        }),
      })
    } catch {
      // 邮件发送失败不影响主流程
    }
  }

  return Response.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()
  if (!user) return Response.json({ error: '未登录' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: '缺少 id' }, { status: 400 })

  const supabase = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  await supabase.from('applications').delete().eq('id', id).eq('user_id', user.id)
  return Response.json({ ok: true })
}
