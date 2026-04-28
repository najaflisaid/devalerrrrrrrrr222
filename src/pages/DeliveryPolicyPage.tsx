import React from 'react';
import LegalAccordionPage from './LegalAccordionPage';
import { DEFAULT_DELIVERY_POLICY } from '../services/contentService';

const DeliveryPolicyPage: React.FC = () => (
  <LegalAccordionPage
    docId="delivery_policy"
    defaultData={DEFAULT_DELIVERY_POLICY}
    breadcrumbLabel="Çatdırılma Şərtləri"
    testIdPrefix="delivery-policy"
  />
);

export default DeliveryPolicyPage;
