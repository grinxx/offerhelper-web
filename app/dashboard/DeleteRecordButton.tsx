'use client'
import { useState } from 'react'
import { deleteRecord } from './actions'

type RecordType = 'analysis' | 'interview' | 'strengths' | 'match'

interface Props {
  id: string
  type: RecordType
}

export default function DeleteRecordButton({ id, type }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteRecord(id, type)
    } catch {
      setDeleting(false)
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2" onClick={e => e.preventDefault()}>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">确认删除？</span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-40"
        >
          {deleting ? '删除中...' : '确认'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={deleting}
          className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          取消
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={e => { e.preventDefault(); setConfirming(true) }}
      className="text-xs text-zinc-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
    >
      删除
    </button>
  )
}
