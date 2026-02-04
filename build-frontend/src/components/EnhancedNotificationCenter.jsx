import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
// Using real Firebase notification services
import {
  subscribeToNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getNotificationIcon,
  getNotificationColor,
  formatNotificationTime,
  NOTIFICATION_TYPES
} from '../services/notificationService';

const EnhancedNotificationCenter = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'unread', 'family', 'chat', 'emergency'
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToNotifications(currentUser.uid, (notifs) => {
      setNotifications(notifs);
      setLoading(false);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentUser]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter(n => !n.read && !n.deleted).length;

  const filteredNotifications = notifications.filter(notification => {
    if (activeTab === 'all') return true;
    if (activeTab === 'unread') return !notification.read;
    if (activeTab === 'family') return notification.type.includes('family');
    if (activeTab === 'chat') return notification.type === NOTIFICATION_TYPES.CHAT_MESSAGE;
    if (activeTab === 'emergency') return notification.type === NOTIFICATION_TYPES.EMERGENCY_ALERT;
    return true;
  });

  const handleNotificationClick = async (notification) => {
    // Mark as read if not already read
    if (!notification.read) {
      await markNotificationAsRead(notification.id);
    }

    // Navigate based on notification type
    switch (notification.type) {
      case NOTIFICATION_TYPES.FAMILY_REQUEST:
        navigate('/familydashboard');
        // Set active tab to family requests
        localStorage.setItem('familyDashboardTab', '1');
        break;

      case NOTIFICATION_TYPES.FAMILY_REQUEST_ACCEPTED:
      case NOTIFICATION_TYPES.FAMILY_REQUEST_REJECTED:
        navigate('/familydashboard');
        // Set active tab to family network
        localStorage.setItem('familyDashboardTab', '2');
        break;

      case NOTIFICATION_TYPES.CHAT_MESSAGE:
        navigate('/familydashboard');
        // Set active tab to family chat and open conversation
        localStorage.setItem('familyDashboardTab', '3');
        if (notification.data?.conversationId) {
          localStorage.setItem('openConversationId', notification.data.conversationId);
        }
        // Also set a flag to indicate this is a chat notification
        localStorage.setItem('openFamilyChat', 'true');
        break;

      case NOTIFICATION_TYPES.DOCTOR_CONNECTION_REQUEST:
        navigate('/patientdashboard');
        // Set active tab to doctors section
        localStorage.setItem('patientDashboardTab', 'doctors');
        break;

      case NOTIFICATION_TYPES.CONNECTION_ACCEPTED:
        navigate('/patientdashboard');
        // Set active tab to doctors section
        localStorage.setItem('patientDashboardTab', 'doctors');
        break;

      case NOTIFICATION_TYPES.PRESCRIPTION_RECEIVED:
        navigate('/patientdashboard');
        // Set active tab to prescriptions section
        localStorage.setItem('patientDashboardTab', 'prescriptions');
        break;

      case NOTIFICATION_TYPES.EMERGENCY_ALERT:
        navigate('/familydashboard');
        // Set active tab to overview for emergency
        localStorage.setItem('familyDashboardTab', '0');
        break;

      default:
        navigate('/familydashboard');
        break;
    }

    setIsOpen(false);
  };

  const handleMarkAllAsRead = async () => {
    setLoading(true);
    await markAllNotificationsAsRead(currentUser.uid);
    setLoading(false);
  };

  const handleDeleteNotification = async (notificationId, event) => {
    event.stopPropagation();

    // Optimistic UI update: remove from local state immediately
    setNotifications(prev => prev.filter(n => n.id !== notificationId));

    try {
      await deleteNotification(notificationId);
    } catch (error) {
      console.error('Failed to delete notification on backend:', error);
      // Optional: rollback or show error toast if needed
    }
  };

  const getTabCount = (tab) => {
    switch (tab) {
      case 'unread':
        return notifications.filter(n => !n.read).length;
      case 'family':
        return notifications.filter(n => n.type.includes('family')).length;
      case 'chat':
        return notifications.filter(n => n.type === NOTIFICATION_TYPES.CHAT_MESSAGE).length;
      case 'emergency':
        return notifications.filter(n => n.type === NOTIFICATION_TYPES.EMERGENCY_ALERT).length;
      default:
        return notifications.length;
    }
  };

  const renderNotification = (notification) => {
    const icon = getNotificationIcon(notification.type);
    const colorClasses = getNotificationColor(notification.priority);
    const timeAgo = formatNotificationTime(notification.timestamp);

    return (
      <div
        key={notification.id}
        onClick={() => handleNotificationClick(notification)}
        className={`p-5 cursor-pointer hover:bg-gray-50 transition-colors rounded-lg mx-2 my-2 ${!notification.read ? 'bg-blue-50 border-l-4 border-blue-500' : 'bg-white border border-gray-100'
          }`}
      >
        <div className="flex items-start space-x-4">
          <div className={`flex-shrink-0 p-3 rounded-full ${colorClasses}`}>
            <span className="material-icons text-lg">{icon}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <h4 className={`text-base font-semibold leading-tight ${!notification.read ? 'text-gray-900' : 'text-gray-700'}`}>
                {notification.title}
              </h4>
              <div className="flex items-center space-x-2 ml-3 flex-shrink-0">
                <span className="text-sm text-gray-500 font-medium">{timeAgo}</span>
                {!notification.read && (
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                )}
              </div>
            </div>

            <p className="text-base text-gray-600 mt-2 leading-relaxed break-words">
              {notification.message}
            </p>

            {notification.priority === 'urgent' && (
              <div className="mt-3">
                <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-bold bg-red-100 text-red-800 border border-red-200 animate-pulse">
                  <span className="material-icons text-sm mr-2">priority_high</span>
                  URGENT
                </span>
              </div>
            )}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handleDeleteNotification(notification.id, e);
            }}
            className="flex-shrink-0 p-2 text-gray-400 hover:text-red-500 transition-colors rounded-full hover:bg-red-50 relative z-10"
            title="Delete notification"
            type="button"
            aria-label="Delete notification"
          >
            <span className="text-xl font-bold">×</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-3 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
        aria-label="Notifications"
      >
        <span className="material-icons text-2xl">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-sm rounded-full w-7 h-7 flex items-center justify-center font-bold animate-pulse shadow-lg">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[450px] bg-white rounded-xl shadow-2xl border border-gray-200 z-50 h-[600px] flex flex-col transform transition-all duration-200 ease-out">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-blue-50">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Notifications</h3>
              <div className="flex items-center space-x-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    disabled={loading}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-gray-500 hover:text-gray-700 rounded"
                >
                  <span className="material-icons text-sm">close</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tabs - Fixed at top */}
          <div className="flex border-b border-gray-200 bg-gray-50 flex-shrink-0 overflow-x-auto">
            {[
              { key: 'emergency', label: 'Emergency', icon: 'emergency' },
              { key: 'all', label: 'All', icon: 'notifications' },
              { key: 'unread', label: 'Unread', icon: 'mark_email_unread' },
              { key: 'family', label: 'Family', icon: 'people' },
              { key: 'chat', label: 'Chat', icon: 'chat' }
            ].map(tab => {
              const count = getTabCount(tab.key);
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors relative whitespace-nowrap ${activeTab === tab.key
                    ? 'text-indigo-600 border-b-2 border-indigo-500 bg-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                >
                  <div className="flex items-center justify-center space-x-1">
                    <span className="material-icons text-sm">{tab.icon}</span>
                    <span>{tab.label}</span>
                    {count > 0 && (
                      <span className="bg-red-500 text-white text-xs rounded-full px-1.5 min-w-[18px] h-5 flex items-center justify-center font-bold">
                        {count > 9 ? '9+' : count}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Notifications List - Fixed height with independent scrolling */}
          <div className="flex-1 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="text-gray-600 text-sm mt-2">Loading notifications...</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-gray-400 mb-2">
                  <span className="material-icons text-4xl">notifications_none</span>
                </div>
                <p className="text-gray-600 text-sm">
                  {activeTab === 'unread' ? 'No unread notifications' : 'No notifications'}
                </p>
              </div>
            ) : (
              <div className="h-full overflow-y-auto">
                <div className="space-y-1 p-2">
                  {filteredNotifications.map(renderNotification)}
                </div>
              </div>
            )}
          </div>

          {/* Footer - Fixed at bottom */}
          {filteredNotifications.length > 0 && (
            <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex-shrink-0">
              <button
                onClick={() => {
                  navigate('/familydashboard');
                  setIsOpen(false);
                }}
                className="w-full text-center text-sm text-indigo-600 hover:text-indigo-800 font-medium py-2 px-4 rounded-lg hover:bg-indigo-50 transition-colors"
              >
                View all in dashboard
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EnhancedNotificationCenter;