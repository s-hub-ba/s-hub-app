import React from 'react';
import { motion } from 'motion/react';

interface NannyCvidCardModalProps {
  isOpen: boolean;
  nanny: {
    id: string;
    first_name?: string;
    last_name?: string;
    location_borough?: string;
    years_experience?: number;
    certifications?: string[];
    preferred_job_types?: string[];
    bio?: string;
    cvid: string;
  } | null;
  shiftScore?: number | null;
  shiftScoreLoading?: boolean;
  onClose: () => void;
}

export default function NannyCvidCardModal({
  isOpen,
  nanny,
  shiftScore,
  shiftScoreLoading = false,
  onClose,
}: NannyCvidCardModalProps) {
  if (!isOpen || !nanny) return null;

  const fullName = `${nanny.first_name || ''} ${nanny.last_name || ''}`.trim() || 'Nanny Profile';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="w-full max-w-2xl overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-2xl"
      >
        <div className="relative bg-gradient-to-r from-stone-900 via-emerald-900 to-teal-800 px-6 py-6">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-white/15 px-2.5 py-1 text-sm font-semibold text-white hover:bg-white/25"
          >
            Close
          </button>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-100">Nanny CVID Card</p>
          <h2 className="mt-2 text-3xl font-bold text-white">{fullName}</h2>
          <div className="mt-4 inline-flex items-end gap-2 rounded-2xl border border-emerald-200/40 bg-black/20 px-4 py-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-100">CVID</span>
            <span className="font-mono text-3xl font-bold tracking-[0.2em] text-white">{nanny.cvid}</span>
          </div>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-2">
          <MetricTile label="Experience" value={`${nanny.years_experience ?? 0} years`} />
          <MetricTile
            label="ShiftScore"
            value={shiftScoreLoading ? 'Loading...' : shiftScore != null ? shiftScore.toFixed(1) : 'Not enough data'}
          />
          <MetricTile label="Location" value={nanny.location_borough || 'Not specified'} />
          <MetricTile
            label="Preferred Roles"
            value={nanny.preferred_job_types?.length ? nanny.preferred_job_types.slice(0, 2).join(', ') : 'Not specified'}
          />
        </div>

        <div className="border-t border-stone-100 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Certifications</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {nanny.certifications?.length ? (
              nanny.certifications.map((cert) => (
                <span key={cert} className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-700">
                  {cert}
                </span>
              ))
            ) : (
              <span className="text-sm text-stone-500">No certifications listed.</span>
            )}
          </div>

          {nanny.bio ? (
            <>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-stone-500">Profile Summary</p>
              <p className="mt-1 text-sm leading-6 text-stone-700">{nanny.bio}</p>
            </>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-stone-900">{value}</p>
    </div>
  );
}
