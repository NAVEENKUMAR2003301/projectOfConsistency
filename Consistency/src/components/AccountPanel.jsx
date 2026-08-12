import { useCallback, useEffect, useState } from 'react'
import { UI } from '../lib/icons'
import {
  cloudConfigured,
  createAccount,
  clearCloud,
  deleteAccount,
  fetchAccount,
  openSession,
  pushReminders,
  readCloud,
  remindersPayload,
  subscribeDevice,
  unsubscribeDevice,
  writeCloud,
} from '../lib/cloud'
import { hasReminder } from '../lib/reminders'

/**
 * Optional sign-in for reminders that arrive while the app is closed.
 *
 * The account is a random key rather than an email and password: it needs no
 * personal data, no email provider, and no slow password hash (which would not
 * fit the worker's free-tier CPU budget anyway). The trade-off is real and
 * stated plainly below — lose the key and the account is gone.
 */
export default function AccountPanel({ habits }) {
  const [cloud, setCloud] = useState(readCloud)
  const [details, setDetails] = useState(null)
  const [keyInput, setKeyInput] = useState('')
  const [freshKey, setFreshKey] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const signedIn = Boolean(cloud?.token)
  const withReminders = habits.filter(hasReminder)

  // Bumped to re-fetch after an action changes something server-side.
  const [reloads, setReloads] = useState(0)
  const refresh = useCallback(() => setReloads((n) => n + 1), [])

  useEffect(() => {
    const token = cloud?.token
    if (!token) return

    // `stale` drops the result of a request that a newer one has superseded,
    // and stops a response arriving after unmount from setting state.
    let stale = false
    ;(async () => {
      try {
        const data = await fetchAccount(token)
        if (!stale) setDetails(data)
      } catch (e) {
        if (stale) return
        // An expired session is the common case; make them sign in again.
        if (/sign in/i.test(e.message)) {
          clearCloud()
          setCloud(null)
        }
        setDetails(null)
      }
    })()

    return () => {
      stale = true
    }
  }, [cloud, reloads])

  if (!cloudConfigured()) {
    return (
      <div className="glass rounded-3xl p-4 sm:p-5">
        <h3 className="font-semibold text-ink">Reminders while the app is closed</h3>
        <p className="mt-1 text-sm text-ink-2">
          Not set up on this build. A web page can only notify you while it is open;
          delivering a reminder with the app closed needs a small server, which is
          configured separately.
        </p>
        <p className="mt-2 text-xs text-ink-3">
          See <code>server/README.md</code> to deploy one — it runs on a free plan.
        </p>
      </div>
    )
  }

  const run = async (label, fn) => {
    setBusy(label)
    setError('')
    setStatus('')
    try {
      await fn()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy('')
    }
  }

  const handleCreate = () =>
    run('create', async () => {
      const { accountKey } = await createAccount()
      const session = await openSession(accountKey)
      const next = { token: session.token, accountId: session.accountId }
      writeCloud(next)
      setCloud(next)
      // Shown once and never again — the server only stores its hash.
      setFreshKey(accountKey)
    })

  const handleSignIn = () =>
    run('signin', async () => {
      const session = await openSession(keyInput.trim())
      const next = { token: session.token, accountId: session.accountId }
      writeCloud(next)
      setCloud(next)
      setKeyInput('')
    })

  const handleEnablePush = () =>
    run('push', async () => {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        throw new Error('Notifications are blocked for this site in your browser.')
      }
      await subscribeDevice(cloud.token)
      await pushReminders(cloud.token, habits)
      refresh()
      setStatus('This device will now get reminders even when the app is closed.')
    })

  const handleSync = () =>
    run('sync', async () => {
      await pushReminders(cloud.token, habits)
      refresh()
      setStatus('Reminder times updated.')
    })

  const handleSignOut = () =>
    run('signout', async () => {
      await unsubscribeDevice(cloud.token)
      clearCloud()
      setCloud(null)
      setDetails(null)
      setStatus('Signed out on this device. Your habits are untouched.')
    })

  const handleDelete = () =>
    run('delete', async () => {
      await unsubscribeDevice(cloud.token).catch(() => {})
      await deleteAccount(cloud.token)
      clearCloud()
      setCloud(null)
      setDetails(null)
      setConfirmDelete(false)
      setStatus('Account deleted. Nothing of yours remains on the server.')
    })

  return (
    <div className="glass rounded-3xl p-4 sm:p-5">
      <h3 className="flex items-center gap-2 font-semibold text-ink">
        <UI.bell size={16} strokeWidth={1.9} aria-hidden="true" />
        Reminders while the app is closed
      </h3>

      {!signedIn ? (
        <>
          <p className="mt-1 text-sm text-ink-2">
            Optional. Without this, reminders only arrive while Consistency is open in
            a tab. Sign in and a small server can send them at your set times even
            when the app is shut.
          </p>
          <p className="mt-2 text-xs text-ink-3">
            Only habit names and reminder times are uploaded. Your check-ins, notes
            and spending stay on this device.
          </p>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              onClick={handleCreate}
              disabled={Boolean(busy)}
              className="flex-1 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-40"
            >
              {busy === 'create' ? 'Creating…' : 'Create an account key'}
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Already have a key? Paste it here"
              aria-label="Account key"
              className="min-h-11 flex-1 rounded-xl border border-line bg-surface px-3 py-2.5 text-base text-ink placeholder-ink-3 outline-none focus:border-violet-500 sm:text-sm"
            />
            <button
              onClick={handleSignIn}
              disabled={Boolean(busy) || keyInput.trim().length < 8}
              className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-card-hover disabled:opacity-40"
            >
              {busy === 'signin' ? 'Checking…' : 'Use this key'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-ink-2">
            Signed in. {details?.devices?.length ?? 0} device
            {(details?.devices?.length ?? 0) === 1 ? '' : 's'} set up,{' '}
            {details?.reminders?.length ?? 0} reminder
            {(details?.reminders?.length ?? 0) === 1 ? '' : 's'} scheduled.
          </p>

          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {[
              { label: 'Account', value: details?.accountId?.slice(0, 8) ?? '—' },
              {
                label: 'Since',
                value: details?.createdAt
                  ? new Date(details.createdAt).toLocaleDateString()
                  : '—',
              },
              { label: 'Devices', value: details?.devices?.length ?? 0 },
              { label: 'Sent', value: details?.remindersSent ?? 0 },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-line bg-card p-3">
                <dt className="text-[11px] tracking-wide text-ink-3 uppercase">
                  {item.label}
                </dt>
                <dd className="tabular mt-1 font-semibold break-words text-ink">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>

          {details?.devices?.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {details.devices.map((device) => (
                <li
                  key={device.id}
                  className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm"
                >
                  <UI.system size={14} strokeWidth={1.9} className="shrink-0 text-ink-3" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-ink">
                    {device.label || 'Unknown device'}
                  </span>
                  {device.failing && (
                    <span className="shrink-0 text-[11px] text-amber-600 dark:text-amber-300">
                      not delivering
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={handleEnablePush}
              disabled={Boolean(busy)}
              className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-40"
            >
              {busy === 'push' ? 'Enabling…' : 'Enable on this device'}
            </button>
            <button
              onClick={handleSync}
              disabled={Boolean(busy) || withReminders.length === 0}
              className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-card-hover disabled:opacity-40"
            >
              {busy === 'sync' ? 'Updating…' : `Update times (${remindersPayload(habits).length})`}
            </button>
            <button
              onClick={handleSignOut}
              disabled={Boolean(busy)}
              className="rounded-xl px-4 py-2.5 text-sm text-ink-3 transition hover:bg-card-hover hover:text-ink disabled:opacity-40"
            >
              Sign out
            </button>
          </div>

          {withReminders.length === 0 && (
            <p className="mt-3 text-xs text-ink-3">
              No habit has a reminder time yet — set one on a habit and it will appear
              here.
            </p>
          )}

          <div className="mt-4 border-t border-line pt-3">
            {confirmDelete ? (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleDelete}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500"
                >
                  Yes, delete the account
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-xl px-4 py-2 text-sm text-ink-3 transition hover:text-ink"
                >
                  Keep it
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-xs text-ink-3 underline-offset-2 transition hover:text-rose-500 hover:underline"
              >
                Delete this account and everything on the server
              </button>
            )}
          </div>
        </>
      )}

      {freshKey && (
        <div className="animate-rise mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <UI.warning size={15} strokeWidth={2} aria-hidden="true" />
            Save this key now
          </p>
          <p className="mt-1 text-xs text-ink-2">
            It is the only way back into this account, and the only copy. The server
            stores a hash of it, so nobody — including me — can recover it for you.
          </p>
          <code className="tabular mt-3 block rounded-xl bg-surface px-3 py-2.5 text-center text-base font-semibold tracking-wider break-all text-ink">
            {freshKey}
          </code>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => navigator.clipboard?.writeText(freshKey)}
              className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink transition hover:bg-card-hover"
            >
              Copy
            </button>
            <button
              onClick={() => setFreshKey(null)}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-500"
            >
              I have saved it
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-300">
          {error}
        </p>
      )}
      {status && !error && (
        <p className="mt-3 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {status}
        </p>
      )}
    </div>
  )
}
