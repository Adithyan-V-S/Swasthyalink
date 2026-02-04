import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToNotifications, markNotificationAsRead, NOTIFICATION_TYPES } from '../services/notificationService';
import { useNavigate } from 'react-router-dom';

const NotificationToast = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [toasts, setToasts] = useState([]);
  const [lastNotificationTime, setLastNotificationTime] = useState(Date.now());

  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = subscribeToNotifications(currentUser.uid, (notifications) => {
      // Only show toasts for new notifications (created after component mount)
      const newNotifications = notifications.filter(notification => {
        const notificationTime = notification.createdAt?.getTime?.() ||
          notification.createdAt?.toDate?.()?.getTime?.() ||
          new Date(notification.createdAt).getTime();
        return notificationTime > lastNotificationTime && !notification.read;
      });

      // Add new notifications as toasts
      newNotifications.forEach(notification => {
        addToast(notification);
      });
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentUser, lastNotificationTime]);

  const addToast = (notification) => {
    const toastId = `toast-${notification.id}-${Date.now()}`;
    const toast = {
      id: toastId,
      notification,
      timestamp: Date.now()
    };

    setToasts(prev => [...prev, toast]);

    // Auto-remove toast after 5 seconds
    setTimeout(() => {
      removeToast(toastId);
    }, 5000);
  };

  const removeToast = (toastId) => {
    setToasts(prev => prev.filter(toast => toast.id !== toastId));
  };

  const handleToastClick = async (toast) => {
    const { notification } = toast;

    // Mark as read
    if (!notification.read) {
      await markNotificationAsRead(notification.id);
    }

    // Navigate based on notification type
    switch (notification.type) {
      case NOTIFICATION_TYPES.FAMILY_REQUEST:
        localStorage.setItem('familyDashboardTab', '1');
        navigate('/familydashboard');
        break;

      case NOTIFICATION_TYPES.FAMILY_REQUEST_ACCEPTED:
      case NOTIFICATION_TYPES.FAMILY_REQUEST_REJECTED:
        localStorage.setItem('familyDashboardTab', '2');
        navigate('/familydashboard');
        break;

      case NOTIFICATION_TYPES.CHAT_MESSAGE:
        localStorage.setItem('familyDashboardTab', '3');
        if (notification.data?.conversationId) {
          localStorage.setItem('openConversationId', notification.data.conversationId);
        }
        navigate('/familydashboard');
        break;

      case NOTIFICATION_TYPES.EMERGENCY_ALERT:
        localStorage.setItem('familyDashboardTab', '0');
        navigate('/familydashboard');
        break;

      default:
        navigate('/familydashboard');
        break;
    }

    removeToast(toast.id);
  };

  const getToastIcon = (type) => {
    switch (type) {
      case NOTIFICATION_TYPES.FAMILY_REQUEST:
        return '👥';
      case NOTIFICATION_TYPES.FAMILY_REQUEST_ACCEPTED:
        return '✅';
      case NOTIFICATION_TYPES.FAMILY_REQUEST_REJECTED:
        return '❌';
      case NOTIFICATION_TYPES.CHAT_MESSAGE:
        return '💬';
      case NOTIFICATION_TYPES.EMERGENCY_ALERT:
        return '🚨';
      default:
        return '🔔';
    }
  };

  const getToastColor = (type) => {
    switch (type) {
      case NOTIFICATION_TYPES.FAMILY_REQUEST:
        return 'bg-blue-500';
      case NOTIFICATION_TYPES.FAMILY_REQUEST_ACCEPTED:
        return 'bg-green-500';
      case NOTIFICATION_TYPES.FAMILY_REQUEST_REJECTED:
        return 'bg-red-500';
      case NOTIFICATION_TYPES.CHAT_MESSAGE:
        return 'bg-indigo-500';
      case NOTIFICATION_TYPES.EMERGENCY_ALERT:
        return 'bg-red-600';
      default:
        return 'bg-gray-500';
    }
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${getToastColor(toast.notification.type)} text-white p-4 rounded-lg shadow-lg max-w-sm cursor-pointer transform transition-all duration-300 hover:scale-105`}
          onClick={() => handleToastClick(toast)}
        >
          <div className="flex items-start space-x-3">
            <span className="text-2xl flex-shrink-0">
              {getToastIcon(toast.notification.type)}
            </span>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm truncate">
                {toast.notification.title}
              </h4>
              <p className="text-sm opacity-90 mt-1 line-clamp-2">
                {toast.notification.message}
              </p>
              <p className="text-xs opacity-75 mt-2">
                Click to view
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                removeToast(toast.id);
              }}
              className="text-white/70 hover:text-white text-2xl leading-none flex-shrink-0 p-1 rounded hover:bg-white/20 transition-colors relative z-10"
              aria-label="Close notification"
              type="button"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default NotificationToast;