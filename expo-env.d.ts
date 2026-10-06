/// <reference types="expo/types" />

declare namespace NodeJS {
  interface ProcessEnv {
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
    EXPO_PUBLIC_API_URL?: string;
  }
}
