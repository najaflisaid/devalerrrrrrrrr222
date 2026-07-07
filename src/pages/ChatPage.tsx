import React, { useEffect } from 'react';
import AiChatWidget from '../components/AiChatWidget';

/**
 * ConsultantPage — /consultant və /chat deep-link route.
 *
 * Bu səhifə tam ekran AI konsultant söhbətini göstərir.
 * Instagram/WhatsApp/Bio linklərindən birbaşa buraya yönləndirilə bilər:
 *   https://devaleur.az/consultant
 *
 * `embedded` mode-da AiChatWidget avtomatik açıq və full-screen olur.
 */
const ChatPage: React.FC = () => {
  useEffect(() => {
    // Ensure header/footer scroll doesn't leak through
    document.title = 'De Valeur Konsultant';
  }, []);

  return (
    <div className="fixed inset-0 z-[9997] bg-white" data-testid="consultant-page">
      <AiChatWidget embedded />
    </div>
  );
};

export default ChatPage;
