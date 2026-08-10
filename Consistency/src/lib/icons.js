import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  BellOff,
  BookOpen,
  Calculator,
  Calendar,
  Check,
  CheckCircle2,
  Code2,
  Crown,
  Download,
  Droplet,
  Dumbbell,
  ExternalLink,
  Flame,
  Gem,
  Guitar,
  Languages,
  Lock,
  MessageSquareText,
  Monitor,
  Moon,
  NotebookPen,
  Pencil,
  PhoneOff,
  Plus,
  RotateCcw,
  Salad,
  Search,
  Sparkles,
  Sprout,
  Star,
  Sun,
  Timer,
  Trash2,
  Trophy,
  Upload,
  X,
  Zap,
} from 'lucide-react'

// One registry for every glyph in the app. Icons are stored by KEY, never as a
// component reference, so a habit's icon survives JSON/spreadsheet round trips.

/** Choices offered in the habit form, in picker order. */
export const HABIT_ICONS = [
  { key: 'star', label: 'Star', Icon: Star },
  { key: 'book', label: 'Reading', Icon: BookOpen },
  { key: 'notebook', label: 'Notes', Icon: NotebookPen },
  { key: 'calculator', label: 'Maths', Icon: Calculator },
  { key: 'code', label: 'Coding', Icon: Code2 },
  { key: 'languages', label: 'Languages', Icon: Languages },
  { key: 'timer', label: 'Focus time', Icon: Timer },
  { key: 'search', label: 'Revision', Icon: Search },
  { key: 'run', label: 'Exercise', Icon: Activity },
  { key: 'dumbbell', label: 'Strength', Icon: Dumbbell },
  { key: 'droplet', label: 'Water', Icon: Droplet },
  { key: 'salad', label: 'Eating well', Icon: Salad },
  { key: 'moon', label: 'Sleep', Icon: Moon },
  { key: 'phone-off', label: 'No phone', Icon: PhoneOff },
  { key: 'guitar', label: 'Practice', Icon: Guitar },
  { key: 'sparkles', label: 'Tidy up', Icon: Sparkles },
]

export const HABIT_ICON_MAP = Object.fromEntries(HABIT_ICONS.map((i) => [i.key, i]))

export const DEFAULT_ICON = 'star'

export const isKnownIcon = (key) =>
  typeof key === 'string' && Object.hasOwn(HABIT_ICON_MAP, key)

/** Milestone badge glyphs, keyed the same way. */
export const BADGE_ICONS = {
  sprout: Sprout,
  flame: Flame,
  zap: Zap,
  star: Star,
  gem: Gem,
  crown: Crown,
}

// Chrome icons are referenced directly by components — no key indirection
// needed, because nothing about them is persisted.
export const UI = {
  today: CheckCircle2,
  calendar: Calendar,
  stats: BarChart3,
  notes: NotebookPen,
  data: Lock,
  sun: Sun,
  moon: Moon,
  system: Monitor,
  flame: Flame,
  check: Check,
  trophy: Trophy,
  sprout: Sprout,
  sparkles: Sparkles,
  plus: Plus,
  edit: Pencil,
  close: X,
  remove: Trash2,
  prev: ArrowLeft,
  next: ArrowRight,
  download: Download,
  upload: Upload,
  warning: AlertTriangle,
  retry: RotateCcw,
  feedback: MessageSquareText,
  external: ExternalLink,
  bell: Bell,
  bellOff: BellOff,
}
