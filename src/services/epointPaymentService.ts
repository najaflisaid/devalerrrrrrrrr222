/**
 * Service to start an Epoint payment via the FastAPI backend.
 */
const BACKEND_URL =
  (import.meta as any).env?.VITE_BACKEND_URL ||
  (import.meta as any).env?.REACT_APP_BACKEND_URL ||
  '';

export interface CreatePaymentInput {
  order_id: string;
  amount: number;
  currency?: string;
  language?: string;
  description?: string;
}

export interface CreatePaymentResponse {
  redirect_url: string;
  transaction?: string;
}

export const createEpointPayment = async (
  input: CreatePaymentInput
): Promise<CreatePaymentResponse> => {
  const response = await fetch(`${BACKEND_URL}/api/epoint/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      currency: 'AZN',
      language: 'az',
      description: 'DE VALEUR sifariş ödənişi',
      ...input,
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Epoint xətası (${response.status})`);
  }
  return response.json();
};

export const verifyEpointPayload = async (params: {
  data: string;
  signature: string;
}): Promise<{
  verified: boolean;
  order_id?: string;
  status?: string;
  code?: string;
  amount?: string;
  transaction?: string;
}> => {
  const response = await fetch(`${BACKEND_URL}/api/epoint/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Doğrulama xətası (${response.status})`);
  }
  return response.json();
};
