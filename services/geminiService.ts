
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { WordData, QuizQuestion } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const wordDataSchema = {
  type: Type.OBJECT,
  properties: {
    word: {
      type: Type.STRING,
      description: "The vocabulary word.",
    },
    definition: {
      type: Type.STRING,
      description: "A comprehensive and accurate definition of the word from a trusted source.",
    },
    exampleSentence: {
      type: Type.STRING,
      description: "A sentence that correctly uses the word in context.",
    },
    simplifiedExplanation: {
      type: Type.STRING,
      description: "An explanation of the word's meaning, simplified for the target grade level.",
    },
  },
  required: ["word", "definition", "exampleSentence", "simplifiedExplanation"],
};

export async function fetchWordData(word: string, gradeLevel: string): Promise<WordData> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `For the word "${word}", provide a definition, an example sentence, and a simplified explanation suitable for a ${gradeLevel} student. The definition should be from a trusted dictionary source.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: wordDataSchema,
    },
  });

  const jsonString = response.text.trim();
  try {
    const data = JSON.parse(jsonString);
    return data as WordData;
  } catch (error) {
    console.error("Failed to parse JSON response:", jsonString);
    throw new Error("The API returned an unexpected format.");
  }
}

const quizQuestionSchema = {
    type: Type.OBJECT,
    properties: {
        question: { type: Type.STRING, description: "The quiz question, e.g., 'What is the definition of ubiquitous?'" },
        options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "An array of 4 strings: one correct definition and three plausible but incorrect definitions (distractors)."
        },
        correctAnswer: { type: Type.STRING, description: "The correct definition from the options array." }
    },
    required: ["question", "options", "correctAnswer"]
};

export async function generateQuizQuestion(targetWord: WordData, allWords: WordData[]): Promise<QuizQuestion> {
    const wordList = allWords.map(w => w.word).join(', ');
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Given the following list of vocabulary words: [${wordList}]. Create a multiple-choice quiz question for the word "${targetWord.word}". Provide one correct definition and three incorrect definitions (distractors) that are plausible for a 5th grader. The correct definition should be "${targetWord.definition}". The distractors could be definitions of other words in the provided list or common misconceptions. Ensure the options are shuffled.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: quizQuestionSchema,
        },
    });

    const jsonString = response.text.trim();
    try {
        const data = JSON.parse(jsonString);
        return { ...data, word: targetWord.word };
    } catch (error) {
        console.error("Failed to parse quiz JSON:", jsonString);
        throw new Error("Failed to generate a valid quiz question.");
    }
}


export async function getPronunciation(word: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: word }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });
  
  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error("No audio data returned from API.");
  }
  return base64Audio;
}
   