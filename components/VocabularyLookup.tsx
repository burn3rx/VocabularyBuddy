import React, { useState, useCallback, useEffect, useRef } from 'react';
import { WordData } from '../types';
import { fetchWordData, getPronunciation, fetchPartialWordData } from '../services/geminiService';
import { ArrowLeftIcon, ArrowRightIcon, ChevronRightIcon, LoaderIcon, SearchIcon, VolumeUpIcon } from './icons';

interface VocabularyLookupProps {
  history: WordData[];
  addToHistory: (newWordsData: WordData[]) => void;
  updateHistoryItem: (updatedWord: WordData) => void;
}

// Audio helper functions
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}


export const VocabularyLookup: React.FC<VocabularyLookupProps> = ({ history, addToHistory, updateHistoryItem }) => {
  const [input, setInput] = useState('');
  const [gradeLevel, setGradeLevel] = useState('5th Grader');
  const [results, setResults] = useState<WordData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPronouncing, setIsPronouncing] = useState<Record<string, boolean>>({});
  const isMounted = useRef(false);

  useEffect(() => {
    if (isMounted.current) {
        const wordToUpdate = results[currentIndex]?.word;
        if (wordToUpdate) {
            const refetchExplanationAndExamples = async () => {
                setIsUpdating(true);
                setError(null);
                try {
                    const partialData = await fetchPartialWordData(wordToUpdate, gradeLevel);
                    const currentData = results[currentIndex];
                    const updatedData = { ...currentData, ...partialData };

                    setResults(prev => prev.map((item, index) => index === currentIndex ? updatedData : item));
                    updateHistoryItem(updatedData);
                } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to update explanation.');
                } finally {
                    setIsUpdating(false);
                }
            };
            refetchExplanationAndExamples();
        }
    } else {
        isMounted.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeLevel]);

  const handleSearch = useCallback(async (wordsToSearch: string) => {
    if (!wordsToSearch.trim()) return;

    setIsLoading(true);
    setError(null);
    setResults([]);
    setCurrentIndex(0);

    const words = wordsToSearch.split(',').map(w => w.trim()).filter(Boolean);

    try {
      const newWordDataPromises = words.map(word => fetchWordData(word, gradeLevel));
      const newWordData = await Promise.all(newWordDataPromises);
      setResults(newWordData);
      addToHistory(newWordData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [gradeLevel, addToHistory]);
  
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(input);
    setInput('');
  };
  
  const handleHistoryClick = (word: string) => {
    // Reverse the history to get chronological order (oldest to newest)
    const chronologicalHistory = [...history].reverse();
    const clickedWordIndex = chronologicalHistory.findIndex(item => item.word.toLowerCase() === word.toLowerCase());

    if (clickedWordIndex !== -1) {
      // Load the entire history into the results view in chronological order
      setResults(chronologicalHistory);
      // Set the current index to the word that was clicked
      setCurrentIndex(clickedWordIndex);
      // Ensure loading state and errors are cleared
      setIsLoading(false);
      setError(null);
    }
  };
  
  const currentWordData = results[currentIndex];
  
  const handlePronunciation = async (word: string) => {
    setIsPronouncing(prev => ({ ...prev, [word]: true }));
    try {
      let base64Audio = currentWordData?.pronunciationAudio;

      // If audio is not pre-fetched (e.g., for old history items), fetch it now.
      if (!base64Audio) {
        console.warn(`Pronunciation not found for "${word}", fetching on demand.`);
        base64Audio = await getPronunciation(word);
        
        // Cache the fetched audio for future use
        const updatedWord = { ...currentWordData, pronunciationAudio: base64Audio };
        
        // Update the results array which drives the current view
        setResults(prev => {
          const newResults = [...prev];
          newResults[currentIndex] = updatedWord;
          return newResults;
        });
        
        // Update the history array for persistence across views
        updateHistoryItem(updatedWord);
      }

      const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const audioBuffer = await decodeAudioData(
        decode(base64Audio!), // We are confident it's a string by this point
        outputAudioContext,
        24000,
        1,
      );
      const source = outputAudioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(outputAudioContext.destination);
      source.start();
    } catch (err) {
      console.error("Pronunciation error:", err);
      setError("Could not pronounce the word.");
    } finally {
      setIsPronouncing(prev => ({ ...prev, [word]: false }));
    }
  };

  const difficultyColor = (difficulty: string) => {
    switch (difficulty?.toLowerCase()) {
      case 'easy':
        return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
      case 'hard':
        return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2">
        <form onSubmit={handleFormSubmit} className="mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-grow">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter word(s), comma separated"
                className="w-full pl-4 pr-12 py-3 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              />
              <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-blue-500 transition-colors">
                <SearchIcon className="w-6 h-6" />
              </button>
            </div>
            <select
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              className="px-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            >
              {[...Array(8)].map((_, i) => {
                  const grade = i + 1;
                  const suffix = grade === 1 ? 'st' : grade === 2 ? 'nd' : grade === 3 ? 'rd' : 'th';
                  const gradeText = `${grade}${suffix} Grader`;
                  return <option key={i} value={gradeText}>{gradeText}</option>;
              })}
            </select>
          </div>
        </form>

        {isLoading && <div className="flex justify-center items-center h-64"><LoaderIcon className="w-12 h-12 animate-spin text-blue-500" /></div>}
        {error && <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg" role="alert">{error}</div>}
        
        {currentWordData && (
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg animate-fade-in">
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <h2 className="text-4xl font-bold text-slate-900 dark:text-white capitalize">{currentWordData.word}</h2>
                  {currentWordData.difficulty && (
                      <span className={`px-3 py-1 text-sm font-semibold rounded-full ${difficultyColor(currentWordData.difficulty)}`}>
                          {currentWordData.difficulty}
                      </span>
                  )}
                </div>
                <button onClick={() => handlePronunciation(currentWordData.word)} disabled={isPronouncing[currentWordData.word]} className="p-2 rounded-full text-slate-500 hover:bg-blue-100 dark:hover:bg-slate-700 disabled:opacity-50 flex-shrink-0 ml-4">
                    {isPronouncing[currentWordData.word] ? <LoaderIcon className="w-6 h-6 animate-spin"/> : <VolumeUpIcon className="w-6 h-6"/>}
                </button>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-blue-500 uppercase tracking-wider mb-2">Definition</h3>
                <p className="text-slate-600 dark:text-slate-300">{currentWordData.definition}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-blue-500 uppercase tracking-wider mb-2">Example Sentences</h3>
                <ul className="space-y-2 list-disc list-inside">
                  {currentWordData.exampleSentences.map((sentence, index) => (
                    <li key={index} className="text-slate-600 dark:text-slate-300 italic">
                      "{sentence}"
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-blue-500 uppercase tracking-wider mb-2 flex items-center">
                    <span>Explained for a {gradeLevel}</span>
                    {isUpdating && <LoaderIcon className="w-4 h-4 ml-2 animate-spin" />}
                </h3>
                <p className={`text-slate-600 dark:text-slate-300 transition-opacity ${isUpdating ? 'opacity-50' : 'opacity-100'}`}>
                    {currentWordData.simplifiedExplanation}
                </p>
              </div>
            </div>
            
            {results.length > 1 && (
              <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button onClick={() => setCurrentIndex((prev) => (prev - 1 + results.length) % results.length)} className="flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition">
                  <ArrowLeftIcon className="w-4 h-4"/>
                  <span>Previous</span>
                </button>
                <span className="text-sm text-slate-500">{currentIndex + 1} / {results.length}</span>
                <button onClick={() => setCurrentIndex((prev) => (prev + 1) % results.length)} className="flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition">
                  <span>Next</span>
                  <ArrowRightIcon className="w-4 h-4"/>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="lg:col-span-1">
        <h3 className="text-xl font-bold mb-4">Search History</h3>
        {history.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400">Your searched words will appear here.</p>
        ) : (
          <ul className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-lg max-h-96 overflow-y-auto">
            {history.map((item, index) => (
              <li key={`${item.word}-${index}`} className="border-b border-slate-200 dark:border-slate-700 last:border-b-0">
                <button onClick={() => handleHistoryClick(item.word)} className="w-full text-left flex justify-between items-center py-3 px-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                  <span className="font-medium capitalize">{item.word}</span>
                  <ChevronRightIcon className="w-5 h-5 text-slate-400"/>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};