import React from 'react';
import { useNotifications, NotificationType } from '../contexts/NotificationContext';
import { Bell, MessageSquare, Briefcase, Star, Trash2, CheckCircle2, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';

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

export default function Notifications() {
  const { notifications, markAsRead, markAllAsRead, removeNotification } = useNotifications();
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Notifications</h1>
          <p className="text-stone-500 mt-1">Stay updated with your latest activities and alerts.</p>
        </div>
        {notifications.length > 0 && (
          <button 
            onClick={markAllAsRead}
            className="flex items-center gap-2 px-4 py-2 bg-stone-100 text-stone-600 rounded-xl text-sm font-medium hover:bg-stone-200 transition-colors"
          >
            <CheckCircle2 className="h-4 w-4" />
            Mark all as read
          </button>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        {notifications.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell className="h-8 w-8 text-stone-300" />
            </div>
            <h3 className="text-lg font-bold text-stone-900">All caught up!</h3>
            <p className="text-stone-500">You don't have any notifications at the moment.</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {notifications.map((notification, index) => {
              const Icon = ICON_MAP[notification.type] || Bell;
              return (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  key={notification.id} 
                  className={`p-6 hover:bg-stone-50 transition-all relative group cursor-pointer ${!notification.read ? 'bg-emerald-50/20' : ''}`}
                  onClick={() => {
                    markAsRead(notification.id);
                    if (notification.link) navigate(notification.link);
                  }}
                >
                  <div className="flex gap-6 items-start">
                    <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${BG_MAP[notification.type]} ${COLOR_MAP[notification.type]}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className={`font-bold ${!notification.read ? 'text-stone-900' : 'text-stone-700'}`}>
                          {notification.title}
                        </h3>
                        <span className="text-xs text-stone-400 font-medium">{notification.time}</span>
                      </div>
                      <p className="text-stone-600 leading-relaxed">
                        {notification.message}
                      </p>
                      {notification.link && (
                        <div className="mt-3 flex items-center text-xs font-bold text-emerald-600 group-hover:translate-x-1 transition-transform">
                          View details <ChevronRight className="h-3 w-3 ml-1" />
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        removeNotification(notification.id);
                      }}
                      className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
