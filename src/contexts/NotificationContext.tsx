import React, { createContext, useContext, useState, useEffect } from 'react';
import { Bell, MessageSquare, Briefcase, Star } from 'lucide-react';
import { useAuth } from './AuthContext';
import { getFamilyNotifications, getAgencyNotifications, getNannyNotifications } from '../lib/api';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

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
          }
        } catch (error) {
          console.error('Error loading family notifications:', error);
        }
      } else if (role === 'agency_admin' || role === 'agency_recruiter') {
        try {
          let agencyId = user.uid;
          if (role === 'agency_recruiter') {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            agencyId = userDoc.exists() ? (userDoc.data().agency_id || '') : '';
          }

          if (!agencyId) {
            setNotifications([]);
            return;
          }

          const agencyNotifs = await getAgencyNotifications(agencyId);
          if (agencyNotifs?.length) {
            setNotifications(agencyNotifs.map((notif) => ({
              id: notif.id || createNotificationId(),
              type: notif.type,
              title: notif.title,
              message: notif.message,
              time: notif.created_at ? new Date(notif.created_at.toDate ? notif.created_at.toDate() : notif.created_at).toLocaleString() : 'Just now',
              read: notif.read ?? false,
              link: notif.link
            })));
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
      }
    };
    loadNotifications();
  }, [role, user]);

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
