import { useCallback, useEffect, useRef, useState } from 'react'
import {
  dueHabits,
  dueSlots,
  formatTime,
  hasReminder,
  markNotified,
  markSkipped,
  msUntil,
  readNotified,
  reminderSlots,
  unskippedSlots,
  wasNotifiedToday,
  wasSkippedToday,
} from './reminders'
import { countFor, targetOf } from './targets'

// What this can and cannot do, so the UI can say so honestly:
// a browser will only run our timers while the page is alive. Firing a
// notification with the site fully closed needs the Push API and a server to
// push from, which a local-only app does not have. So reminders fire while the
// app is open (including in a background tab), and anything missed is caught up
// the moment you come back.

export const notificationsSupported = () =>
  typeof window !== 'undefined' && 'Notification' in window

const permissionNow = () =>
  notificationsSupported() ? Notification.permission : 'unsupported'

/** Registers the worker that lets mobile browsers show notifications at all. */
async function getRegistration() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    return (await navigator.serviceWorker.getRegistration()) ?? null
  } catch {
    return null
  }
}

async function showReminder(habit, { done = 0, target = 1, slot = 0, at = '' } = {}) {
  const repeating = target > 1
  const title = repeating
    ? `${habit.name} — ${done} of ${target} done`
    : `Time for: ${habit.name}`
  const options = {
    body: repeating
      ? `${target - done} left today${at ? ` · ${at} reminder` : ''}. Tap to log one.`
      : 'Open Consistency and log it before the day runs out.',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    // Tagged per SLOT, not per habit: a shared tag makes each new reminder
    // replace the previous one, so only the last would ever be seen. Every
    // missed nudge should be visible until it is dealt with.
    tag: `consistency-${habit.id}-${slot}`,
    // Dismissing one notification clears only that one; the rest stay put.
    requireInteraction: false,
    actions: [{ action: 'skip', title: 'Skip' }],
  }

  const registration = await getRegistration()
  if (registration?.showNotification) {
    await registration.showNotification(title, options)
    return true
  }
  try {
    // Desktop fallback, used when no worker is registered. `actions` are only
    // valid on persistent (worker) notifications — passing them to the
    // constructor throws, which previously meant no notification appeared at
    // all rather than one without the Skip button.
    const { actions, ...basic } = options
    void actions
    new Notification(title, basic)
    return true
  } catch {
    return false
  }
}

/** A short two-tone chime. Silent-fails when autoplay policy blocks it. */
function chime() {
  try {
    const Ctx = window.AudioContext ?? window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const play = (freq, start, duration) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration)
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + duration)
    }
    play(880, 0, 0.18)
    play(1174, 0.16, 0.28)
    setTimeout(() => ctx.close().catch(() => {}), 900)
  } catch {
    // No audio available — the notification itself is the reminder.
  }
}

export function useReminders(habits, { sound = true } = {}) {
  const [permission, setPermission] = useState(permissionNow)
  const [due, setDue] = useState(() => dueHabits(habits))
  const timer = useRef(null)
  const notified = useRef(readNotified())

  const request = useCallback(async () => {
    if (!notificationsSupported()) return 'unsupported'
    let result = Notification.permission
    if (result === 'default') result = await Notification.requestPermission()
    setPermission(result)
    if (result === 'granted' && 'serviceWorker' in navigator) {
      // Registered only once permission exists, so we never install a worker
      // for someone who declined.
      try {
        await navigator.serviceWorker.register('/sw.js')
      } catch {
        // Falls back to the desktop Notification constructor.
      }
    }
    return result
  }, [])

  // Keep the worker available across reloads for people who already said yes.
  useEffect(() => {
    if (permission !== 'granted' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [permission])

  useEffect(() => {
    const withReminders = habits.filter(hasReminder)

    const clear = () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = null
    }

    // Fire anything already overdue and not yet announced today, then sleep
    // until the next reminder falls due.
    const run = () => {
      clear()
      const now = new Date()
      let fired = 0

      for (const habit of withReminders) {
        const target = targetOf(habit)
        const done = countFor(habit)
        // Every slot that has come round and has not already been announced or
        // waved away gets its own notification, so nothing goes unseen.
        const pending = dueSlots(habit, now).filter(
          (slot) =>
            !wasNotifiedToday(habit.id, notified.current, slot.index) &&
            !wasSkippedToday(habit.id, slot.index, notified.current),
        )
        if (pending.length === 0) continue

        // Only a slot we actually announced counts as announced. Marking one
        // while permission is still 'default' would record a nudge that never
        // appeared, and granting permission later in the day would then find
        // every slot already spoken for and stay silent until tomorrow.
        if (permission !== 'granted') continue

        for (const slot of pending) {
          notified.current = markNotified(habit.id, notified.current, slot.index)
          showReminder(habit, { done, target, slot: slot.index, at: formatTime(slot.time) })
          fired++
        }
      }
      if (fired > 0 && sound && permission === 'granted') chime()

      setDue(dueHabits(habits, new Date(), notified.current))

      // Next wake-up: the soonest slot that has not already come round today.
      const waits = withReminders
        .flatMap((h) => reminderSlots(h).map((time) => msUntil(time)))
        .filter((ms) => typeof ms === 'number' && ms > 0)
      if (waits.length === 0) return

      // +1s so the timer lands just past the minute, never a hair before it.
      const wait = Math.min(...waits) + 1000
      timer.current = setTimeout(run, wait)
    }

    run()

    // Timers are throttled or suspended in background tabs, so re-check
    // whenever the page becomes visible again.
    const onWake = () => run()
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('focus', onWake)
    return () => {
      clear()
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('focus', onWake)
    }
  }, [habits, permission, sound])

  /**
   * Waves away the nudges that are outstanding right now. Only those slots are
   * cleared — a later one in the same day still comes round, which is the point
   * of skipping rather than turning the reminder off.
   */
  const skip = useCallback(
    (habit) => {
      const outstanding = unskippedSlots(habit, new Date(), notified.current)
      if (outstanding.length === 0) return
      notified.current = markSkipped(
        habit.id,
        outstanding.map((slot) => slot.index),
        notified.current,
      )
      setDue(dueHabits(habits, new Date(), notified.current))
    },
    [habits],
  )

  return {
    permission,
    request,
    due,
    skip,
    supported: notificationsSupported(),
    anyReminders: habits.some(hasReminder),
  }
}
