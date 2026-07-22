import { getTodayUsage } from '@/lib/usage'

export const runtime = 'nodejs'

export async function GET() {
  const usage = await getTodayUsage()
  return Response.json(usage)
}
