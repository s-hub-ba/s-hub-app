import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCircle2, MessageSquare, Briefcase, Star, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useNotifications, NotificationType } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';

const ICON_MAP: Record<NotificationType, any> = {
  application: Briefcase,
  message: MessageSquare,
  review: Star,
  system: Bell
};

const COLOR_MAP: Record<NotificationType, string> = {
  application: 'text-blue-600',
  message: 'text-emerald-600',
  review: 'text-amber-600',
  system: 'text-stone-600'
};

const BG_MAP: Record<NotificationType, string> = {
  application: 'bg-blue-100',
  message: 'bg-emerald-100',
  review: 'bg-amber-100',
  system: 'bg-stone-100'
};

export default function NotificationsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification } = useNotifications();
  const { role } = useAuth();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const getNotificationsPath = () => {
    if (role === 'nanny') return '/nanny/notifications';
    if (role === 'family') return '/family/notifications';
    if (role === 'agency_admin' || role === 'agency_recruiter') return '/agency/notifications';
    if (role === 'superadmin') return '/admin/notifications';
    return '/notifications';
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-stone-400 hover:text-stone-600 relative transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 border-2 border-white"></span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden z-50"
          >
            <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
              <h3 className="font-bold text-stone-900">Notifications</h3>
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
                >
                  Mark all as read
                </button>
              )}
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-stone-500">
                  <Bell className="h-8 w-8 mx-auto mb-3 text-stone-300" />
                  <p>No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {notifications.map((notification) => {
                    const Icon = ICON_MAP[notification.type] || Bell;
                    return (
                      <div 
                        key={notification.id} 
                        className={`p-4 hover:bg-stone-50 transition-colors relative group cursor-pointer ${!notification.read ? 'bg-emerald-50/30' : ''}`}
                        onClick={() => {
                          markAsRead(notification.id);
                          if (notification.link) {
                            navigate(notification.link);
                            setIsOpen(false);
                          }
                        }}
                      >
                        <div className="flex gap-4">
                          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${BG_MAP[notification.type]} ${COLOR_MAP[notification.type]}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className={`text-sm font-bold truncate ${!notification.read ? 'text-stone-900' : 'text-stone-700'}`}>
                                {notification.title}
                              </p>
                              <span className="text-[10px] font-medium text-stone-400 whitespace-nowrap">
                                {notification.time}
                              </span>
                            </div>
                            <p className="text-sm text-stone-600 mt-0.5 line-clamp-2">
                              {notification.message}
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            removeNotification(notification.id);
                          }}
                          className="absolute top-2 right-2 p-1 text-stone-400 hover:text-stone-600 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg hover:bg-stone-100"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="p-3 border-t border-stone-100 bg-stone-50/50 text-center">
              <button 
                onClick={() => {
                  setIsOpen(false);
                  navigate(getNotificationsPath());
                }}
                className="text-sm font-bold text-stone-600 hover:text-stone-900"
              >
                View all notifications
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

