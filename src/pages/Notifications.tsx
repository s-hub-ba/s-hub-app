import React, { useState } from 'react';
import { useNotifications, NotificationType } from '../contexts/NotificationContext';
import { Bell, MessageSquare, Briefcase, Star, Trash2, CheckCircle2, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { registerPushTokenForCurrentUser } from '../lib/api';
import { getBrowserFcmToken } from '../lib/push';

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
  const { user, role } = useAuth();
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  const [isEnablingPush, setIsEnablingPush] = useState(false);

  const enablePushNotifications = async () => {
    if (!user?.uid || !role || role === 'superadmin') {
      setPushStatus('Push is available for nanny, family, and agency accounts.');
      return;
    }

    setIsEnablingPush(true);
    setPushStatus(null);
    try {
      const token = await getBrowserFcmToken();
      if (!token) {
        setPushStatus('Push permission was not granted or this browser does not support web push.');
        return;
      }

      const ok = await registerPushTokenForCurrentUser({
        role,
        userId: user.uid,
        token,
        deviceName: navigator.platform || 'Web Browser',
        os: navigator.userAgent || 'Web',
        appVersion: 'web',
      });

      setPushStatus(ok ? 'Push notifications enabled for this device.' : 'Push token saved locally but failed to register on server.');
    } catch (error) {
      console.error('Failed to enable push notifications:', error);
      setPushStatus('Failed to enable push notifications on this device.');
    } finally {
      setIsEnablingPush(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 sm:py-8 px-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">Notifications</h1>
          <p className="text-sm sm:text-base text-stone-500 mt-1">Stay updated with your latest activities and alerts.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <button
            onClick={enablePushNotifications}
            disabled={isEnablingPush}
            className="flex items-center justify-center gap-2 px-4 py-3 sm:py-2 bg-emerald-100 text-emerald-700 rounded-xl text-sm font-medium hover:bg-emerald-200 transition-colors disabled:opacity-60 min-h-[44px]"
          >
            <Bell className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{isEnablingPush ? 'Enabling...' : 'Enable Push'}</span>
          </button>
          {notifications.length > 0 && (
            <button 
              onClick={markAllAsRead}
              className="flex items-center justify-center gap-2 px-4 py-3 sm:py-2 bg-stone-100 text-stone-600 rounded-xl text-sm font-medium hover:bg-stone-200 transition-colors min-h-[44px]"
            >
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Mark all as read</span>
              <span className="sm:hidden">Mark read</span>
            </button>
          )}
        </div>
      </div>

      {pushStatus && (
        <div className="mb-5 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-xs sm:text-sm text-stone-700">
          {pushStatus}
        </div>
      )}

      <div className="bg-white rounded-2xl sm:rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        {notifications.length === 0 ? (
          <div className="py-12 sm:py-20 text-center px-4">
            <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell className="h-8 w-8 text-stone-300" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-stone-900">All caught up!</h3>
            <p className="text-xs sm:text-sm text-stone-500 mt-1">You don't have any notifications at the moment.</p>
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
                  className={`p-4 sm:p-6 hover:bg-stone-50 transition-all relative group cursor-pointer active:bg-stone-100 ${!notification.read ? 'bg-emerald-50/20' : ''}`}
                  onClick={() => {
                    markAsRead(notification.id);
                    if (notification.link) navigate(notification.link);
                  }}
                >
                  <div className="flex gap-3 sm:gap-6 items-start">
                    <div className={`h-12 w-12 min-h-[48px] min-w-[48px] rounded-2xl flex items-center justify-center shrink-0 ${BG_MAP[notification.type]} ${COLOR_MAP[notification.type]}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start sm:items-center justify-between mb-1 gap-2">
                        <h3 className={`font-bold text-sm sm:text-base ${!notification.read ? 'text-stone-900' : 'text-stone-700'}`}>
                          {notification.title}
                        </h3>
                        <span className="text-xs text-stone-400 font-medium whitespace-nowrap flex-shrink-0">{notification.time}</span>
                      </div>
                      <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                        {notification.message}
                      </p>
                      {notification.link && (
                        <div className="mt-2 sm:mt-3 flex items-center text-xs font-bold text-emerald-600 group-hover:translate-x-1 transition-transform">
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
