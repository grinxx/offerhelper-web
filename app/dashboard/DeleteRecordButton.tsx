'use client'
import { useState, useRef, useEffect } from 'react'
import { deleteRecord } from './actions'

type RecordType = 'analysis' | 'interview' | 'strengths' | 'match'

interface Props {
  id: string
  type: RecordType
}

const UNDO_SECONDS = 5

export default function DeleteRecordButton({ id, type }: Props) {
  const [pending, setPending] = useState(false)
  const [countdown, setCountdown] = useState(UNDO_SECONDS)
  const [deleting, setDeleting] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    setPending(true)
    setCountdown(UNDO_SECONDS)

    intervalRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(intervalRef.current!)
          return 0
        }
        return c - 1
      })
    }, 1000)

    timerRef.current = setTimeout(async () => {
      setDeleting(true)
      try {
        await deleteRecord(id, type)
      } catch {
        setPending(false)
        setDeleting(false)
      }
    }, UNDO_SECONDS * 1000)
  }

  function handleUndo(e: React.MouseEvent) {
    e.preventDefault()
    if (timerRef.current) clearTimeout(timerRef.current)
    if (intervalRef.current) clearInterval(intervalRef.current)
    setPending(false)
    setCountdown(UNDO_SECONDS)
  }

  if (deleting) {
    return <span className="text-xs text-zinc-300 dark:text-zinc-600">删除中...</span>
  }

  if (pending) {
    return (
      <div className="flex items-center gap-2" onClick={e => e.preventDefault()}>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">{countdown}s 后删除</span>
        <button
          onClick={handleUndo}
          className="text-xs text-zinc-600 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-600 rounded px-1.5 py-0.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          撤销
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleClick}
      className="text-xs text-zinc-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
    >
      删除
    </button>
  )
}
