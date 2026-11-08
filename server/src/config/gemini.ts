import { GoogleGenAI } from '@google/genai';
import { env } from './env';

let geminiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (geminiClient) {
    return geminiClient;
  }

  const apiKey = env.GEMINI_API_KEY ? env.GEMINI_API_KEY.trim() : undefined;

  if (!apiKey) {
    throw new Error(
      'Gemini API key missing: GEMINI_API_KEY must be set in server environment variables.'
    );
  }

  // Uses Gemini Developer API (not Vertex AI)
  geminiClient = new GoogleGenAI({
    apiKey,
  });

  return geminiClient;
}

export const geminiConfig = {
  get model(): string {
    return (env.GEMINI_MODEL || 'gemini-3.5-flash-lite').trim();
  },
};

export default getGeminiClient;
