
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
    exampleSentences: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "An array of at least two sentences that correctly use the word in context."
    },
    simplifiedExplanation: {
      type: Type.STRING,
      description: "An explanation of the word's meaning, simplified for the target grade level.",
    },
    difficulty: {
      type: Type.STRING,
      description: "The difficulty of the word for the target grade level. Should be one of: 'Easy', 'Medium', or 'Hard'."
    }
  },
  required: ["word", "definition", "exampleSentences", "simplifiedExplanation", "difficulty"],
};

const partialWordDataSchema = {
    type: Type.OBJECT,
    properties: {
        exampleSentences: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "An array of at least two new sentences that correctly use the word in context, suitable for the new grade level."
        },
        simplifiedExplanation: {
            type: Type.STRING,
            description: "A new explanation of the word's meaning, simplified for the target grade level."
        }
    },
    required: ["exampleSentences", "simplifiedExplanation"],
};

export async function fetchWordData(word: string, gradeLevel: string): Promise<WordData> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `For the word "${word}", provide a definition, an array of at least two example sentences, a simplified explanation suitable for a ${gradeLevel}, and a difficulty rating ('Easy', 'Medium', or 'Hard') for this word for that grade level. The definition should be from a trusted dictionary source.`,
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

export async function fetchPartialWordData(word: string, gradeLevel: string): Promise<Pick<WordData, 'exampleSentences' | 'simplifiedExplanation'>> {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `For the word "${word}", provide a new simplified explanation and an array of at least two new example sentences suitable for a ${gradeLevel}. Do not provide the definition, word, or difficulty.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: partialWordDataSchema,
        },
    });

    const jsonString = response.text.trim();
    try {
        const data = JSON.parse(jsonString);
        return data as Pick<WordData, 'exampleSentences' | 'simplifiedExplanation'>;
    } catch (error) {
        console.error("Failed to parse partial JSON response:", jsonString);
        throw new Error("The API returned an unexpected format for the partial update.");
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
        contents: `Create a multiple-choice quiz question for the word "${targetWord.word}". The question should ask for the definition of the word. Provide 4 answer options: one must be the correct definition, which is "${targetWord.definition}", and the other three must be plausible but incorrect definitions (distractors) suitable for a 5th grader. You can use definitions of other words from this list as distractors: [${wordList}].`,
        config: {
            responseMimeType: "application/json",
            responseSchema: quizQuestionSchema,
        },
    });

    const jsonString = response.text.trim();
    try {
        const data = JSON.parse(jsonString);
        return { 
            ...data, 
            word: targetWord.word,
            explanation: targetWord.simplifiedExplanation 
        };
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