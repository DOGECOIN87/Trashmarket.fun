/**
 * Toast Notification Component
 *
 * Reads from the Zustand notification store and renders
 * toast-style notifications in the bottom-right corner.
 */

import React from 'react';
import { X, CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react';
import { useNotificationStore } from '../stores/useAppStore';

const iconMap = {
  success: <CheckCircle2 className="w-5 h-5 text-magic-green flex-shrink-0" />,
  error: <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />,
  warning: <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />,
  info: <Info className="w-5 h-5 text-blue-400 flex-shrink-0" />,
};

const borderMap = {
  success: 'border-magic-green/30',
  error: 'border-red-500/30',
  warning: 'border-yellow-500/30',
  info: 'border-blue-400/30',
};

const Notifications: React.FC = () => {
  const { notifications, removeNotification } = useNotificationStore();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`pointer-events-auto bg-black/95 border ${borderMap[notification.type]} backdrop-blur-sm p-4 shadow-lg animate-in slide-in-from-right duration-300`}
        >
          <div className="flex items-start gap-3">
            {iconMap[notification.type]}
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-bold uppercase tracking-wider">
                {notification.title}
              </p>
              <p className="text-gray-400 text-xs mt-1 break-words">
                {notification.message}
              </p>
              {notification.txSignature && (
                <a
                  href={`https://trashscan.io/tx/${notification.txSignature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-magic-green text-[10px] font-mono mt-1 hover:underline block"
                >
                  View TX: {notification.txSignature.slice(0, 12)}...
                </a>
              )}
            </div>
            <button
              onClick={() => removeNotification(notification.id)}
              className="text-gray-600 hover:text-white transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Notifications;
