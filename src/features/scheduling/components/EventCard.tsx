import React from 'react';
import type { CalendarEventDTO } from '../types/scheduling';

interface EventCardProps {
  event: CalendarEventDTO;
  onClick?: () => void;
}

const COLOR_BAR: Record<string, string> = {
  teal: 'bg-teal-500',
  grey: 'bg-gray-400',
  yellow: 'bg-amber-400',
  green: 'bg-green-500',
  red: 'bg-red-500',
  blue: 'bg-blue-500',
};

export const EventCard: React.FC<EventCardProps> = ({ event, onClick }) => {
  const start = new Date(event.start);
  const end = new Date(event.end);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden"
    >
      <div className={`h-1 ${COLOR_BAR[event.colorKey] ?? 'bg-gray-300'}`} />
      <div className="px-4 py-3 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-gray-900 truncate">{event.title}</h3>
          <span className="text-[11px] text-gray-400 capitalize">{event.status}</span>
        </div>
        <p className="text-xs text-gray-500">
          {start.toLocaleDateString()} {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
        {event.locationLabel && (
          <p className="text-xs text-gray-400 truncate">{event.locationLabel}</p>
        )}
      </div>
    </button>
  );
};

export default EventCard;
