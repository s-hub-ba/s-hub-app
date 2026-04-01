import React from 'react';
import { motion } from 'motion/react';

interface NannyCvidCardModalProps {
  isOpen: boolean;
  nanny: {
    id: string;
    first_name?: string;
    last_name?: string;
    photo_url?: string;
    location_borough?: string;
    years_experience?: number;
    expected_pay_min?: number;
    expected_pay_max?: number;
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
  const initials = `${nanny.first_name?.[0] || 'N'}${nanny.last_name?.[0] || ''}`.toUpperCase();

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="w-full max-w-3xl overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-2xl"
      >
        <div className="relative bg-gradient-to-r from-stone-900 via-teal-900 to-emerald-800 px-6 py-6">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-white/15 px-2.5 py-1 text-sm font-semibold text-white hover:bg-white/25"
          >
            Close
          </button>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-100">Official Nanny Identity Card</p>
          <div className="mt-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold text-white">{fullName}</h2>
              <p className="mt-1 text-sm text-emerald-100">Experience: {nanny.years_experience ?? 0} years</p>
            </div>
            <div className="inline-flex items-end gap-2 rounded-2xl border border-emerald-200/40 bg-black/20 px-4 py-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-100">CVID</span>
              <span className="font-mono text-2xl font-bold tracking-[0.2em] text-white">{nanny.cvid}</span>
            </div>
          </div>
        </div>

        <div className="p-6 grid gap-5 md:grid-cols-[180px_1fr]">
          {nanny.photo_url ? (
            <img
              src={nanny.photo_url}
              alt={fullName}
              className="rounded-2xl border border-stone-200 bg-stone-50 h-[220px] w-full object-cover"
             
            />
          ) : (
            <div className="rounded-2xl border border-stone-200 bg-stone-50 h-[220px] flex items-center justify-center text-5xl font-bold text-stone-500">
              {initials}
            </div>
          )}

          <div className="space-y-4">
            <p className="text-sm leading-6 text-stone-700 min-h-[72px]">{nanny.bio || 'No biography provided yet.'}</p>

            <div className="grid gap-3 sm:grid-cols-3">
              <MetricTile
                label="ShiftScore"
                value={shiftScoreLoading ? 'Loading...' : shiftScore != null ? shiftScore.toFixed(1) : 'Not enough data'}
              />
              <MetricTile label="Location" value={nanny.location_borough || 'Not specified'} />
              <MetricTile label="Pay Range" value={nanny.expected_pay_min != null && nanny.expected_pay_max != null ? `$${nanny.expected_pay_min}-$${nanny.expected_pay_max}/hr` : 'Not specified'} />
            </div>

            <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Certifications</p>
            <div className="flex flex-wrap gap-2">
              {nanny.certifications?.length ? (
                nanny.certifications.map((cert) => (
                  <span key={cert} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-700">
                    <span aria-hidden="true">●</span>
                    {cert}
                  </span>
                ))
              ) : (
                <span className="text-sm text-stone-500">No certifications listed.</span>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-stone-100 px-6 py-4 text-xs text-stone-500 flex items-center justify-between">
          <span>Issued by Shift Me Up Identity Services</span>
          <span>Verified CVID Document</span>
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
