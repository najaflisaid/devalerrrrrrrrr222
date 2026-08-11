/**
 * Telegram bildirişləri — müştəri söhbəti ilə bağlı hadisələri Telegram qrupuna
 * göndərmək üçün. Bot token və chat_id SERVER tərəfdə (env) saxlanılır; burada
 * yalnız hadisə tipi göndərilir. Uğursuzluq səssiz keçir (chat axınını pozmur).
 */

const post = (payload: Record<string, any>): void => {
  try {
    fetch('/api/telegram/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* ignore */
  }
};

export const notifyNewChat = (code: string, firstMessage?: string): void => {
  post({ type: 'new_session', code, message: firstMessage || '' });
};

export const notifyContact = (code: string, phone: string, name?: string): void => {
  post({ type: 'contact', code, phone, name: name || '' });
};
