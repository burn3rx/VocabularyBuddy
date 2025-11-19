
import React, { useState, useCallback, useEffect } from 'react';
import { VocabularyLookup } from './components/VocabularyLookup';
import { Quiz } from './components/Quiz';
import { WordData } from './types';
import { BookOpenIcon, PencilIcon } from './components/icons';

type View = 'lookup' | 'quiz';

const App: React.FC = () => {
  const [history, setHistory] = useState<WordData[]>([]);
  const [savedWords, setSavedWords] = useState<WordData[]>(() => {
    try {
      const saved = localStorage.getItem('vocabulary_buddy_saved_words');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load saved words", e);
      return [];
    }
  });
  const [view, setView] = useState<View>('lookup');

  useEffect(() => {
    try {
      // Strip out AudioBuffer before saving as it's not serializable
      const dataToSave = savedWords.map(({ pronunciationAudioBuffer, ...rest }) => rest);
      localStorage.setItem('vocabulary_buddy_saved_words', JSON.stringify(dataToSave));
    } catch (e) {
      console.error("Failed to save words", e);
    }
  }, [savedWords]);

  const addToHistory = useCallback((newWordsData: WordData[]) => {
    setHistory(prevHistory => {
      const newWords = newWordsData.filter(
        wordData => !prevHistory.some(h => h.word.toLowerCase() === wordData.word.toLowerCase())
      );
      return [...newWords, ...prevHistory];
    });
  }, []);

  const updateHistoryItem = useCallback((updatedWord: WordData) => {
    setHistory(prevHistory => 
      prevHistory.map(item => 
        item.word.toLowerCase() === updatedWord.word.toLowerCase() ? updatedWord : item
      )
    );
    // Also update saved words if the word is saved
    setSavedWords(prevSaved => 
        prevSaved.map(item => 
            item.word.toLowerCase() === updatedWord.word.toLowerCase() ? updatedWord : item
        )
    );
  }, []);

  const toggleSaveWord = useCallback((word: WordData) => {
    setSavedWords(prev => {
      const isSaved = prev.some(w => w.word.toLowerCase() === word.word.toLowerCase());
      if (isSaved) {
        return prev.filter(w => w.word.toLowerCase() !== word.word.toLowerCase());
      } else {
        return [...prev, word];
      }
    });
  }, []);

  return (
    <div className="min-h-screen font-sans">
      <header className="bg-white dark:bg-slate-800 shadow-md">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-teal-400">
              Vocabulary Buddy
            </h1>
            <nav className="flex space-x-1 sm:space-x-2 bg-slate-100 dark:bg-slate-700 p-1 rounded-full">
              <button
                onClick={() => setView('lookup')}
                className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-full transition-colors duration-200 ${
                  view === 'lookup'
                    ? 'bg-blue-500 text-white shadow'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                <BookOpenIcon className="w-5 h-5" />
                <span className="hidden sm:inline">Lookup</span>
              </button>
              <button
                onClick={() => setView('quiz')}
                disabled={savedWords.length < 4}
                title={savedWords.length < 4 ? 'Save at least 4 words to start the quiz' : 'Take a quiz on your saved words'}
                className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-full transition-colors duration-200 ${
                  view === 'quiz'
                    ? 'bg-blue-500 text-white shadow'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <PencilIcon className="w-5 h-5" />
                <span className="hidden sm:inline">Quiz</span>
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        {view === 'lookup' ? (
          <VocabularyLookup 
            history={history} 
            addToHistory={addToHistory} 
            updateHistoryItem={updateHistoryItem}
            savedWords={savedWords}
            toggleSaveWord={toggleSaveWord}
          />
        ) : (
          <Quiz words={savedWords} />
        )}
      </main>

      <footer className="text-center py-4 text-xs text-slate-500 dark:text-slate-400">
        <p>Built for students by a world-class React engineer.</p>
      </footer>
    </div>
  );
};

export default App;
