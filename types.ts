
export interface WordData {
  word: string;
  definition: string;
  exampleSentence: string;
  simplifiedExplanation: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  word: string;
}
   