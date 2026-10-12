import {
  LocalizedVoicePromptResponse,
  ManeuverInstructionRequest,
  SupportedLanguageMetadata,
} from './vernacular.types';

export class VernacularService {
  public getSupportedLanguages(): SupportedLanguageMetadata[] {
    return [
      { code: 'hi-IN', native_name: 'हिन्दी', english_name: 'Hindi' },
      { code: 'bn-IN', native_name: 'বাংলা', english_name: 'Bengali' },
      { code: 'ta-IN', native_name: 'தமிழ்', english_name: 'Tamil' },
      { code: 'te-IN', native_name: 'తెలుగు', english_name: 'Telugu' },
      { code: 'kn-IN', native_name: 'ಕನ್ನಡ', english_name: 'Kannada' },
      { code: 'mr-IN', native_name: 'मराठी', english_name: 'Marathi' },
      { code: 'gu-IN', native_name: 'ગુજરાતી', english_name: 'Gujarati' },
      { code: 'ml-IN', native_name: 'മലയാളം', english_name: 'Malayalam' },
      { code: 'pa-IN', native_name: 'ਪੰਜਾਬੀ', english_name: 'Punjabi' },
      { code: 'en-IN', native_name: 'English (India)', english_name: 'Indian English' },
    ];
  }

  public translateManeuver(req: ManeuverInstructionRequest): LocalizedVoicePromptResponse {
    let lang = String(req.target_lang ?? req.language ?? 'hi').toLowerCase();
    if (lang === 'hi' || lang.startsWith('hi')) lang = 'hi-IN';
    else if (lang === 'bn' || lang.startsWith('bn')) lang = 'bn-IN';
    else if (lang === 'ta' || lang.startsWith('ta')) lang = 'ta-IN';
    else if (lang === 'te' || lang.startsWith('te')) lang = 'te-IN';
    else if (lang === 'mr' || lang.startsWith('mr')) lang = 'mr-IN';
    else if (lang === 'en' || lang.startsWith('en')) lang = 'en-IN';

    const distMeters = req.distance_meters ?? req.distanceMeters ?? 200;
    const distStr =
      distMeters >= 1000
        ? `${(distMeters / 1000.0).toFixed(1)} km`
        : `${distMeters} meters`;

    let street = req.street_name ?? req.streetName ?? 'next road';
    let action = (req.action ?? 'TURN_RIGHT').toUpperCase();

    // If generic text was sent (e.g. "Turn right in 200 meters")
    if (req.text) {
      if (req.text.toLowerCase().includes('right')) action = 'TURN_RIGHT';
      else if (req.text.toLowerCase().includes('left')) action = 'TURN_LEFT';
      else if (req.text.toLowerCase().includes('flyover')) action = 'TAKE_FLYOVER';
      else if (req.text.toLowerCase().includes('u-turn')) action = 'U_TURN';
    }

    let localized = '';
    let phonetic = '';
    let voice = 'hi-IN-Standard-A';

    switch (lang) {
      case 'hi-IN':
        voice = 'hi-IN-Standard-A';
        switch (action) {
          case 'TURN_LEFT':
            localized = `${distStr} mein ${street} par baayein mudiye (Turn Left)`;
            phonetic = 'baayein mudiye';
            break;
          case 'TURN_RIGHT':
            localized = `${distStr} mein ${street} par daayein mudiye (Turn Right)`;
            phonetic = 'daayein mudiye';
            break;
          case 'TAKE_FLYOVER':
            localized = `${distStr} mein flyover par chadhiye`;
            phonetic = 'flyover chadhiye';
            break;
          case 'STAY_BELOW_FLYOVER':
            localized = `${distStr} mein flyover ke neeche service road par rahiye`;
            phonetic = 'service lane par rahiye';
            break;
          case 'U_TURN':
            localized = `${distStr} mein U-turn lijiye`;
            phonetic = 'u-turn lijiye';
            break;
          default:
            localized = `${distStr} seedhe chaliye`;
            phonetic = 'seedhe chaliye';
            break;
        }
        break;

      case 'bn-IN':
        voice = 'bn-IN-Standard-A';
        switch (action) {
          case 'TURN_LEFT':
            localized = `${distStr} pore ${street} te baaye ghurun`;
            phonetic = 'baaye ghurun';
            break;
          case 'TURN_RIGHT':
            localized = `${distStr} pore ${street} te daane ghurun`;
            phonetic = 'daane ghurun';
            break;
          default:
            localized = `${distStr} soja cholun`;
            phonetic = 'soja cholun';
            break;
        }
        break;

      case 'ta-IN':
        voice = 'ta-IN-Standard-A';
        switch (action) {
          case 'TURN_LEFT':
            localized = `${distStr} il idadhu pakkam thirumbavum`;
            phonetic = 'idadhu thirumbavum';
            break;
          case 'TURN_RIGHT':
            localized = `${distStr} il valadhu pakkam thirumbavum`;
            phonetic = 'valadhu thirumbavum';
            break;
          default:
            localized = `${distStr} nērāga sellavum`;
            phonetic = 'nērāga sellavum';
            break;
        }
        break;

      default: // en-IN
        voice = 'en-IN-Standard-B';
        const actionWord = action.toLowerCase().replace(/_/g, ' ');
        localized = `In ${distStr}, ${actionWord} onto ${street}`;
        phonetic = actionWord;
        break;
    }

    return {
      language: lang,
      action,
      localized_text: localized,
      phonetic_script: phonetic,
      audio_tts_voice: voice,
    };
  }
}

export const vernacularService = new VernacularService();
