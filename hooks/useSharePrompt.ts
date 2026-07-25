'use client'
import { useState, useCallback } from 'react'

const STORAGE_KEY_PREFIX = 'offerhelper_shared_prompt_'

export function useSharePrompt(feature: string) {
  const [visible, setVisible] = useState(false)

  const trigger = useCallback(() => {
    const key = STORAGE_KEY_PREFIX + feature
    if (localStorage.getItem(key)) return  // 已提示过，不再弹
    localStorage.setItem(key, '1')
    // 延迟 1.5 秒再弹，让用户先看完结果
    setTimeout(() => setVisible(true), 1500)
  }, [feature])

  const close = useCallback(() => setVisible(false), [])

  return { visible, trigger, close }
}
