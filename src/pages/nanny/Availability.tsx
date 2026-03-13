import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, Save, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { getNannyById, updateNannyProfile } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIME_SLOTS = ['Morning (6am-12pm)', 'Afternoon (12pm-6pm)', 'Evening (6pm-12am)', 'Overnight (12am-6am)'];

export default function NannyAvailability() {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [availability, setAvailability] = useState<Record<string, string[]>>({});

  const nannyId = user?.id || 'f0e9d8c7-b6a5-4321-0987-654321fedcba';

  useEffect(() => {
    const loadData = async () => {
      try {
        const nanny = await getNannyById(nannyId);
        if (nanny && nanny.availability) {
          setAvailability(nanny.availability);
        } else {
          setAvailability({
            Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: []
          });
        }
      } catch (error) {
        console.error('Error loading availability:', error);
      }
    };
    loadData();
  }, []);

  const handleToggle = (day: string, slot: string) => {
    setAvailability(prev => {
      const daySlots = prev[day] || [];
      if (daySlots.includes(slot)) {
        return { ...prev, [day]: daySlots.filter(s => s !== slot) };
      } else {
        return { ...prev, [day]: [...daySlots, slot] };
      }
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateNannyProfile(nannyId, { availability });
    } catch (error) {
      console.error('Error saving availability:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Availability</h1>
          <p className="text-stone-500 mt-1">Set your general working hours to match with the right jobs.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
        >
          {isSaving ? (
            <><Clock className="h-4 w-4 animate-spin" /> Saving...</>
          ) : (
            <><Save className="h-4 w-4" /> Save Schedule</>
          )}
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 border-b border-stone-100 bg-stone-50/50">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
              <CalendarIcon className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-900">Weekly Schedule</h2>
              <p className="text-stone-600 text-sm mt-1 leading-relaxed">
                Select the times you are generally available to work. This helps agencies find you for jobs that fit your schedule. You can always negotiate specific hours per job.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 md:p-8">
          <div className="space-y-6">
            {DAYS.map((day, index) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                key={day} 
                className="flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-2xl border border-stone-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-colors"
              >
                <div className="w-32 font-bold text-stone-900">
                  {day}
                </div>
                <div className="flex-1 flex flex-wrap gap-2">
                  {TIME_SLOTS.map(slot => {
                    const isSelected = availability[day]?.includes(slot);
                    return (
                      <button
                        key={slot}
                        onClick={() => handleToggle(day, slot)}
                        className={`px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2 border ${
                          isSelected 
                            ? 'bg-emerald-100 border-emerald-200 text-emerald-800 shadow-sm' 
                            : 'bg-white border-stone-200 text-stone-600 hover:border-emerald-300 hover:bg-emerald-50'
                        }`}
                      >
                        {isSelected && <CheckCircle2 className="h-3.5 w-3.5" />}
                        {slot.split(' ')[0]}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
