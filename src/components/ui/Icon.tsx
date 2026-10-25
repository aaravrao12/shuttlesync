import {
  Bus, CheckCircle2, Clock, Footprints, HelpCircle, CircleSlash, Hourglass, MapPin, QrCode, ScanLine, Users,
  Settings, Home, Map as MapIcon, MessageSquare, Sun, Moon, ShieldCheck, Camera, WifiOff, Wifi, ChevronRight, ChevronLeft,
  X, Check, Plus, Printer, Download, BarChart3, FlaskConical, ClipboardList, Navigation, Radio, Languages, Type, LogOut,
  Play, Pause, RotateCcw, AlertTriangle, Info, Sparkles, Building2, Route, FileText, Search, Eye, Pencil, Trash2, Lock,
  Tablet, Smartphone, Timer, Bell, GraduationCap, Upload, ArrowRight, Presentation, Layers, ExternalLink,
} from 'lucide-react'
import type { LucideProps } from 'lucide-react'

const ICONS = {
  bus: Bus, 'check-circle': CheckCircle2, clock: Clock, footprints: Footprints, 'help-circle': HelpCircle,
  'circle-slash': CircleSlash, hourglass: Hourglass, pin: MapPin, qr: QrCode, scan: ScanLine, users: Users,
  settings: Settings, home: Home, map: MapIcon, message: MessageSquare, sun: Sun, moon: Moon, shield: ShieldCheck,
  camera: Camera, 'wifi-off': WifiOff, wifi: Wifi, right: ChevronRight, left: ChevronLeft, x: X, check: Check, plus: Plus,
  print: Printer, download: Download, chart: BarChart3, flask: FlaskConical, clipboard: ClipboardList, nav: Navigation,
  radio: Radio, lang: Languages, type: Type, 'log-out': LogOut, play: Play, pause: Pause, reset: RotateCcw,
  warn: AlertTriangle, info: Info, spark: Sparkles, building: Building2, route: Route, file: FileText, search: Search,
  eye: Eye, edit: Pencil, trash: Trash2, lock: Lock, tablet: Tablet, phone: Smartphone, timer: Timer, bell: Bell,
  teacher: GraduationCap, upload: Upload, arrow: ArrowRight, slides: Presentation, layers: Layers, external: ExternalLink,
} as const

export type IconName = keyof typeof ICONS

export function Icon({ name, size = 20, ...rest }: { name: IconName | string; size?: number } & Omit<LucideProps, 'ref'>) {
  const C = (ICONS as Record<string, typeof Bus>)[name] ?? HelpCircle
  return <C size={size} aria-hidden="true" strokeWidth={2.1} {...rest} />
}
