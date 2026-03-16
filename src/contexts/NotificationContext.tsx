import React, { createContext, useContext, useState, useEffect } from 'react';
import { Bell, MessageSquare, Briefcase, Star } from 'lucide-react';

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
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'application',
      title: 'Application Update',
      message: 'Your application for "Full-time Nanny in Brooklyn" has been reviewed.',
      time: '2 hours ago',
      read: false,
      link: '/nanny/applications'
    },
    {
      id: '2',
      type: 'message',
      title: 'New Message',
      message: 'The Johnson Family sent you a message.',
      time: '5 hours ago',
      read: false,
      link: '/nanny/messages'
    },
    {
      id: '3',
      type: 'review',
      title: 'New Review',
      message: 'You received a 5-star review from the Smith Family.',
      time: '1 day ago',
      read: true,
      link: '/nanny/profile'
    }
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const addNotification = (notification: Omit<Notification, 'id' | 'time' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Math.random().toString(36).substr(2, 9),
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
