
import React, { useState, useEffect, useCallback } from 'react';
import { WordData, QuizQuestion } from '../types';
import { generateQuizQuestion } from '../services/geminiService';
import { LoaderIcon, RefreshIcon, CheckIcon, XMarkIcon } from './icons';

interface QuizProps {
  words: WordData[];
}

type QuizState = 'idle' | 'generating' | 'active' | 'finished';

function shuffleArray(array: any[]) {
  return [...array].sort(() => Math.random() - 0.5);
}

export const Quiz: React.FC<QuizProps> = ({ words }) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [quizState, setQuizState] = useState<QuizState>('idle');
  const [error, setError] = useState<string | null>(null);

  const startQuiz = useCallback(async () => {
    if (words.length < 4) {
      setError("You need at least 4 saved words to start a quiz.");
      return;
    }
    setQuizState('generating');
    setError(null);
    setUserAnswers({});
    setCurrentQuestionIndex(0);
    setQuestions([]);

    try {
      const shuffledWords = shuffleArray(words);
      const quizWords = shuffledWords.slice(0, 5); // Limit to 5 words for a quick quiz
      const questionPromises = quizWords.map((word: WordData) => generateQuizQuestion(word, words));
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
    // Auto-start if we have enough words and haven't started yet
    if (words.length >= 4 && quizState === 'idle' && questions.length === 0 && !error) {
        startQuiz();
    }
  }, [words, quizState, questions.length, startQuiz, error]);

  const handleAnswer = (answer: string) => {
    if (userAnswers[currentQuestionIndex]) return; // Prevent multiple answers

    setUserAnswers(prev => ({ ...prev, [currentQuestionIndex]: answer }));

    const isCorrect = answer === questions[currentQuestionIndex].correctAnswer;
    const timeoutDuration = isCorrect ? 1200 : 3500; // Longer pause for incorrect answers to read explanation

    setTimeout(() => {
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
      } else {
        setQuizState('finished');
      }
    }, timeoutDuration);
  };

  const calculateScore = () => {
    let score = 0;
    questions.forEach((q, index) => {
      if (userAnswers[index] === q.correctAnswer) score++;
    });
    return score;
  };

  if (quizState === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-6">
        <LoaderIcon className="w-12 h-12 animate-spin text-blue-500" />
        <p className="text-slate-500 dark:text-slate-400 text-lg animate-pulse font-medium">Crafting your quiz...</p>
      </div>
    );
  }

  if (quizState === 'finished') {
    const score = calculateScore();
    const percentage = Math.round((score / questions.length) * 100);
    
    return (
      <div className="max-w-2xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center animate-fade-in">
        <h2 className="text-3xl font-bold mb-8 text-slate-900 dark:text-white">Quiz Complete!</h2>
        
        <div className="mb-10 relative inline-block">
          <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
             <circle cx="50" cy="50" r="45" fill="none" stroke="#e2e8f0" strokeWidth="8" />
             <circle cx="50" cy="50" r="45" fill="none" stroke="#3b82f6" strokeWidth="8" 
                     strokeDasharray={`${percentage * 2.83} 283`} className="transition-all duration-1000 ease-out" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center flex-col">
             <span className="text-3xl font-bold text-slate-800 dark:text-white">{percentage}%</span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 mt-4">You got {score} out of {questions.length} correct</p>
        </div>

        <div className="flex justify-center">
            <button 
              onClick={() => {
                  setQuestions([]); 
                  setQuizState('idle');
                  setError(null);
              }} 
              className="flex items-center px-8 py-4 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-full transition-transform transform hover:scale-105 shadow-lg hover:shadow-blue-500/30"
            >
              <RefreshIcon className="w-6 h-6 mr-2" />
              Take Another Quiz
            </button>
        </div>
      </div>
    );
  }

  if (words.length < 4) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-center p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg">
            <div className="bg-yellow-100 dark:bg-yellow-900/30 p-4 rounded-full mb-4">
                <LoaderIcon className="w-8 h-8 text-yellow-600 dark:text-yellow-400" /> 
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Not Enough Saved Words</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-md">
                You need to save at least 4 words to unlock the quiz feature. Go back to Lookup and click the bookmark icon on words you want to learn!
            </p>
        </div>
      );
  }
  
  if (quizState === 'idle' && error) {
       return (
        <div className="flex flex-col items-center justify-center h-64 text-center p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-lg">
            <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-full mb-4">
                 <XMarkIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <p className="text-red-600 dark:text-red-400 mb-6 font-medium">{error}</p>
             <button onClick={startQuiz} className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-full transition-colors">
                 Try Again
             </button>
        </div>
      );
  }

  if (quizState === 'active' && questions.length > 0) {
    const question = questions[currentQuestionIndex];
    const userAnswer = userAnswers[currentQuestionIndex];
    
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <span className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Question {currentQuestionIndex + 1} <span className="text-slate-300 dark:text-slate-600">/</span> {questions.length}
          </span>
          <div className="px-4 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-semibold rounded-full border border-blue-200 dark:border-blue-800">
             Target: {question.word}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 sm:p-8 mb-6 border border-slate-100 dark:border-slate-700/50">
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-8 leading-relaxed">
            {question.question}
          </h3>

          <div className="grid grid-cols-1 gap-3">
            {question.options.map((option, idx) => {
              const isSelected = userAnswer === option;
              const isCorrect = option === question.correctAnswer;
              const showResult = !!userAnswer;
              
              let btnClass = "group relative p-4 text-left rounded-xl border-2 transition-all duration-200 outline-none ";
              
              if (showResult) {
                if (isCorrect) {
                   btnClass += "border-green-500 bg-green-50 dark:bg-green-900/20 dark:border-green-500 text-green-800 dark:text-green-200 shadow-md";
                } else if (isSelected) {
                   btnClass += "border-red-500 bg-red-50 dark:bg-red-900/20 dark:border-red-500 text-red-800 dark:text-red-200 shadow-sm";
                } else {
                   btnClass += "border-slate-100 dark:border-slate-700 opacity-40 grayscale";
                }
              } else {
                btnClass += "border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-slate-700/50 active:scale-[0.99]";
              }

              return (
                <button
                  key={idx}
                  disabled={showResult}
                  onClick={() => handleAnswer(option)}
                  className={btnClass}
                >
                  <div className="flex items-start pr-8">
                      <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 mr-3 flex items-center justify-center transition-colors ${
                          showResult && isCorrect ? 'border-green-500 bg-green-500 text-white' :
                          showResult && isSelected ? 'border-red-500 bg-red-500 text-white' :
                          'border-slate-300 dark:border-slate-500 group-hover:border-blue-500'
                      }`}>
                        {showResult && isCorrect ? <CheckIcon className="w-4 h-4" /> : 
                         showResult && isSelected ? <XMarkIcon className="w-4 h-4" /> : 
                         <span className="text-xs font-bold text-slate-400">{String.fromCharCode(65 + idx)}</span>}
                      </div>
                      <span className="block pt-0.5">{option}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {userAnswer && (
            <div className="bg-blue-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-blue-100 dark:border-slate-700 animate-fade-in shadow-sm">
                <h4 className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-2">Explanation</h4>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                    {question.explanation}
                </p>
                {!questions[currentQuestionIndex].correctAnswer.includes(userAnswer) && userAnswer !== questions[currentQuestionIndex].correctAnswer && (
                     <div className="mt-3 text-sm text-slate-500 dark:text-slate-400 border-t border-blue-100 dark:border-slate-700 pt-3">
                        <span className="font-semibold">Correct Answer:</span> {questions[currentQuestionIndex].correctAnswer}
                     </div>
                )}
            </div>
        )}
      </div>
    );
  }

  return null;
};
