import { APP_DIR, appPath, loadLibs, readApp, readBuiltCss, readBuiltJs } from './_setup.mjs'

// The notification plumbing cannot be exercised without a browser, so this
// checks the contract that decides whether reminders stack or replace.
import { readFileSync } from 'node:fs'

const APP = APP_DIR + "/"
const hook = readFileSync(APP + 'src/lib/useReminders.js', 'utf8')
const sw = readFileSync(APP + 'public/sw.js', 'utf8')
const banner = readFileSync(APP + 'src/components/ReminderBanner.jsx', 'utf8')
const app = readFileSync(APP + 'src/App.jsx', 'utf8')

let fails = 0
const check = (name, cond, extra = '') => {
  if (!cond) {
    fails++
    console.log(`FAIL  ${name} ${extra}`)
  }
}

// ---------- every pending nudge gets its own notification ----------
// A tag shared across a habit makes each new notification REPLACE the last, so
// only the most recent would ever be seen. It must vary per slot.
const tagLine = hook.split('\n').find((l) => l.includes('tag:')) ?? ''
check('notification tag exists', tagLine.includes('tag:'), 'no tag set')
check('tag varies per slot', /slot/.test(tagLine), `shared tag replaces earlier nudges — ${tagLine.trim()}`)
check('tag still varies per habit', /habit\.id/.test(tagLine), tagLine.trim())

// Each pending slot must notify, rather than one call covering them all.
const loopBody = hook.slice(hook.indexOf('for (const slot of pending)'), hook.indexOf('if (fired > 0'))
check('notification fires inside the slot loop', loopBody.includes('showReminder('), loopBody.slice(0, 200))
check('each fire is counted', loopBody.includes('fired++'))

// ---------- "already told you" must mean we actually told you ----------
// markNotified used to run before the permission check, so a slot that came
// round while permission was still 'default' was recorded as announced. The
// effect re-runs when permission changes, and by then every slot for the day
// looked spoken for — granting permission bought silence until tomorrow.
const permissionGate = hook.indexOf("if (permission !== 'granted') continue")
check('firing is gated on permission before anything is recorded', permissionGate > -1)
check(
  'nothing is marked notified without permission',
  permissionGate > -1 && permissionGate < hook.indexOf('markNotified(habit.id'),
  'granting permission mid-day would then produce no reminders at all',
)

// ---------- skipping is per slot, never per habit ----------
check('skip state is recorded', hook.includes('markSkipped'))
check('skipped slots are excluded from firing', hook.includes('wasSkippedToday'))
check('skip clears only outstanding slots', hook.includes('unskippedSlots'))
const skipFn = hook.slice(hook.indexOf('const skip = useCallback'), hook.indexOf('return {\n    permission'))
check('skip maps over the outstanding slots', /outstanding\.map/.test(skipFn), skipFn.slice(0, 300))
check(
  'skip does not touch the habit as a whole',
  !/markSkipped\(\s*habit\.id\s*\)/.test(skipFn),
  'skipping must not mute every future slot',
)

// ---------- the notification offers Skip, and the worker honours it ----------
check('notification has a skip action', hook.includes("action: 'skip'"))
check('worker handles the skip action', sw.includes("event.action === 'skip'"))
check('skip returns without opening the app', /=== 'skip'\)\s*return/.test(sw))
check('worker still closes the notification', sw.includes('event.notification.close()'))
// Closing one must not close the others.
check('worker never clears all notifications', !sw.includes('getNotifications'), 'that would dismiss the rest')

// ---------- the in-app list offers the same choice ----------
check('banner has a Skip control', banner.includes('Skip'))
check('banner explains what skip does', /only the nudges outstanding|still arrives/i.test(banner))
check('banner skip is labelled for screen readers', banner.includes('aria-label={`Skip this reminder'))
check('App passes the skip handler', app.includes('onSkip={reminders.skip}'))

console.log(fails === 0 ? '\nNOTIFICATION WIRING OK' : `\n${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)
