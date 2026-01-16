import React, { useEffect } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SuccessNotificationProps {
  message: string;
  onClose: () => void;
  duration?: number;
  type?: 'success' | 'error';
}

const SuccessNotification: React.FC<SuccessNotificationProps> = ({
  message,
  onClose,
  duration = 2000,
  type = 'success'
}) => {
  const { t } = useTranslation();

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const isError = type === 'error';
  const bgColor = isError ? 'bg-red-500' : 'bg-green-500';
  const title = isError ? t('common.error') : t('common.success');
  const Icon = isError ? XCircle : CheckCircle;

  return (
    <div className="animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full transform animate-scaleIn">
        <div className="flex items-start space-x-4">
          <div className="relative flex-shrink-0">
            <div className={`absolute inset-0 ${bgColor} rounded-full animate-ping opacity-20`}></div>
            <div className={`relative ${bgColor} rounded-full p-3`}>
              <Icon className="h-6 w-6 text-white" />
            </div>
          </div>

          <div className="flex-1 pt-0.5">
            <h3 className="text-base font-semibold text-gray-900 mb-1">
              {title}
            </h3>
            <p className="text-sm text-gray-600">
              {message}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuccessNotification;
