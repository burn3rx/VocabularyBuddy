
export interface WordData {
  word: string;
  definition: string;
  exampleSentence: string;
  simplifiedExplanation: string;
  difficulty: string; // e.g., "Easy", "Medium", "Hard"
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  word: string;
}