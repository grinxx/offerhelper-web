'use client'
import { useState, useCallback } from 'react'

const STORAGE_KEY_PREFIX = 'offerhelper_shared_prompt_'

export function useSharePrompt(feature: string) {
  const [visible, setVisible] = useState(false)

  const trigger = useCallback(() => {
    const safeFeature = feature || '_unknown'
    const key = STORAGE_KEY_PREFIX + safeFeature
    if (localStorage.getItem(key)) return
    localStorage.setItem(key, '1')
    setTimeout(() => setVisible(true), 1500)
  }, [feature])

  const close = useCallback(() => setVisible(false), [])

  return { visible, trigger, close }
}
