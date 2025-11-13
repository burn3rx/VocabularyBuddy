
import React, { useState, useEffect, useCallback } from 'react';
import { WordData, QuizQuestion } from '../types';
import { generateQuizQuestion } from '../services/geminiService';
import { LoaderIcon, RefreshIcon } from './icons';

interface QuizProps {
  words: WordData[];
}

type QuizState = 'idle' | 'generating' | 'active' | 'finished';

const shuffleArray = <T,>(array: T[]): T[] => {
  return [...array].sort(() => Math.random() - 0.5);
};

export const Quiz: React.FC<QuizProps> = ({ words }) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [quizState, setQuizState] = useState<QuizState>('idle');
  const [error, setError] = useState<string | null>(null);

  const startQuiz = useCallback(async () => {
    if (words.length < 4) {
      setError("You need at least 4 words in your history to start a quiz.");
      return;
    }
    setQuizState('generating');
    setError(null);
    setUserAnswers({});
    setCurrentQuestionIndex(0);
    setQuestions([]);

    try {
      const shuffledWords = shuffleArray(words);
      const questionPromises = shuffledWords.map(word => generateQuizQuestion(word, shuffledWords));
      const generatedQuestions = await Promise.all(questionPromises);
      
      const questionsWithShuffledOptions = generatedQuestions.map(q => ({
          ...q,
          options: shuffleArray(q.options)
      }));

      setQuestions(questionsWithShuffledOptions);
      setQuizState('active');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate quiz.');
      setQuizState('idle');
    }
  }, [words]);

  useEffect(() => {
    if (words.length >= 4 && (quizState === 'idle' || quizState === 'finished')) {
        startQuiz();
    }
  }, [words, startQuiz, quizState]);
  
  const handleAnswer = (answer: string) => {
    setUserAnswers(prev => ({ ...prev, [currentQuestionIndex]: answer }));
    setTimeout(() => {
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
      } else {
        setQuizState('finished');
      }
    }, 1000);
  };

  const calculateScore = () => {
    return questions.reduce((score, question, index) => {
      return userAnswers[index] === question.correctAnswer ? score + 1 : score;
    }, 0);
  };

  if (words.length < 4) {
    return (
        <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg">
            <h2 className="text-2xl font-bold mb-4">Quiz Time!</h2>
            <p className="text-slate-500 dark:text-slate-400">Search for at least 4 words to unlock the quiz feature.</p>
        </div>
    );
  }

  if (quizState === 'idle' || quizState === 'generating') {
    return (
      <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg flex flex-col items-center justify-center min-h-[300px]">
        {quizState === 'generating' ? (
          <>
            <LoaderIcon className="w-12 h-12 animate-spin text-blue-500 mb-4" />
            <h2 className="text-2xl font-bold">Generating your quiz...</h2>
            <p className="text-slate-500 dark:text-slate-400">This might take a moment.</p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold mb-4">Ready for a challenge?</h2>
            <button onClick={startQuiz} className="px-6 py-3 bg-blue-500 text-white font-bold rounded-full hover:bg-blue-600 transition">
              Start Quiz
            </button>
          </>
        )}
         {error && <p className="text-red-500 mt-4">{error}</p>}
      </div>
    );
  }

  if (quizState === 'finished') {
    const score = calculateScore();
    const percentage = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
    return (
      <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg">
        <h2 className="text-3xl font-bold mb-2">Quiz Complete!</h2>
        <p className="text-lg text-slate-600 dark:text-slate-300 mb-6">
          You scored <span className="font-bold text-blue-500">{score}</span> out of <span className="font-bold">{questions.length}</span> ({percentage}%)
        </p>
        <button onClick={startQuiz} className="flex items-center mx-auto space-x-2 px-6 py-3 bg-blue-500 text-white font-bold rounded-full hover:bg-blue-600 transition">
          <RefreshIcon className="w-5 h-5"/>
          <span>Play Again</span>
        </button>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  if (!currentQuestion) {
      return (
        <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg flex flex-col items-center justify-center min-h-[300px]">
            <LoaderIcon className="w-12 h-12 animate-spin text-blue-500 mb-4" />
            <h2 className="text-2xl font-bold">Loading question...</h2>
        </div>
      );
  }

  const userAnswer = userAnswers[currentQuestionIndex];

  return (
    <div className="p-6 sm:p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg max-w-2xl mx-auto">
      <div className="mb-6">
        <p className="text-sm text-slate-500 dark:text-slate-400">Question {currentQuestionIndex + 1} of {questions.length}</p>
        <h2 className="text-xl sm:text-2xl font-semibold mt-1">{currentQuestion.question}</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {currentQuestion.options.map((option, i) => {
          let buttonClass = "w-full text-left p-4 rounded-lg border-2 transition-all duration-300 font-medium ";
          if (userAnswer) {
              if (option === currentQuestion.correctAnswer) {
                  buttonClass += "bg-green-100 dark:bg-green-900/30 border-green-500 text-green-800 dark:text-green-300";
              } else if (option === userAnswer) {
                  buttonClass += "bg-red-100 dark:bg-red-900/30 border-red-500 text-red-800 dark:text-red-300";
              } else {
                  buttonClass += "bg-slate-100 dark:bg-slate-700 border-transparent text-slate-600 dark:text-slate-300 opacity-60";
              }
          } else {
              buttonClass += "bg-slate-100 dark:bg-slate-700 border-transparent hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20";
          }

          return (
            <button key={i} onClick={() => handleAnswer(option)} disabled={!!userAnswer} className={buttonClass}>
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
};
