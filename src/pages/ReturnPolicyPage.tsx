import React from 'react';
import LegalAccordionPage from './LegalAccordionPage';
import { DEFAULT_RETURN_POLICY } from '../services/contentService';

const ReturnPolicyPage: React.FC = () => (
  <LegalAccordionPage
    docId="return_policy"
    defaultData={DEFAULT_RETURN_POLICY}
    breadcrumbLabel="Qaytarılma Şərtləri"
    testIdPrefix="return-policy"
  />
);

export default ReturnPolicyPage;
