export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  sessionSecret: process.env.SESSION_SECRET ?? "",
  clerkPublishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "",
  clerkSecretKey: process.env.CLERK_SECRET_KEY ?? "",
  googleGenerativeAiApiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "",
  transloaditKey: process.env.TRANSLOADIT_KEY ?? "",
  transloaditSecret: process.env.TRANSLOADIT_SECRET ?? "",
  triggerSecretKey: process.env.TRIGGER_SECRET_KEY ?? "",
};

export const featureFlags = {
  clerk: Boolean(env.clerkPublishableKey && env.clerkSecretKey),
  database: Boolean(env.databaseUrl),
  googleAi: Boolean(env.googleGenerativeAiApiKey),
  transloadit: Boolean(env.transloaditKey && env.transloaditSecret),
  trigger: Boolean(env.triggerSecretKey),
};
