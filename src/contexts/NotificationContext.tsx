import React, { createContext, useContext, useState, useEffect } from 'react';
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

  useEffect(() => {
    const loadNotifications = async () => {
      if (!user?.uid) return;

      if (role === 'family') {
        try {
          const familyNotifs = await getFamilyNotifications(user.uid);
          if (familyNotifs?.length) {
            setNotifications(familyNotifs.map((notif) => ({
              id: notif.id || createNotificationId(),
              type: notif.type,
              title: notif.title,
              message: notif.message,
              time: notif.created_at ? new Date(notif.created_at.toDate ? notif.created_at.toDate() : notif.created_at).toLocaleString() : 'Just now',
              read: notif.read ?? false,
              link: notif.link
            })));
          } else {
            setNotifications([]);
          }
        } catch (error) {
          console.error('Error loading family notifications:', error);
          setNotifications([]);
        }
      } else if (role === 'agency_admin' || role === 'agency_recruiter') {
        try {
          const agencyIds = await resolveAgencyIdsForUser(user.uid);
          if (agencyIds.length === 0) {
            setNotifications([]);
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

            setNotifications(normalized);
          } else {
            setNotifications([]);
          }
        } catch (error) {
          console.error('Error loading agency notifications:', error);
        }
      } else if (role === 'nanny') {
        try {
          const nannyNotifs = await getNannyNotifications(user.uid);
          if (nannyNotifs?.length) {
            setNotifications(nannyNotifs.map((notif) => ({
              id: notif.id || createNotificationId(),
              type: notif.type,
              title: notif.title,
              message: notif.message,
              time: notif.created_at ? new Date(notif.created_at.toDate ? notif.created_at.toDate() : notif.created_at).toLocaleString() : 'Just now',
              read: notif.read ?? false,
              link: notif.link
            })));
          } else {
            setNotifications([]);
          }
        } catch (error) {
          console.error('Error loading nanny notifications:', error);
        }
      } else if (role === 'superadmin') {
        try {
          const adminNotifs = await getAdminNotifications(user.uid);
          if (adminNotifs?.length) {
            setNotifications(adminNotifs.map((notif) => ({
              id: notif.id || createNotificationId(),
              type: notif.type,
              title: notif.title,
              message: notif.message,
              time: notif.created_at ? new Date(notif.created_at.toDate ? notif.created_at.toDate() : notif.created_at).toLocaleString() : 'Just now',
              read: notif.read ?? false,
              link: notif.link,
            })));
          } else {
            setNotifications([]);
          }
        } catch (error) {
          console.error('Error loading admin notifications:', error);
        }
      }
    };
    loadNotifications();
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
