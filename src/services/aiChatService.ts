/**
 * De Valeur AI – frontend chat service.
 *
 * Calls /api/chat Vercel serverless function which proxies to OpenAI.
 * The persona / catalog / knowledge-base prompt logic lives server-side.
 */

export interface ChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatProductLite {
  id: string;
  name: string;
  brand?: string;
  category?: string;
  gender?: string;
  price?: number | null;
  salePrice?: number | null;
  stock?: number | null;
  isBestseller?: boolean;
  description?: string;
}

export interface ChatKnowledgeLite {
  aiInstructions?: string;
  companyInfo?: string;
  brandsInfo?: string;
  policiesInfo?: string;
  productsInfo?: string;
  additionalNotes?: string;
}

export interface ChatRequest {
  message: string;
  history: ChatHistoryItem[];
  products: ChatProductLite[];
  knowledge?: ChatKnowledgeLite | null;
  language?: 'az' | 'ru' | 'en';
  sessionId?: string;
  contactCaptured?: boolean;
}

export const sendChatMessage = async (req: ChatRequest): Promise<string> => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: req.message.trim(),
        history: req.history || [],
        products: req.products || [],
        knowledge: req.knowledge || null,
        language: req.language || 'az',
        contactCaptured: !!req.contactCaptured,
      }),
      signal: ctrl.signal,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error || `Server xətası: ${res.status}`);
    }

    const data = await res.json();
    const reply = (data?.reply || '').trim();
    return reply || 'Bağışlayın, cavab yarana bilmədi.';
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('AI cavabı gecikdi. Yenidən cəhd edin.');
    }
    throw new Error(err?.message || 'AI ilə əlaqə qurula bilmədi.');
  } finally {
    clearTimeout(timer);
  }
};
