import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, X } from 'lucide-react';

const CONFETTI_BITS = [
  { left: '8%', delay: 0.05, duration: 2.2, color: 'bg-amber-300' },
  { left: '18%', delay: 0.18, duration: 2.5, color: 'bg-rose-300' },
  { left: '31%', delay: 0.12, duration: 2.1, color: 'bg-emerald-300' },
  { left: '44%', delay: 0.22, duration: 2.4, color: 'bg-sky-300' },
  { left: '57%', delay: 0.09, duration: 2.35, color: 'bg-orange-300' },
  { left: '69%', delay: 0.26, duration: 2.6, color: 'bg-fuchsia-300' },
  { left: '82%', delay: 0.16, duration: 2.15, color: 'bg-lime-300' },
  { left: '92%', delay: 0.3, duration: 2.45, color: 'bg-cyan-300' },
];

interface PlacementHandshakeModalProps {
  open: boolean;
  onClose: () => void;
  jobTitle?: string;
  agencyName?: string;
  familyName?: string;
  nannyName?: string;
  compact?: boolean;
}

const HandshakePill = ({ side, label, tint }: { side: 'left' | 'right'; label: string; tint: string }) => (
  <motion.div
    initial={{ opacity: 0, x: side === 'left' ? -80 : 80, rotate: side === 'left' ? -10 : 10, scale: 0.9 }}
    animate={{ opacity: 1, x: 0, rotate: 0, scale: 1 }}
    transition={{ duration: 0.55, ease: 'easeOut' }}
    className={`relative flex h-20 w-32 items-center justify-center rounded-[2rem] border border-white/60 text-sm font-black uppercase tracking-[0.16em] text-stone-900 shadow-lg ${tint}`}
  >
    <span className="relative z-10 text-center leading-tight">{label}</span>
    <div className="absolute inset-y-5 w-10 rounded-full bg-white/70 blur-sm" style={{ [side === 'left' ? 'right' : 'left']: '-0.8rem' } as React.CSSProperties} />
  </motion.div>
);

export default function PlacementHandshakeModal({
  open,
  onClose,
  jobTitle,
  agencyName,
  familyName,
  nannyName,
  compact = false,
}: PlacementHandshakeModalProps) {
  const title = jobTitle || 'your placement';

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className={`relative w-full overflow-hidden rounded-[2rem] border border-white/50 bg-[radial-gradient(circle_at_top,#fef3c7,transparent_38%),linear-gradient(135deg,#fff7ed_0%,#ecfccb_52%,#ecfeff_100%)] shadow-2xl ${compact ? 'max-w-xl p-6' : 'max-w-2xl p-8'}`}
          >
            {!compact && CONFETTI_BITS.map((bit, index) => (
              <motion.span
                key={index}
                initial={{ opacity: 0, y: -24, rotate: 0 }}
                animate={{ opacity: [0, 1, 1, 0], y: [0, 90, 220, 320], rotate: [0, 140, 260, 360] }}
                transition={{ duration: bit.duration, delay: bit.delay, ease: 'easeOut' }}
                className={`pointer-events-none absolute top-0 h-3 w-2 rounded-full ${bit.color}`}
                style={{ left: bit.left }}
              />
            ))}

            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full bg-white/70 p-2 text-stone-500 transition-colors hover:bg-white hover:text-stone-700"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="absolute -left-10 top-8 h-28 w-28 rounded-full bg-amber-300/35 blur-2xl" />
            <div className="absolute -right-6 bottom-6 h-32 w-32 rounded-full bg-emerald-300/35 blur-2xl" />

            <div className="relative">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-700">{compact ? 'Milestone Recap' : 'Milestone Unlocked'}</p>
              <h2 className={`mt-3 font-black tracking-tight text-stone-900 ${compact ? 'text-2xl' : 'text-3xl'}`}>Placement sealed</h2>
              <p className={`mt-2 max-w-xl text-sm text-stone-600 ${compact ? 'leading-5' : 'leading-6'}`}>
                Everyone is aligned and {title} is officially live. The agency, family, and nanny are now moving together on the same placement.
              </p>

              <div className={`flex items-center justify-center gap-3 sm:gap-6 ${compact ? 'mt-6' : 'mt-8'}`}>
                <HandshakePill side="left" label={agencyName || 'Agency'} tint="bg-amber-100" />
                <motion.div
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: [0.7, 1.08, 1] }}
                  transition={{ duration: 0.65, ease: 'easeOut', delay: 0.2 }}
                  className={`relative flex items-center justify-center rounded-full border border-white/70 bg-white/80 shadow-xl ${compact ? 'h-20 w-20' : 'h-24 w-24'}`}
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, ease: 'linear', repeat: Number.POSITIVE_INFINITY }}
                    className="absolute inset-2 rounded-full border border-dashed border-emerald-300/80"
                  />
                  <div className="absolute h-10 w-10 rounded-full bg-amber-300/50 blur-md" />
                  <div className={`relative flex items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg ${compact ? 'h-12 w-12' : 'h-14 w-14'}`}>
                    <CheckCircle2 className={compact ? 'h-6 w-6' : 'h-7 w-7'} />
                  </div>
                </motion.div>
                <HandshakePill side="right" label={nannyName || familyName || 'Placement'} tint="bg-emerald-100" />
              </div>

              <div className={`grid gap-3 rounded-[1.5rem] border border-white/70 bg-white/70 p-4 sm:grid-cols-3 ${compact ? 'mt-6' : 'mt-8'}`}>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-stone-500">Agency</p>
                  <p className="mt-2 text-sm font-semibold text-stone-900">{agencyName || 'Agency partner confirmed'}</p>
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-stone-500">Family</p>
                  <p className="mt-2 text-sm font-semibold text-stone-900">{familyName || 'Family approved and ready'}</p>
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-stone-500">Nanny</p>
                  <p className="mt-2 text-sm font-semibold text-stone-900">{nannyName || 'Nanny confirmed and active'}</p>
                </div>
              </div>

              <div className={`flex items-center justify-between gap-3 rounded-[1.5rem] border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900 ${compact ? 'mt-4' : 'mt-6'}`}>
                <span className="font-semibold">Next move: use the active placement workflow to coordinate updates and completion.</span>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-emerald-700"
                >
                  {compact ? 'Close recap' : 'Continue'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
