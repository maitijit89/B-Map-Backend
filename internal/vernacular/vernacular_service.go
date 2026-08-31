package vernacular

import (
	"context"
	"fmt"
	"strings"
)

// SupportedIndianLanguage represents ISO language code for Indian languages.
type SupportedIndianLanguage string

const (
	LangHindi       SupportedIndianLanguage = "hi-IN"
	LangBengali     SupportedIndianLanguage = "bn-IN"
	LangTamil       SupportedIndianLanguage = "ta-IN"
	LangTelugu      SupportedIndianLanguage = "te-IN"
	LangKannada     SupportedIndianLanguage = "kn-IN"
	LangMarathi     SupportedIndianLanguage = "mr-IN"
	LangGujarati    SupportedIndianLanguage = "gu-IN"
	LangMalayalam   SupportedIndianLanguage = "ml-IN"
	LangPunjabi     SupportedIndianLanguage = "pa-IN"
	LangIndianEnglish SupportedIndianLanguage = "en-IN"
)

type ManeuverInstructionRequest struct {
	Action         string                  `json:"action"` // "TURN_LEFT", "TURN_RIGHT", "TAKE_FLYOVER", "STAY_BELOW_FLYOVER", "ROUNDABOUT", "U_TURN", "ARRIVE"
	DistanceMeters int                     `json:"distance_meters"`
	StreetName     string                  `json:"street_name"`
	Landmark       string                  `json:"landmark,omitempty"`
	Language       SupportedIndianLanguage `json:"language"`
}

type LocalizedVoicePromptResponse struct {
	Language       SupportedIndianLanguage `json:"language"`
	Action         string                  `json:"action"`
	LocalizedText  string                  `json:"localized_text"`
	PhoneticScript string                  `json:"phonetic_script"`
	AudioTTSVoice  string                  `json:"audio_tts_voice"` // e.g. "hi-IN-Standard-A"
}

type Service interface {
	TranslateManeuver(ctx context.Context, req *ManeuverInstructionRequest) (*LocalizedVoicePromptResponse, error)
	GetSupportedLanguages() []SupportedLanguageMetadata
}

type SupportedLanguageMetadata struct {
	Code       SupportedIndianLanguage `json:"code"`
	NativeName string                  `json:"native_name"`
	EnglishName string                 `json:"english_name"`
}

type vernacularService struct{}

func NewVernacularService() Service {
	return &vernacularService{}
}

func (s *vernacularService) GetSupportedLanguages() []SupportedLanguageMetadata {
	return []SupportedLanguageMetadata{
		{Code: LangHindi, NativeName: "हिन्दी", EnglishName: "Hindi"},
		{Code: LangBengali, NativeName: "বাংলা", EnglishName: "Bengali"},
		{Code: LangTamil, NativeName: "தமிழ்", EnglishName: "Tamil"},
		{Code: LangTelugu, NativeName: "తెలుగు", EnglishName: "Telugu"},
		{Code: LangKannada, NativeName: "ಕನ್ನಡ", EnglishName: "Kannada"},
		{Code: LangMarathi, NativeName: "मराठी", EnglishName: "Marathi"},
		{Code: LangGujarati, NativeName: "ગુજરાતી", EnglishName: "Gujarati"},
		{Code: LangMalayalam, NativeName: "മലയാളം", EnglishName: "Malayalam"},
		{Code: LangPunjabi, NativeName: "ਪੰਜਾਬੀ", EnglishName: "Punjabi"},
		{Code: LangIndianEnglish, NativeName: "English (India)", EnglishName: "Indian English"},
	}
}

func (s *vernacularService) TranslateManeuver(ctx context.Context, req *ManeuverInstructionRequest) (*LocalizedVoicePromptResponse, error) {
	lang := req.Language
	if lang == "" {
		lang = LangHindi
	}

	distStr := fmt.Sprintf("%d meters", req.DistanceMeters)
	if req.DistanceMeters >= 1000 {
		distStr = fmt.Sprintf("%.1f km", float64(req.DistanceMeters)/1000.0)
	}

	street := req.StreetName
	if street == "" {
		street = "next road"
	}

	var localized string
	var phonetic string
	var voice string

	switch lang {
	case LangHindi:
		voice = "hi-IN-Standard-A"
		switch req.Action {
		case "TURN_LEFT":
			localized = fmt.Sprintf("%s mein %s par baayein mudiye (Turn Left)", distStr, street)
			phonetic = "baayein mudiye"
		case "TURN_RIGHT":
			localized = fmt.Sprintf("%s mein %s par daayein mudiye (Turn Right)", distStr, street)
			phonetic = "daayein mudiye"
		case "TAKE_FLYOVER":
			localized = fmt.Sprintf("%s mein flyover par chadhiye", distStr)
			phonetic = "flyover chadhiye"
		case "STAY_BELOW_FLYOVER":
			localized = fmt.Sprintf("%s mein flyover ke neeche service road par rahiye", distStr)
			phonetic = "service lane par rahiye"
		case "U_TURN":
			localized = fmt.Sprintf("%s mein U-turn lijiye", distStr)
			phonetic = "u-turn lijiye"
		default:
			localized = fmt.Sprintf("%s seedhe chaliye", distStr)
			phonetic = "seedhe chaliye"
		}

	case LangBengali:
		voice = "bn-IN-Standard-A"
		switch req.Action {
		case "TURN_LEFT":
			localized = fmt.Sprintf("%s pore %s te baaye ghurun", distStr, street)
			phonetic = "baaye ghurun"
		case "TURN_RIGHT":
			localized = fmt.Sprintf("%s pore %s te daane ghurun", distStr, street)
			phonetic = "daane ghurun"
		default:
			localized = fmt.Sprintf("%s soja cholun", distStr)
			phonetic = "soja cholun"
		}

	case LangTamil:
		voice = "ta-IN-Standard-A"
		switch req.Action {
		case "TURN_LEFT":
			localized = fmt.Sprintf("%s il idadhu pakkam thirumbavum", distStr)
			phonetic = "idadhu thirumbavum"
		case "TURN_RIGHT":
			localized = fmt.Sprintf("%s il valadhu pakkam thirumbavum", distStr)
			phonetic = "valadhu thirumbavum"
		default:
			localized = fmt.Sprintf("%s nērāga sellavum", distStr)
			phonetic = "nērāga sellavum"
		}

	default: // Indian English
		voice = "en-IN-Standard-B"
		actionWord := strings.ToLower(strings.ReplaceAll(req.Action, "_", " "))
		localized = fmt.Sprintf("In %s, %s onto %s", distStr, actionWord, street)
		phonetic = actionWord
	}

	return &LocalizedVoicePromptResponse{
		Language:       lang,
		Action:         req.Action,
		LocalizedText:  localized,
		PhoneticScript: phonetic,
		AudioTTSVoice:  voice,
	}, nil
}
