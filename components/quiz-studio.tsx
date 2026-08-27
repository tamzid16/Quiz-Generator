"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Check,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Gauge,
  GraduationCap,
  Lightbulb,
  RotateCcw,
  Sparkles,
  TimerReset,
  UploadCloud,
  X,
  XCircle,
} from "lucide-react";
import { generateQuiz, gradeShortAnswer } from "@/lib/quiz-engine";
import { SAMPLE_NOTES } from "@/lib/sample-notes";
import { Difficulty, QuestionMode, QuizQuestion, UserAnswer } from "@/lib/types";

const labels: Record<QuestionMode, string> = {
  mcq: "MCQ",
  "true-false": "True / False",
  short: "Short Question",
  mixed: "Mixed",
};

const difficultyTime: Record<Difficulty, number> = { easy: 50, medium: 70, hard: 90 };

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const min = Math.floor(safe / 60).toString().padStart(2, "0");
  const sec = (safe % 60).toString().padStart(2, "0");
  return `${min}:${sec}`;
}

function answerFor(question: QuizQuestion, value: string) {
  if (question.type === "short") return gradeShortAnswer(value, question);
  const correct = value.trim() === question.answer.trim();
  return { correct, points: correct ? 1 : 0 };
}

export function QuizStudio() {
  const [phase, setPhase] = useState<"setup" | "exam" | "results">("setup");
  const [source, setSource] = useState("");
  const [sourceName, setSourceName] = useState("Lecture notes");
  const [mode, setMode] = useState<QuestionMode>("mixed");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [count, setCount] = useState(10);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [draft, setDraft] = useState("");
  const [answers, setAnswers] = useState<UserAnswer[]>([]);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const totalSeconds = useMemo(() => difficultyTime[difficulty] * Math.max(3, count), [difficulty, count]);
  const active = questions[current];
  const currentAnswer = answers.find((answer) => answer.questionId === active?.id);
  const score = useMemo(() => answers.reduce((sum, answer) => sum + answer.points, 0), [answers]);
  const percentage = questions.length ? Math.round((score / questions.length) * 100) : 0;

  useEffect(() => {
    if (phase !== "exam") return;
    if (secondsLeft <= 0) {
      finishQuiz();
      return;
    }
    const timer = window.setInterval(() => setSecondsLeft((value) => value - 1), 1000);
    return () => window.clearInterval(timer);
  }, [phase, secondsLeft]);

  async function handleFile(file?: File) {
    if (!file) return;
    setMessage("");
    setUploading(true);
    try {
      if (file.size > 12 * 1024 * 1024) throw new Error("Please keep files under 12 MB for this demo.");
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/extract", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not read the file.");
      setSource(data.text);
      setSourceName(file.name);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not read the file.");
    } finally {
      setUploading(false);
    }
  }

  function loadDemo() {
    setSource(SAMPLE_NOTES);
    setSourceName("Cellular Respiration — Sample Notes");
    setMessage("");
  }

  function createQuiz() {
    setMessage("");
    try {
      if (source.trim().length < 180) throw new Error("Paste or upload a little more lecture material before generating the quiz.");
      const nextQuestions = generateQuiz(source, mode, difficulty, count);
      setQuestions(nextQuestions);
      setCurrent(0);
      setDraft("");
      setAnswers([]);
      setFeedbackOpen(false);
      setSecondsLeft(difficultyTime[difficulty] * nextQuestions.length);
      setStartedAt(Date.now());
      setPhase("exam");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not generate the quiz.");
    }
  }

  function submitCurrent() {
    if (!active || !draft.trim() || currentAnswer) return;
    const grade = answerFor(active, draft);
    const elapsed = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    setAnswers((items) => [
      ...items,
      {
        questionId: active.id,
        value: draft.trim(),
        correct: grade.correct,
        points: grade.points,
        secondsSpent: elapsed,
      },
    ]);
    setFeedbackOpen(true);
  }

  function goNext() {
    if (current >= questions.length - 1) {
      finishQuiz();
      return;
    }
    setCurrent((value) => value + 1);
    setDraft("");
    setFeedbackOpen(false);
    setStartedAt(Date.now());
  }

  function goPrevious() {
    if (current <= 0) return;
    const previous = questions[current - 1];
    const saved = answers.find((answer) => answer.questionId === previous.id);
    setCurrent((value) => value - 1);
    setDraft(saved?.value || "");
    setFeedbackOpen(Boolean(saved));
    setStartedAt(Date.now());
  }

  function finishQuiz() {
    setPhase("results");
  }

  function restart() {
    setPhase("setup");
    setQuestions([]);
    setAnswers([]);
    setCurrent(0);
    setDraft("");
    setFeedbackOpen(false);
  }

  function downloadResults() {
    const rows = questions.map((question, index) => {
      const response = answers.find((answer) => answer.questionId === question.id);
      return `
        <section class="item">
          <div class="eyebrow">Question ${index + 1} · ${question.type.replace("-", " ")}</div>
          <h2>${escapeHtml(question.prompt)}</h2>
          <p><strong>Your answer:</strong> ${escapeHtml(response?.value || "Not answered")}</p>
          <p><strong>Reference answer:</strong> ${escapeHtml(question.answer)}</p>
          <p><strong>Explanation:</strong> ${escapeHtml(question.explanation)}</p>
        </section>`;
    }).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Quiz Results</title><style>body{font-family:Inter,Arial,sans-serif;max-width:860px;margin:40px auto;padding:0 24px;color:#18223a;background:#fbfaf7}.hero{border-bottom:4px solid #f0b232;padding-bottom:24px;margin-bottom:32px}.score{font-size:52px;font-weight:800;color:#3155d9}.item{padding:24px 0;border-bottom:1px solid #ddd}.eyebrow{font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#667085}h2{font-size:20px}p{line-height:1.6}</style></head><body><div class="hero"><div class="eyebrow">Smart Quiz Generator</div><h1>${escapeHtml(sourceName)}</h1><div class="score">${percentage}%</div><p>${score.toFixed(1)} / ${questions.length} points</p></div>${rows}</body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "quiz-results.html";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (phase === "exam") {
    return (
      <main className="shell exam-shell">
        <header className="topbar exam-topbar">
          <button className="brand brand-button" onClick={restart} aria-label="Back to quiz setup">
            <span className="brand-mark"><GraduationCap size={21} /></span>
            <span>Smart Quiz</span>
          </button>
          <div className={`timer ${secondsLeft < 60 ? "timer-hot" : ""}`}>
            <Clock3 size={17} />
            <span>{formatTime(secondsLeft)}</span>
          </div>
          <button className="ghost-button" onClick={finishQuiz}>Finish exam</button>
        </header>

        <section className="exam-layout">
          <aside className="question-rail">
            <div className="rail-kicker">Progress</div>
            <div className="rail-score">{answers.length}<span>/{questions.length}</span></div>
            <div className="rail-list">
              {questions.map((question, index) => {
                const saved = answers.find((answer) => answer.questionId === question.id);
                return (
                  <button
                    key={question.id}
                    className={`rail-dot ${index === current ? "active" : ""} ${saved ? (saved.correct ? "done-good" : "done-bad") : ""}`}
                    onClick={() => {
                      setCurrent(index);
                      setDraft(saved?.value || "");
                      setFeedbackOpen(Boolean(saved));
                      setStartedAt(Date.now());
                    }}
                    aria-label={`Go to question ${index + 1}`}
                  >{index + 1}</button>
                );
              })}
            </div>
          </aside>

          <section className="question-stage">
            <div className="question-meta">
              <span className="question-number">Question {current + 1} of {questions.length}</span>
              <span className="type-chip">{active?.type === "mcq" ? "Multiple choice" : active?.type === "true-false" ? "True / False" : "Short answer"}</span>
            </div>
            <div className="progress-track"><div style={{ width: `${((current + 1) / questions.length) * 100}%` }} /></div>

            <article className="question-card">
              <div className="question-glyph">{String(current + 1).padStart(2, "0")}</div>
              <h1>{active?.prompt}</h1>

              {active?.type !== "short" ? (
                <div className="option-grid">
                  {active?.options?.map((option, index) => {
                    const selected = draft === option;
                    const isAnswer = feedbackOpen && option === active.answer;
                    const isWrong = feedbackOpen && selected && option !== active.answer;
                    return (
                      <button
                        key={`${option}-${index}`}
                        className={`option ${selected ? "selected" : ""} ${isAnswer ? "answer-good" : ""} ${isWrong ? "answer-bad" : ""}`}
                        onClick={() => !currentAnswer && setDraft(option)}
                        disabled={Boolean(currentAnswer)}
                      >
                        <span className="option-letter">{String.fromCharCode(65 + index)}</span>
                        <span>{option}</span>
                        {isAnswer && <CheckCircle2 size={19} />}
                        {isWrong && <XCircle size={19} />}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="short-wrap">
                  <label htmlFor="short-answer">Your answer</label>
                  <textarea
                    id="short-answer"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    disabled={Boolean(currentAnswer)}
                    placeholder="Write a concise answer in your own words…"
                  />
                  <span>Short answers are checked against the key concepts in your notes.</span>
                </div>
              )}

              {feedbackOpen && currentAnswer && (
                <div className={`feedback ${currentAnswer.correct ? "feedback-good" : "feedback-bad"}`}>
                  <div className="feedback-title">
                    {currentAnswer.correct ? <Check size={18} /> : <Lightbulb size={18} />}
                    {currentAnswer.correct ? "Good answer" : "Review this one"}
                  </div>
                  <p>{active?.explanation}</p>
                  {active?.type === "short" && <p><strong>Reference answer:</strong> {active.answer}</p>}
                </div>
              )}

              <div className="question-actions">
                <button className="text-button" onClick={goPrevious} disabled={current === 0}><ArrowLeft size={17} /> Previous</button>
                {!currentAnswer ? (
                  <button className="primary-button" onClick={submitCurrent} disabled={!draft.trim()}>Check answer <Check size={17} /></button>
                ) : (
                  <button className="primary-button" onClick={goNext}>{current === questions.length - 1 ? "See results" : "Next question"} <ArrowRight size={17} /></button>
                )}
              </div>
            </article>
          </section>
        </section>
      </main>
    );
  }

  if (phase === "results") {
    const correct = answers.filter((answer) => answer.correct).length;
    const skipped = questions.length - answers.length;
    const avgTime = answers.length ? Math.round(answers.reduce((sum, answer) => sum + answer.secondsSpent, 0) / answers.length) : 0;
    const typeStats = ["mcq", "true-false", "short"].map((type) => {
      const typeQuestions = questions.filter((question) => question.type === type);
      const typeAnswers = answers.filter((answer) => typeQuestions.some((question) => question.id === answer.questionId));
      const earned = typeAnswers.reduce((sum, answer) => sum + answer.points, 0);
      return { type, total: typeQuestions.length, percent: typeQuestions.length ? Math.round((earned / typeQuestions.length) * 100) : 0 };
    }).filter((item) => item.total > 0);

    return (
      <main className="shell results-shell">
        <header className="topbar">
          <div className="brand"><span className="brand-mark"><GraduationCap size={21} /></span><span>Smart Quiz</span></div>
          <button className="ghost-button" onClick={restart}><RotateCcw size={16} /> New quiz</button>
        </header>

        <section className="results-hero">
          <div>
            <span className="eyebrow">Exam complete</span>
            <h1>{percentage >= 80 ? "Strong performance." : percentage >= 60 ? "Good foundation." : "Worth another pass."}</h1>
            <p>{sourceName}</p>
          </div>
          <div className="score-orbit">
            <div className="score-ring" style={{ "--score": `${percentage * 3.6}deg` } as CSSProperties}>
              <div><strong>{percentage}%</strong><span>score</span></div>
            </div>
          </div>
        </section>

        <section className="metric-grid">
          <div className="metric-card"><CheckCircle2 size={20} /><div><strong>{correct}</strong><span>Correct answers</span></div></div>
          <div className="metric-card"><XCircle size={20} /><div><strong>{answers.length - correct}</strong><span>Needs review</span></div></div>
          <div className="metric-card"><Clock3 size={20} /><div><strong>{avgTime}s</strong><span>Avg. per answer</span></div></div>
          <div className="metric-card"><Gauge size={20} /><div><strong>{skipped}</strong><span>Not answered</span></div></div>
        </section>

        <section className="results-grid">
          <article className="analytics-card">
            <div className="section-heading"><div><span className="eyebrow">Accuracy</span><h2>Performance by question type</h2></div><BarChart3 size={20} /></div>
            <div className="bars">
              {typeStats.map((item) => (
                <div className="bar-row" key={item.type}>
                  <div><span>{item.type === "mcq" ? "MCQ" : item.type === "true-false" ? "True / False" : "Short answer"}</span><strong>{item.percent}%</strong></div>
                  <div className="bar-track"><div style={{ width: `${item.percent}%` }} /></div>
                </div>
              ))}
            </div>
            <div className="result-note"><Sparkles size={18} /><p>{percentage >= 80 ? "You handled the core concepts well. Review the missed questions once, then try a harder set." : percentage >= 60 ? "You understand most of the material. Focus your next attempt on the questions marked for review." : "Revisit the source notes, especially the explanations below, then generate a fresh quiz at the same difficulty."}</p></div>
          </article>

          <article className="summary-card">
            <span className="eyebrow">Session</span>
            <h2>{score.toFixed(1)} / {questions.length} points</h2>
            <dl>
              <div><dt>Question set</dt><dd>{labels[mode]}</dd></div>
              <div><dt>Difficulty</dt><dd className="capitalize">{difficulty}</dd></div>
              <div><dt>Questions</dt><dd>{questions.length}</dd></div>
              <div><dt>Time remaining</dt><dd>{formatTime(secondsLeft)}</dd></div>
            </dl>
            <button className="primary-button full-button" onClick={downloadResults}><Download size={17} /> Download results</button>
          </article>
        </section>

        <section className="review-section">
          <div className="section-heading"><div><span className="eyebrow">Answer review</span><h2>See what you knew—and what to revisit</h2></div></div>
          <div className="review-list">
            {questions.map((question, index) => {
              const response = answers.find((answer) => answer.questionId === question.id);
              return (
                <details className="review-item" key={question.id}>
                  <summary>
                    <span className={`review-status ${response?.correct ? "status-good" : "status-bad"}`}>{response?.correct ? <Check size={15} /> : <X size={15} />}</span>
                    <span><small>Question {index + 1}</small>{question.prompt}</span>
                    <strong>{response?.correct ? "+1" : response?.points ? `+${response.points.toFixed(1)}` : "0"}</strong>
                  </summary>
                  <div className="review-body">
                    <p><b>Your answer:</b> {response?.value || "Not answered"}</p>
                    <p><b>Reference answer:</b> {question.answer}</p>
                    <p>{question.explanation}</p>
                  </div>
                </details>
              );
            })}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark"><GraduationCap size={21} /></span><span>Smart Quiz</span></div>
        <div className="top-tag"><TimerReset size={16} /> Build a practice exam in seconds</div>
      </header>

      <section className="hero-grid">
        <div className="hero-copy">
          <span className="eyebrow">Practice studio</span>
          <h1>Turn your notes into an <em>exam that fights back.</em></h1>
          <p>Upload lecture material, choose the kind of questions you want, and work through a timed practice set with instant explanations and a clear performance breakdown.</p>
          <div className="hero-points">
            <span><CheckCircle2 size={16} /> Source-based questions</span>
            <span><Clock3 size={16} /> Timed exam mode</span>
            <span><BarChart3 size={16} /> Result analytics</span>
          </div>
        </div>
        <div className="hero-ticket" aria-hidden="true">
          <div className="ticket-top"><span>QUIZ SET</span><strong>10</strong></div>
          <div className="ticket-lines"><i></i><i></i><i></i><i></i></div>
          <div className="ticket-bottom"><span>MIXED</span><span>MEDIUM</span><span>11:40</span></div>
        </div>
      </section>

      <section className="builder-grid">
        <article className="source-card">
          <div className="step-label"><span>01</span> Add your material</div>
          <div
            className={`dropzone ${uploading ? "dropzone-loading" : ""}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              handleFile(event.dataTransfer.files?.[0]);
            }}
          >
            <input ref={fileInput} hidden type="file" accept=".pdf,.txt,.md" onChange={(event) => handleFile(event.target.files?.[0])} />
            <span className="upload-icon"><UploadCloud size={24} /></span>
            <h3>{uploading ? "Reading your file…" : "Drop a PDF here"}</h3>
            <p>or upload TXT / Markdown lecture notes</p>
            <button className="outline-button" onClick={() => fileInput.current?.click()} disabled={uploading}><FileText size={16} /> Choose file</button>
          </div>

          <div className="or-line"><span>OR</span></div>

          <label className="notes-label" htmlFor="notes">Paste lecture notes</label>
          <textarea
            id="notes"
            className="notes-area"
            value={source}
            onChange={(event) => {
              setSource(event.target.value);
              setSourceName("Pasted lecture notes");
            }}
            placeholder="Paste a chapter, lecture transcript, class notes, or revision sheet…"
          />
          <div className="source-footer">
            <span>{source.trim() ? `${source.trim().split(/\s+/).length.toLocaleString()} words ready` : "Nothing added yet"}</span>
            <button className="link-button" onClick={loadDemo}>Use sample notes</button>
          </div>
        </article>

        <article className="settings-card">
          <div className="step-label"><span>02</span> Shape the exam</div>

          <fieldset>
            <legend>Question type</legend>
            <div className="choice-grid two-col">
              {(["mcq", "true-false", "short", "mixed"] as QuestionMode[]).map((item) => (
                <button key={item} className={`choice-button ${mode === item ? "active" : ""}`} onClick={() => setMode(item)}>
                  <span className="choice-radio">{mode === item && <i />}</span>
                  <span>{labels[item]}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Difficulty</legend>
            <div className="segmented">
              {(["easy", "medium", "hard"] as Difficulty[]).map((item) => (
                <button key={item} className={difficulty === item ? "active" : ""} onClick={() => setDifficulty(item)}>{item}</button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <div className="legend-row"><legend>Questions</legend><strong>{count}</strong></div>
            <input className="range" type="range" min="3" max="20" step="1" value={count} onChange={(event) => setCount(Number(event.target.value))} />
            <div className="range-labels"><span>3</span><span>10</span><span>20</span></div>
          </fieldset>

          <div className="estimate-card">
            <Clock3 size={20} />
            <div><span>Estimated exam time</span><strong>{Math.ceil(totalSeconds / 60)} minutes</strong></div>
          </div>

          {message && <div className="error-message">{message}</div>}

          <button className="generate-button" onClick={createQuiz}><BookOpenCheck size={19} /> Generate practice exam <ArrowRight size={18} /></button>
          <p className="settings-note">Questions and explanations are generated from the material you provide.</p>
        </article>
      </section>

      <section className="feature-strip">
        <div><span>01</span><strong>Answer at your pace</strong><p>A clean, focused question view with visible progress.</p></div>
        <div><span>02</span><strong>Learn immediately</strong><p>Check each response and see the source-grounded explanation.</p></div>
        <div><span>03</span><strong>Review the pattern</strong><p>Finish with accuracy, timing, score, and answer review.</p></div>
      </section>
    </main>
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
