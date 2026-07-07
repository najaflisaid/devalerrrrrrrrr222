import React from 'react';
import LegalManagementTab from './LegalManagementTab';
import { DEFAULT_DELIVERY_POLICY } from '../../services/contentService';

const DeliveryPolicyTab: React.FC = () => (
  <LegalManagementTab
    docId="delivery_policy"
    defaultData={DEFAULT_DELIVERY_POLICY}
    pageTitle="Çatdırılma Şərtləri"
    pagePath="/delivery"
    testIdPrefix="delivery"
  />
);

export default DeliveryPolicyTab;
