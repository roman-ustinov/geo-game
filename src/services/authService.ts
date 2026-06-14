import { readJson, writeJson } from './storage'
import type { AuthErrors, User } from '../types'

const USERS_KEY = 'capital-rush-users'
const SESSION_KEY = 'capital-rush-session'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type AuthResponse = { ok: true; user: User } | { ok: false; errors: AuthErrors }

function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

function bytesToHex(buffer: ArrayBuffer | Uint8Array): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function makeSalt(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return bytesToHex(bytes)
}

export function validateCredentials(email: string, password: string): AuthErrors {
  const errors: AuthErrors = {}
  if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'Enter a valid email address.'
  if (password.length < 8) errors.password = 'Password must have at least 8 characters.'
  return errors
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return bytesToHex(digest)
}

export function getUsers(): User[] {
  return readJson<User[]>(USERS_KEY, [])
}

function saveUsers(users: User[]): void {
  writeJson(USERS_KEY, users)
}

export function getCurrentUser(): User | null {
  const session = readJson<{ userId: string } | null>(SESSION_KEY, null)
  if (!session?.userId) return null
  return getUsers().find((user) => user.id === session.userId) ?? null
}

export async function registerUser(email: string, password: string): Promise<AuthResponse> {
  const normalizedEmail = email.trim().toLowerCase()
  const errors = validateCredentials(normalizedEmail, password)
  if (Object.keys(errors).length) {
    return { ok: false, errors }
  }

  const users = getUsers()
  if (users.some((user) => user.email === normalizedEmail)) {
    return { ok: false, errors: { email: 'An account with this email already exists.' } }
  }

  const salt = makeSalt()
  const passwordHash = await hashPassword(password, salt)
  const user = {
    id: generateId('user'),
    email: normalizedEmail,
    createdAt: new Date().toISOString(),
    salt,
    passwordHash,
  }

  saveUsers([...users, user])
  writeJson(SESSION_KEY, { userId: user.id })
  return { ok: true, user }
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  const normalizedEmail = email.trim().toLowerCase()
  const errors = validateCredentials(normalizedEmail, password)
  if (Object.keys(errors).length) {
    return { ok: false, errors }
  }

  const user = getUsers().find((item) => item.email === normalizedEmail)
  if (!user) {
    return { ok: false, errors: { form: 'Email or password is incorrect.' } }
  }

  const passwordHash = await hashPassword(password, user.salt)
  if (passwordHash !== user.passwordHash) {
    return { ok: false, errors: { form: 'Email or password is incorrect.' } }
  }

  writeJson(SESSION_KEY, { userId: user.id })
  return { ok: true, user }
}

export function logoutUser(): void {
  window.localStorage.removeItem(SESSION_KEY)
}
