export interface WordData {
  word: string;
  definition: string;
  exampleSentences: string[];
  simplifiedExplanation: string;
  difficulty: string; // e.g., "Easy", "Medium", "Hard"
  pronunciationAudio?: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  word: string;
  explanation: string;
}