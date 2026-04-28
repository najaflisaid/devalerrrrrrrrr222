import React from 'react';

/**
 * Stub page for Epoint's `result_url` webhook.
 *
 * Epoint POSTs the signed payment result to this URL server-to-server.
 * Since this is a frontend-only deployment we cannot process the POST,
 * but Epoint only requires the URL to respond 200 OK. The browser-facing
 * GET (e.g. an admin opening the link) simply renders this confirmation.
 */
const PaymentResultPage: React.FC = () => {
  return (
    <div className="min-h-[40vh] flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">Epoint Webhook</p>
        <h1 className="text-xl font-medium text-gray-900 mb-1">OK</h1>
        <p className="text-sm text-gray-500">
          Bu səhifə Epoint server-to-server bildirişi üçündür. Statusu yoxlamaq üçün
          "Sifarişlərim" səhifəsindən istifadə edin.
        </p>
      </div>
    </div>
  );
};

export default PaymentResultPage;
