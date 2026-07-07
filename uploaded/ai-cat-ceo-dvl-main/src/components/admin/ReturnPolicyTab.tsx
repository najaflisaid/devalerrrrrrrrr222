import React from 'react';
import LegalManagementTab from './LegalManagementTab';
import { DEFAULT_RETURN_POLICY } from '../../services/contentService';

const ReturnPolicyTab: React.FC = () => (
  <LegalManagementTab
    docId="return_policy"
    defaultData={DEFAULT_RETURN_POLICY}
    pageTitle="Qaytarılma Şərtləri"
    pagePath="/return-policy"
    testIdPrefix="return"
  />
);

export default ReturnPolicyTab;
