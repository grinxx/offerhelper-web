'use client'
import { useState, useEffect } from 'react'

interface UsageInfo {
  used: number
  limit: number
  usingOwnKey: boolean
}

export function useUsage() {
  const [usage, setUsage] = useState<UsageInfo | null>(null)

  useEffect(() => {
    fetch('/api/usage')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setUsage(data) })
      .catch(() => {})
  }, [])

  const remaining = usage ? usage.limit - usage.used : null
  const showWarning = remaining !== null && !usage?.usingOwnKey && remaining <= 3

  return { usage, remaining, showWarning }
}
