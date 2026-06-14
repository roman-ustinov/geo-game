import { type Dispatch, type SetStateAction, useEffect, useState } from 'react'
import { readJson, writeJson } from '../services/storage'

export function usePersistentState<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState(() => readJson(key, initialValue))

  useEffect(() => {
    writeJson(key, value)
  }, [key, value])

  return [value, setValue]
}
