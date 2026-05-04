import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Bell, MessageSquare, Briefcase, Star } from 'lucide-react';
import { useAuth } from './AuthContext';
import {
  getFamilyNotifications,
  getAgencyNotifications,
  getNannyNotifications,
  getAdminNotifications,
  resolveAgencyIdsForUser,
  registerPushTokenForCurrentUser,
} from '../lib/api';
import { getBrowserFcmToken } from '../lib/push';

export type NotificationType = 'application' | 'message' | 'review' | 'system';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  time: string;
  read: boolean;
  link?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'time' | 'read'>) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, role } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const previousSignatureRef = useRef<string>('');

  const createNotificationId = () => {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
    return `notif-${Date.now()}`;
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const toMillis = (value: any): number => {
    if (!value) return 0;
    if (typeof value?.toDate === 'function') return value.toDate().getTime();
    if (typeof value?.seconds === 'number') return value.seconds * 1000;
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  useEffect(() => {
    let cancelled = false;

    const loadNotifications = async () => {
      if (!user?.uid) return;

      const applyAndBroadcast = (items: Notification[], signatureSource: any[]) => {
        if (cancelled) return;

        const signature = signatureSource
          .slice(0, 20)
          .map((item) => `${String(item?.id || '')}:${toMillis(item?.created_at)}:${item?.read ? '1' : '0'}`)
          .join('|');

        if (previousSignatureRef.current && previousSignatureRef.current !== signature) {
          window.dispatchEvent(new CustomEvent('shub:workflow-refresh', {
            detail: { role, source: 'notifications' },
          }));
        }
        previousSignatureRef.current = signature;
        setNotifications(items);
      };

      if (role === 'family') {
        try {
          const familyNotifs = await getFamilyNotifications(user.uid);
          if (familyNotifs?.length) {
            const mapped = familyNotifs.map((notif) => ({
              id: notif.id || createNotificationId(),
              type: notif.type,
              title: notif.title,
              message: notif.message,
              time: notif.created_at ? new Date(notif.created_at.toDate ? notif.created_at.toDate() : notif.created_at).toLocaleString() : 'Just now',
              read: notif.read ?? false,
              link: notif.link
            }));
            applyAndBroadcast(mapped, familyNotifs);
          } else {
            applyAndBroadcast([], []);
          }
        } catch (error) {
          console.error('Error loading family notifications:', error);
          if (!cancelled) setNotifications([]);
        }
      } else if (role === 'agency_admin' || role === 'agency_recruiter') {
        try {
          const agencyIds = await resolveAgencyIdsForUser(user.uid);
          if (agencyIds.length === 0) {
            applyAndBroadcast([], []);
            return;
          }

          const groupedNotifs = await Promise.all(agencyIds.map((agencyId) => getAgencyNotifications(agencyId)));
          const allAgencyNotifs = groupedNotifs.flat().filter(Boolean);
          const uniqueNotifs = new Map<string, any>();
          allAgencyNotifs.forEach((notif) => {
            if (!notif?.id) return;
            uniqueNotifs.set(notif.id, notif);
          });

          const agencyNotifs = Array.from(uniqueNotifs.values());
          if (agencyNotifs.length) {
            const normalized = agencyNotifs.map((notif) => ({
              id: notif.id || createNotificationId(),
              type: notif.type,
              title: notif.title,
              message: notif.message,
              time: notif.created_at ? new Date(notif.created_at.toDate ? notif.created_at.toDate() : notif.created_at).toLocaleString() : 'Just now',
              read: notif.read ?? false,
              link: notif.link
            }));

            normalized.sort((a, b) => {
              const aTs = new Date(a.time).getTime();
              const bTs = new Date(b.time).getTime();
              return (Number.isNaN(bTs) ? 0 : bTs) - (Number.isNaN(aTs) ? 0 : aTs);
            });

            applyAndBroadcast(normalized, agencyNotifs);
          } else {
            applyAndBroadcast([], []);
          }
        } catch (error) {
          console.error('Error loading agency notifications:', error);
          if (!cancelled) setNotifications([]);
        }
      } else if (role === 'nanny') {
        try {
          const nannyNotifs = await getNannyNotifications(user.uid);
          if (nannyNotifs?.length) {
            const mapped = nannyNotifs.map((notif) => ({
              id: notif.id || createNotificationId(),
              type: notif.type,
              title: notif.title,
              message: notif.message,
              time: notif.created_at ? new Date(notif.created_at.toDate ? notif.created_at.toDate() : notif.created_at).toLocaleString() : 'Just now',
              read: notif.read ?? false,
              link: notif.link
            }));
            applyAndBroadcast(mapped, nannyNotifs);
          } else {
            applyAndBroadcast([], []);
          }
        } catch (error) {
          console.error('Error loading nanny notifications:', error);
          if (!cancelled) setNotifications([]);
        }
      } else if (role === 'superadmin') {
        try {
          const adminNotifs = await getAdminNotifications(user.uid);
          if (adminNotifs?.length) {
            const mapped = adminNotifs.map((notif) => ({
              id: notif.id || createNotificationId(),
              type: notif.type,
              title: notif.title,
              message: notif.message,
              time: notif.created_at ? new Date(notif.created_at.toDate ? notif.created_at.toDate() : notif.created_at).toLocaleString() : 'Just now',
              read: notif.read ?? false,
              link: notif.link,
            }));
            applyAndBroadcast(mapped, adminNotifs);
          } else {
            applyAndBroadcast([], []);
          }
        } catch (error) {
          console.error('Error loading admin notifications:', error);
          if (!cancelled) setNotifications([]);
        }
      }
    };
    void loadNotifications();

    const timer = window.setInterval(() => {
      void loadNotifications();
    }, 30_000);

    const onFocus = () => {
      void loadNotifications();
    };

    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [role, user]);

  useEffect(() => {
    const shouldRegisterPush =
      !!user?.uid
      && (role === 'nanny'
      || role === 'family'
      || role === 'agency'
      || role === 'agency_admin'
      || role === 'agency_recruiter');

    if (!shouldRegisterPush) return;

    let cancelled = false;

    const registerPushToken = async () => {
      try {
        const token = await getBrowserFcmToken();
        if (!token || cancelled || !user?.uid || !role) return;

        await registerPushTokenForCurrentUser({
          role,
          userId: user.uid,
          token,
          deviceName: navigator.platform || 'Web Browser',
          os: navigator.userAgent || 'Web',
          appVersion: 'web',
        });
      } catch (error) {
        console.warn('[push] registration skipped:', error);
      }
    };

    void registerPushToken();

    return () => {
      cancelled = true;
    };
  }, [role, user?.uid]);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const addNotification = (notification: Omit<Notification, 'id' | 'time' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: createNotificationId(),
      time: 'Just now',
      read: false
    };
    setNotifications(prev => [newNotification, ...prev]);
  };

  return (
    <NotificationContext.Provider value={{ 
      notifications, 
      unreadCount, 
      markAsRead, 
      markAllAsRead, 
      removeNotification,
      addNotification
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
