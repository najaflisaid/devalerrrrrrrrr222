import React from 'react';
import LegalAccordionPage from './LegalAccordionPage';
import { DEFAULT_PRIVACY_POLICY } from '../services/contentService';

const PrivacyPolicyPage: React.FC = () => (
  <LegalAccordionPage
    docId="privacy_policy"
    defaultData={DEFAULT_PRIVACY_POLICY}
    breadcrumbLabel="Məxfilik Siyasəti"
    testIdPrefix="privacy-policy"
  />
);

export default PrivacyPolicyPage;
