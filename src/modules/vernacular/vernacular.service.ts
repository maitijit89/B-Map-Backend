import {
  LocalizedVoicePromptResponse,
  ManeuverInstructionRequest,
  SupportedLanguageMetadata,
} from './vernacular.types';

export class VernacularService {
  public getSupportedLanguages(): SupportedLanguageMetadata[] {
    return [
      { code: 'hi-IN', native_name: 'हिन्दी', english_name: 'Hindi' },
      { code: 'ta-IN', native_name: 'தமிழ்', english_name: 'Tamil' },
      { code: 'te-IN', native_name: 'తెలుగు', english_name: 'Telugu' },
      { code: 'bn-IN', native_name: 'বাংলা', english_name: 'Bengali' },
      { code: 'mr-IN', native_name: 'मराठी', english_name: 'Marathi' },
      { code: 'gu-IN', native_name: 'ગુજરાતી', english_name: 'Gujarati' },
      { code: 'kn-IN', native_name: 'ಕನ್ನಡ', english_name: 'Kannada' },
      { code: 'ml-IN', native_name: 'മലയാളം', english_name: 'Malayalam' },
      { code: 'pa-IN', native_name: 'ਪੰਜਾਬੀ', english_name: 'Punjabi' },
      { code: 'or-IN', native_name: 'ଓଡ଼ିଆ', english_name: 'Odia' },
      { code: 'as-IN', native_name: 'অসমীয়া', english_name: 'Assamese' },
      { code: 'en-IN', native_name: 'English (India)', english_name: 'Indian English' },
    ];
  }

