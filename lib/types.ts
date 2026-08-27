export type QuestionType = "mcq" | "true-false" | "short";
export type QuestionMode = QuestionType | "mixed";
export type Difficulty = "easy" | "medium" | "hard";

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  options?: string[];
  answer: string;
  explanation: string;
  keyTerms: string[];
}

export interface UserAnswer {
  questionId: string;
  value: string;
  correct: boolean;
  points: number;
  secondsSpent: number;
}
