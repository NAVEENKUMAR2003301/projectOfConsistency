import { readJSON, writeJSON } from './storage'
import { reminderSlots } from './targets'

// Optional cloud reminders.
//
// Everything here is opt-in. With no account the app behaves exactly as before
// and this module never runs. When an account exists, ONLY habit names and
// reminder times are uploaded — enough for the server to send a notification
// while the app is closed, and nothing more. Check-ins, notes and expenses
// never leave the device.

export const CLOUD_KEY = 'consistency.cloud.v1'

/** Set at build time; without it the whole feature stays hidden. */
export const API_URL = (import.meta.env?.VITE_API_URL ?? '').replace(/\/+$/, '')

export const cloudConfigured = () => API_URL.length > 0

export const readCloud = () => {
  const stored = readJSON(CLOUD_KEY, null)
  return stored && typeof stored === 'object' ? stored : null
}

export const writeCloud = (value) => writeJSON(CLOUD_KEY, value)

export const clearCloud = () => writeJSON(CLOUD_KEY, null)

async function api(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  let data = null
  try {
    data = await response.json()
  } catch {
    // A non-JSON body means something upstream failed.
  }

  if (!response.ok) {
    throw new Error(data?.error ?? `Request failed (${response.status}).`)
  }
  return data
}

export const createAccount = () => api('/api/account', { method: 'POST' })

export const openSession = (accountKey) =>
  api('/api/session', { method: 'POST', body: { accountKey } })

export const fetchAccount = (token) => api('/api/account', { token })

export const deleteAccount = (token) => api('/api/account', { method: 'DELETE', token })

export const fetchVapidKey = () => api('/api/vapid')

// --- push subscription ------------------------------------------------------

const urlBase64ToUint8Array = (value) => {
  const padded = (value + '='.repeat((4 - (value.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const raw = atob(padded)
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

/** A short, honest description of this browser, for the device list. */
export function describeDevice() {
  const ua = navigator.userAgent
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Safari\//.test(ua)
        ? 'Safari'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : 'Browser'
  const platform = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad/.test(ua)
      ? 'iOS'
      : /Mac/.test(ua)
        ? 'Mac'
        : /Windows/.test(ua)
          ? 'Windows'
          : 'device'
  return `${browser} on ${platform}`
}

/**
 * Subscribes this browser for push and registers it against the account.
 * Assumes notification permission has already been granted.
 */
export async function subscribeDevice(token) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('This browser cannot receive background reminders.')
  }

  const { publicKey } = await fetchVapidKey()
  if (!publicKey) throw new Error('The server has no push key configured yet.')

  const registration = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready

  // Reuse an existing subscription; re-subscribing with a different key fails.
  const existing = await registration.pushManager.getSubscription()
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }))

  const raw = subscription.toJSON()
  await api('/api/push', {
    method: 'POST',
    token,
    body: { endpoint: raw.endpoint, keys: raw.keys, label: describeDevice() },
  })

  return raw.endpoint
}

export async function unsubscribeDevice(token) {
  if (!('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return
  const { endpoint } = subscription.toJSON()
  await api('/api/push', { method: 'DELETE', token, body: { endpoint } }).catch(() => {})
  await subscription.unsubscribe().catch(() => {})
}

// --- what gets uploaded -----------------------------------------------------

/**
 * The upload payload, built so it is obvious what leaves the device: an id, a
 * name, the times, and how many repeats. No history, no notes, no amounts.
 */
export const remindersPayload = (habits) =>
  habits
    .map((habit) => ({
      id: habit.id,
      name: habit.name,
      times: reminderSlots(habit),
      target: Math.max(1, Number(habit.target) || 1),
    }))
    .filter((r) => r.times.length > 0)

export const pushReminders = (token, habits) =>
  api('/api/reminders', {
    method: 'PUT',
    token,
    body: {
      reminders: remindersPayload(habits),
      // The server stores times as local wall-clock, so it needs the offset to
      // know when "08:00" is for this user.
      tzOffset: -new Date().getTimezoneOffset(),
    },
  })
