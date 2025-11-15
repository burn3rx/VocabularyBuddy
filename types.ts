export interface WordData {
  word: string;
  partOfSpeech: string;
  ipa: string;
  definition: string;
  exampleSentences: string[];
  simplifiedExplanation: string;
  difficulty: string; // e.g., "Easy", "Medium", "Hard"
  origin: string;
  pronunciationAudio?: string;
  pronunciationAudioBuffer?: AudioBuffer;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  word: string;
  explanation: string;
}