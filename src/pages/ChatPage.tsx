import React, { useEffect } from 'react';

/**
 * ChatPage — /chat deep link route.
 *
 * When user navigates directly to /chat (e.g., from a shared link, notification,
 * or marketing email), this page opens the AI chat widget automatically after
 * a brief delay to allow the widget to mount.
 */
const ChatPage: React.FC = () => {
  useEffect(() => {
    // Trigger the global event that AiChatWidget listens for
    const timer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('dv:open-chat'));
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Placeholder while chat opens — minimal, centered
  return (
    <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
      <p className="text-gray-400 text-sm">AI söhbət açılır...</p>
    </div>
  );
};

export default ChatPage;
