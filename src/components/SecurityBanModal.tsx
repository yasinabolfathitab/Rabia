import React from 'react';
import { User } from '../types';

interface SecurityBanModalProps {
  user: User | null;
  reason?: string;
  onAcknowledge?: () => void;
}

export const SecurityBanModal: React.FC<SecurityBanModalProps> = () => {
  return null;
};
