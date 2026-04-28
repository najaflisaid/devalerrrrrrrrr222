import React from 'react';
import LegalManagementTab from './LegalManagementTab';
import { DEFAULT_PRIVACY_POLICY } from '../../services/contentService';

const PrivacyPolicyTab: React.FC = () => (
  <LegalManagementTab
    docId="privacy_policy"
    defaultData={DEFAULT_PRIVACY_POLICY}
    pageTitle="Məxfilik Siyasəti"
    pagePath="/privacy-policy"
    testIdPrefix="privacy"
  />
);

export default PrivacyPolicyTab;
