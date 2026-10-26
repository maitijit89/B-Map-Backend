export type SupportedIndianLanguage =
  | 'hi-IN'
  | 'bn-IN'
  | 'ta-IN'
  | 'te-IN'
  | 'kn-IN'
  | 'mr-IN'
  | 'gu-IN'
  | 'ml-IN'
  | 'pa-IN'
  | 'or-IN'
  | 'as-IN'
  | 'en-IN'
  | 'hi'
  | 'bn'
  | 'ta'
  | 'te'
  | 'kn'
  | 'mr'
  | 'gu'
  | 'ml'
  | 'pa'
  | 'or'
  | 'as'
  | 'en';

export interface ManeuverInstructionRequest {
  action?: string;
  distance_meters?: number;
  distanceMeters?: number;
  street_name?: string;
  streetName?: string;
  landmark?: string;
  language?: SupportedIndianLanguage;
  target_lang?: SupportedIndianLanguage;
  text?: string;
}

export interface LocalizedVoicePromptResponse {
  language: string;
  action: string;
  localized_text: string;
  phonetic_script: string;
  audio_tts_voice: string;
}

export interface SupportedLanguageMetadata {
  code: string;
  native_name: string;
  english_name: string;
}
