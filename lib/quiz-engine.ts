import { Difficulty, QuestionMode, QuizQuestion } from "./types";

const STOP = new Set([
  "about","after","again","against","also","among","because","been","before","being","between","both","could","does","during","each","from","have","into","more","most","other","over","same","some","such","than","that","their","there","these","they","this","those","through","under","very","what","when","where","which","while","with","would","your","using","used","uses","only","then","them","were","will","without","within","process","system","results","result","study","data","paper","notes"
]);

function cleanText(input: string) {
  return input.replace(/\r/g, " ").replace(/\s+/g, " ").trim();
}

function sentencesFrom(input: string) {
  const text = cleanText(input);
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 45 && sentence.length <= 360);
}

function words(input: string) {
  return (input.toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) || []).filter((word) => !STOP.has(word));
}

function keywords(input: string, limit = 36) {
  const counts = new Map<string, number>();
  for (const word of words(input)) counts.set(word, (counts.get(word) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, limit)
    .map(([word]) => word);
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (m) => m.toUpperCase());
}

function seededIndex(seed: number, length: number) {
  if (!length) return 0;
  return Math.abs((seed * 9301 + 49297) % 233280) % length;
}

function trimSentence(sentence: string, max = 170) {
  return sentence.length <= max ? sentence : `${sentence.slice(0, max - 1).trim()}…`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pickSentenceForTerm(sentences: string[], term: string) {
  return sentences.find((sentence) => new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(sentence));
}

function distinctSentences(all: string[], correct: string, seed: number, count = 3) {
  const pool = all.filter((s) => s !== correct && s.length > 55);
  const chosen: string[] = [];
  let cursor = seed;
  while (chosen.length < count && pool.length) {
    const idx = seededIndex(cursor++, pool.length);
    const candidate = pool.splice(idx, 1)[0];
    if (!chosen.some((x) => x.slice(0, 45) === candidate.slice(0, 45))) chosen.push(candidate);
  }
  return chosen;
}

function makeMcq(term: string, sentence: string, sentences: string[], index: number, difficulty: Difficulty): QuizQuestion {
  const distractors = distinctSentences(sentences, sentence, index + term.length, 3);
  while (distractors.length < 3) distractors.push("This concept is described by a different mechanism elsewhere in the material.");
  const options = [trimSentence(sentence), ...distractors.map((d) => trimSentence(d))];
  const rotate = difficulty === "hard" ? (index * 3 + 1) % 4 : (index + 1) % 4;
  const rotated = [...options.slice(rotate), ...options.slice(0, rotate)];
  return {
    id: `q-${index + 1}`,
    type: "mcq",
    prompt: difficulty === "easy"
      ? `Which statement best explains ${titleCase(term)}?`
      : difficulty === "hard"
        ? `Which statement is most consistent with the role of ${titleCase(term)} in these notes?`
        : `Which statement correctly describes ${titleCase(term)}?`,
    options: rotated,
    answer: trimSentence(sentence),
    explanation: `The source material states: ${trimSentence(sentence, 220)}`,
    keyTerms: [term],
  };
}

function makeTrueFalse(term: string, sentence: string, terms: string[], index: number): QuizQuestion {
  const shouldBeFalse = index % 2 === 1 && terms.length > 1;
  let statement = trimSentence(sentence, 220);
  let answer = "True";
  let explanation = `This matches the source material: ${trimSentence(sentence, 220)}`;

  if (shouldBeFalse) {
    const replacement = terms.find((candidate) => candidate !== term && !sentence.toLowerCase().includes(candidate));
    if (replacement) {
      statement = trimSentence(sentence.replace(new RegExp(`\\b${escapeRegExp(term)}\\b`, "i"), replacement), 220);
      answer = "False";
      explanation = `The altered statement is not supported. The source uses “${term}” in this context: ${trimSentence(sentence, 200)}`;
    }
  }

  return {
    id: `q-${index + 1}`,
    type: "true-false",
    prompt: statement,
    options: ["True", "False"],
    answer,
    explanation,
    keyTerms: [term],
  };
}

function makeShort(term: string, sentence: string, index: number, difficulty: Difficulty): QuizQuestion {
  const prompt = difficulty === "hard"
    ? `Explain the role or significance of ${titleCase(term)} and connect it to the surrounding process.`
    : difficulty === "easy"
      ? `In one sentence, what is ${titleCase(term)}?`
      : `Briefly explain ${titleCase(term)} based on the lecture notes.`;
  const keyTerms = [term, ...words(sentence).filter((w) => w !== term).slice(0, difficulty === "hard" ? 5 : 3)];
  return {
    id: `q-${index + 1}`,
    type: "short",
    prompt,
    answer: trimSentence(sentence, 240),
    explanation: `A strong answer should capture this idea: ${trimSentence(sentence, 220)}`,
    keyTerms,
  };
}

export function generateQuiz(source: string, mode: QuestionMode, difficulty: Difficulty, requestedCount: number): QuizQuestion[] {
  const sentences = sentencesFrom(source);
  if (sentences.length < 3) throw new Error("Add a little more material so the quiz has enough context to build useful questions.");

  const terms = keywords(source, 50);
  const usable = terms
    .map((term) => ({ term, sentence: pickSentenceForTerm(sentences, term) }))
    .filter((entry): entry is { term: string; sentence: string } => Boolean(entry.sentence));

  const count = Math.max(3, Math.min(20, requestedCount || 10));
  const questions: QuizQuestion[] = [];
  const modes = mode === "mixed" ? (["mcq", "true-false", "short"] as const) : [mode];

  for (let i = 0; i < count; i++) {
    const entry = usable[i % Math.max(usable.length, 1)] || { term: "main idea", sentence: sentences[i % sentences.length] };
    const kind = modes[i % modes.length];
    if (kind === "mcq") questions.push(makeMcq(entry.term, entry.sentence, sentences, i, difficulty));
    else if (kind === "true-false") questions.push(makeTrueFalse(entry.term, entry.sentence, terms, i));
    else questions.push(makeShort(entry.term, entry.sentence, i, difficulty));
  }
  return questions;
}

export function gradeShortAnswer(value: string, question: QuizQuestion) {
  const normalized = new Set(words(value));
  if (!value.trim()) return { correct: false, points: 0 };
  const hits = question.keyTerms.filter((term) => normalized.has(term)).length;
  const threshold = question.keyTerms.length <= 3 ? 1 : 2;
  const correct = hits >= threshold;
  return { correct, points: correct ? 1 : Math.min(0.5, hits / Math.max(threshold, 1) / 2) };
}
