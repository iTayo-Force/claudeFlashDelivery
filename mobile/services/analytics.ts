/**
 * Analytics service for Flash Delivery.
 *
 * Provides a provider-agnostic tracking API.
 * In production, swap the implementation to use a real provider
 * (e.g., Amplitude, Mixpanel, Firebase Analytics, PostHog).
 */

type EventProperties = Record<string, string | number | boolean | undefined>;

let userId: string | null = null;
let userProperties: Record<string, string> = {};

const eventQueue: { name: string; properties: EventProperties; timestamp: number }[] = [];

/**
 * Initialize analytics with user identification.
 */
export function identify(id: string, properties?: Record<string, string>) {
  userId = id;
  if (properties) {
    userProperties = { ...userProperties, ...properties };
  }
  if (__DEV__) {
    console.log('[Analytics] Identify:', id, properties);
  }
}

/**
 * Reset user identity (on logout).
 */
export function reset() {
  userId = null;
  userProperties = {};
  if (__DEV__) {
    console.log('[Analytics] Reset');
  }
}

/**
 * Track an event with optional properties.
 */
export function track(eventName: string, properties?: EventProperties) {
  const event = {
    name: eventName,
    properties: {
      ...properties,
      userId: userId || undefined,
      ...userProperties,
    },
    timestamp: Date.now(),
  };

  eventQueue.push(event);

  if (__DEV__) {
    console.log('[Analytics] Track:', eventName, properties);
  }

  // Flush if queue is large
  if (eventQueue.length >= 20) {
    flush();
  }
}

/**
 * Track a screen view.
 */
export function trackScreen(screenName: string, properties?: EventProperties) {
  track('screen_view', { screen: screenName, ...properties });
}

/**
 * Flush queued events to the analytics backend.
 * In production, this would POST to your analytics provider.
 */
export async function flush() {
  if (eventQueue.length === 0) return;

  const events = eventQueue.splice(0, eventQueue.length);

  if (__DEV__) {
    console.log(`[Analytics] Flushing ${events.length} events`);
    return;
  }

  // Production: send to analytics backend
  // try {
  //   await fetch('https://api.analytics-provider.com/events', {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({ events }),
  //   });
  // } catch (err) {
  //   // Re-queue on failure
  //   eventQueue.unshift(...events);
  // }
}

// ---- Predefined event helpers ----

export const events = {
  // Auth
  loginStarted: (method: string) => track('login_started', { method }),
  loginCompleted: (method: string) => track('login_completed', { method }),
  loginFailed: (method: string, error: string) => track('login_failed', { method, error }),
  registerStarted: () => track('register_started'),
  registerCompleted: () => track('register_completed'),
  loggedOut: () => track('logged_out'),

  // Delivery
  deliveryStarted: () => track('delivery_creation_started'),
  deliveryStepCompleted: (step: string) => track('delivery_step_completed', { step }),
  deliveryEstimateViewed: (cost: number) => track('delivery_estimate_viewed', { estimatedCost: cost }),
  deliveryCreated: (deliveryId: string) => track('delivery_created', { deliveryId }),
  deliveryCancelled: (deliveryId: string) => track('delivery_cancelled', { deliveryId }),
  deliveryTracked: (deliveryId: string) => track('delivery_tracked', { deliveryId }),

  // Payment
  paymentStarted: (provider: string, amount: number) => track('payment_started', { provider, amount }),
  paymentCompleted: (provider: string, amount: number) => track('payment_completed', { provider, amount }),
  paymentFailed: (provider: string, error: string) => track('payment_failed', { provider, error }),

  // Engagement
  supportContacted: () => track('support_contacted'),
  profileUpdated: () => track('profile_updated'),
  languageChanged: (locale: string) => track('language_changed', { locale }),
};
