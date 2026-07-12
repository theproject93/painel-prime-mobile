import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { PrimeLogoLoader } from '../src/components/PrimeLogoLoader';

export default function RootIndex() {
  const { user, loading } = useAuth();

  if (loading) {
    return <PrimeLogoLoader variant="fullscreen" label="Abrindo o Painel Prime" />;
  }

  if (user) {
    return <Redirect href="/dashboard" />;
  }

  return <Redirect href="/landing" />;
}