  public translateManeuver(req: ManeuverInstructionRequest): LocalizedVoicePromptResponse {
    let lang = String(req.target_lang ?? req.language ?? 'hi').toLowerCase().trim();
    if (lang === 'hi' || lang.startsWith('hi')) lang = 'hi-IN';
    else if (lang === 'ta' || lang.startsWith('ta')) lang = 'ta-IN';
    else if (lang === 'te' || lang.startsWith('te')) lang = 'te-IN';
    else if (lang === 'bn' || lang.startsWith('bn')) lang = 'bn-IN';
    else if (lang === 'mr' || lang.startsWith('mr')) lang = 'mr-IN';
    else if (lang === 'gu' || lang.startsWith('gu')) lang = 'gu-IN';
    else if (lang === 'kn' || lang.startsWith('kn')) lang = 'kn-IN';
    else if (lang === 'ml' || lang.startsWith('ml')) lang = 'ml-IN';
    else if (lang === 'pa' || lang.startsWith('pa')) lang = 'pa-IN';
    else if (lang === 'or' || lang.startsWith('or')) lang = 'or-IN';
    else if (lang === 'as' || lang.startsWith('as')) lang = 'as-IN';
    else if (lang === 'en' || lang.startsWith('en')) lang = 'en-IN';
    else lang = 'hi-IN';

    const distMeters = req.distance_meters ?? req.distanceMeters ?? 200;
    const distStr =
      distMeters >= 1000
        ? `${(distMeters / 1000.0).toFixed(1)} km`
        : `${distMeters} meters`;

    let street = req.street_name ?? req.streetName ?? 'next road';
    let action = (req.action ?? 'TURN_RIGHT').toUpperCase();

    if (req.text) {
      const lowerText = req.text.toLowerCase();
      if (lowerText.includes('right')) action = 'TURN_RIGHT';
      else if (lowerText.includes('left')) action = 'TURN_LEFT';
      else if (lowerText.includes('flyover')) action = 'TAKE_FLYOVER';
      else if (lowerText.includes('service')) action = 'STAY_BELOW_FLYOVER';
      else if (lowerText.includes('u-turn')) action = 'U_TURN';
    }

    let localized = '';
    let phonetic = '';
    let voice = 'hi-IN-Standard-A';

    switch (lang) {
      case 'hi-IN':
        voice = 'hi-IN-Standard-A';
        if (action === 'TURN_LEFT') {
          localized = `${distStr} mein ${street} par baayein mudiye`;
          phonetic = 'baayein mudiye';
        } else if (action === 'TURN_RIGHT') {
          localized = `${distStr} mein ${street} par daayein mudiye`;
          phonetic = 'daayein mudiye';
        } else if (action === 'TAKE_FLYOVER') {
          localized = `${distStr} mein flyover par chadhiye`;
          phonetic = 'flyover chadhiye';
        } else if (action === 'STAY_BELOW_FLYOVER') {
          localized = `${distStr} mein flyover ke neeche service road par rahiye`;
          phonetic = 'service lane par rahiye';
        } else if (action === 'U_TURN') {
          localized = `${distStr} mein U-turn lijiye`;
          phonetic = 'u-turn lijiye';
        } else {
          localized = `${distStr} seedhe chaliye`;
          phonetic = 'seedhe chaliye';
        }
        break;

      case 'ta-IN':
        voice = 'ta-IN-Standard-A';
        if (action === 'TURN_LEFT') {
          localized = `${distStr} il ${street} il idadhu pakkam thirumbavum`;
          phonetic = 'idadhu pakkam thirumbavum';
        } else if (action === 'TURN_RIGHT') {
          localized = `${distStr} il ${street} il valadhu pakkam thirumbavum`;
          phonetic = 'valadhu pakkam thirumbavum';
        } else if (action === 'TAKE_FLYOVER') {
          localized = `${distStr} il flyover mel sellavum`;
          phonetic = 'flyover mel sellavum';
        } else if (action === 'U_TURN') {
          localized = `${distStr} il U-turn edukkavum`;
          phonetic = 'u-turn edukkavum';
        } else {
          localized = `${distStr} nērāga sellavum`;
          phonetic = 'nērāga sellavum';
        }
        break;

      case 'te-IN':
        voice = 'te-IN-Standard-A';
        if (action === 'TURN_LEFT') {
          localized = `${distStr} lo ${street} vaipu edamavaipu thiragandi`;
          phonetic = 'edamavaipu thiragandi';
        } else if (action === 'TURN_RIGHT') {
          localized = `${distStr} lo ${street} vaipu kudinavaipu thiragandi`;
          phonetic = 'kudinavaipu thiragandi';
        } else if (action === 'TAKE_FLYOVER') {
          localized = `${distStr} lo flyover paiki vellandi`;
          phonetic = 'flyover paiki vellandi';
        } else if (action === 'U_TURN') {
          localized = `${distStr} lo U-turn teesukondi`;
          phonetic = 'u-turn teesukondi';
        } else {
          localized = `${distStr} sidhaga vellandi`;
          phonetic = 'sidhaga vellandi';
        }
        break;

      case 'bn-IN':
        voice = 'bn-IN-Standard-A';
        if (action === 'TURN_LEFT') {
          localized = `${distStr} pore ${street} te baaye ghurun`;
          phonetic = 'baaye ghurun';
        } else if (action === 'TURN_RIGHT') {
          localized = `${distStr} pore ${street} te daane ghurun`;
          phonetic = 'daane ghurun';
        } else if (action === 'TAKE_FLYOVER') {
          localized = `${distStr} pore flyover e uthun`;
          phonetic = 'flyover e uthun';
        } else if (action === 'U_TURN') {
          localized = `${distStr} pore U-turn nin`;
          phonetic = 'u-turn nin';
        } else {
          localized = `${distStr} soja cholun`;
          phonetic = 'soja cholun';
        }
        break;

      case 'mr-IN':
        voice = 'mr-IN-Standard-A';
        if (action === 'TURN_LEFT') {
          localized = `${distStr} nantar ${street} var davi kade vala`;
          phonetic = 'davi kade vala';
        } else if (action === 'TURN_RIGHT') {
          localized = `${distStr} nantar ${street} var ujvi kade vala`;
          phonetic = 'ujvi kade vala';
        } else if (action === 'TAKE_FLYOVER') {
          localized = `${distStr} nantar flyover varun ja`;
          phonetic = 'flyover varun ja';
        } else if (action === 'U_TURN') {
          localized = `${distStr} nantar U-turn ghya`;
          phonetic = 'u-turn ghya';
        } else {
          localized = `${distStr} saral pudhe chala`;
          phonetic = 'saral pudhe chala';
        }
        break;

      case 'gu-IN':
        voice = 'gu-IN-Standard-A';
        if (action === 'TURN_LEFT') {
          localized = `${distStr} pachhi ${street} par dabi baju valo`;
          phonetic = 'dabi baju valo';
        } else if (action === 'TURN_RIGHT') {
          localized = `${distStr} pachhi ${street} par jamni baju valo`;
          phonetic = 'jamni baju valo';
        } else if (action === 'TAKE_FLYOVER') {
          localized = `${distStr} pachhi flyover par chado`;
          phonetic = 'flyover par chado';
        } else if (action === 'U_TURN') {
          localized = `${distStr} pachhi U-turn lo`;
          phonetic = 'u-turn lo';
        } else {
          localized = `${distStr} sidha aagal vadho`;
          phonetic = 'sidha aagal vadho';
        }
        break;

      case 'kn-IN':
        voice = 'kn-IN-Standard-A';
        if (action === 'TURN_LEFT') {
          localized = `${distStr} nantara ${street} alli edakke thirugi`;
          phonetic = 'edakke thirugi';
        } else if (action === 'TURN_RIGHT') {
          localized = `${distStr} nantara ${street} alli balakke thirugi`;
          phonetic = 'balakke thirugi';
        } else if (action === 'TAKE_FLYOVER') {
          localized = `${distStr} nantara flyover mele hogi`;
          phonetic = 'flyover mele hogi';
        } else if (action === 'U_TURN') {
          localized = `${distStr} nantara U-turn thagoli`;
          phonetic = 'u-turn thagoli';
        } else {
          localized = `${distStr} neravagi hogi`;
          phonetic = 'neravagi hogi';
        }
        break;

      case 'ml-IN':
        voice = 'ml-IN-Standard-A';
        if (action === 'TURN_LEFT') {
          localized = `${distStr} kazhinju ${street} il idathottu thirinju pokuka`;
          phonetic = 'idathottu thiriyuka';
        } else if (action === 'TURN_RIGHT') {
          localized = `${distStr} kazhinju ${street} il valathottu thirinju pokuka`;
          phonetic = 'valathottu thiriyuka';
        } else if (action === 'TAKE_FLYOVER') {
          localized = `${distStr} kazhinju flyoveril kayaruka`;
          phonetic = 'flyoveril kayaruka';
        } else if (action === 'U_TURN') {
          localized = `${distStr} kazhinju U-turn edukkuka`;
          phonetic = 'u-turn edukkuka';
        } else {
          localized = `${distStr} nere pokuka`;
          phonetic = 'nere pokuka';
        }
        break;

      case 'pa-IN':
        voice = 'pa-IN-Standard-A';
        if (action === 'TURN_LEFT') {
          localized = `${distStr} vich ${street} te khabbe mudo`;
          phonetic = 'khabbe mudo';
        } else if (action === 'TURN_RIGHT') {
          localized = `${distStr} vich ${street} te sajje mudo`;
          phonetic = 'sajje mudo';
        } else if (action === 'TAKE_FLYOVER') {
          localized = `${distStr} vich flyover te chado`;
          phonetic = 'flyover te chado';
        } else if (action === 'U_TURN') {
          localized = `${distStr} vich U-turn lavo`;
          phonetic = 'u-turn lavo';
        } else {
          localized = `${distStr} sidhe jao`;
          phonetic = 'sidhe jao';
        }
        break;

      case 'or-IN':
        voice = 'or-IN-Standard-A';
        if (action === 'TURN_LEFT') {
          localized = `${distStr} pare ${street} re bama ku bulantu`;
          phonetic = 'bama ku bulantu';
        } else if (action === 'TURN_RIGHT') {
          localized = `${distStr} pare ${street} re dahana ku bulantu`;
          phonetic = 'dahana ku bulantu';
        } else if (action === 'TAKE_FLYOVER') {
          localized = `${distStr} pare flyover uparaku jaantu`;
          phonetic = 'flyover uparaku jaantu';
        } else if (action === 'U_TURN') {
          localized = `${distStr} pare U-turn niantu`;
          phonetic = 'u-turn niantu';
        } else {
          localized = `${distStr} sidha jaantu`;
          phonetic = 'sidha jaantu';
        }
        break;

      case 'as-IN':
        voice = 'as-IN-Standard-A';
        if (action === 'TURN_LEFT') {
          localized = `${distStr} pasot ${street} t baoke ghurak`;
          phonetic = 'baoke ghurak';
        } else if (action === 'TURN_RIGHT') {
          localized = `${distStr} pasot ${street} t khope ghurak`;
          phonetic = 'khope ghurak';
        } else if (action === 'TAKE_FLYOVER') {
          localized = `${distStr} pasot flyover t uthok`;
          phonetic = 'flyover t uthok';
        } else if (action === 'U_TURN') {
          localized = `${distStr} pasot U-turn lok`;
          phonetic = 'u-turn lok';
        } else {
          localized = `${distStr} sidha jaok`;
          phonetic = 'sidha jaok';
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
