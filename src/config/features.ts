// Feature flags configuration
// All flags default to false unless explicitly enabled

import { env } from '@/config/env';

type FeatureFlags = {
  showTestIframe: boolean;
  // Add more feature flags here as needed
};

// Check environment variables first, then fall back to defaults
const features: FeatureFlags = {
  showTestIframe: env.NEXT_PUBLIC_SHOW_TEST_IFRAME === 'true',
};

// Optional: Runtime override function (use carefully!)
export const overrideFeature = (feature: keyof FeatureFlags, value: boolean) => {
  if (env.NODE_ENV !== 'production') {
    features[feature] = value;
  }
};

export const isFeatureEnabled = (feature: keyof FeatureFlags): boolean => {
  return features[feature];
}; 