import { Question, ShuffledQuestion, ContestConfig, ExamSession, CandidateInfo } from '../types/quiz';
import { DEFAULT_QUESTIONS, DEFAULT_CONTEST_CONFIG } from '../data/defaultQuestions';

const STORAGE_KEYS = {
  QUESTIONS: 'vksnd_kv3_questions_v2',
  CONFIG: 'vksnd_kv3_config_v2',
  SUBMISSIONS: 'vksnd_kv3_submissions_v2',
  ACTIVE_SESSION: 'vksnd_kv3_active_session_v2',
};

export const StorageService = {
  getQuestions(): Question[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.QUESTIONS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    this.saveQuestions(DEFAULT_QUESTIONS);
    return DEFAULT_QUESTIONS;
  },

  saveQuestions(questions: Question[]): void {
    localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));
  },

  resetQuestions(): Question[] {
    localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(DEFAULT_QUESTIONS));
    return DEFAULT_QUESTIONS;
  },

  getConfig(): ContestConfig {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CONFIG);
      if (data) {
        return { ...DEFAULT_CONTEST_CONFIG, ...JSON.parse(data) };
      }
    } catch {
      // ignore
    }
    this.saveConfig(DEFAULT_CONTEST_CONFIG);
    return DEFAULT_CONTEST_CONFIG;
  },

  saveConfig(config: ContestConfig): void {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
  },

  getSubmissions(): ExamSession[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SUBMISSIONS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return [];
  },

  saveSubmission(session: ExamSession): ExamSession[] {
    const list = this.getSubmissions();
    const updated = [session, ...list.filter((s) => s.id !== session.id)];
    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(updated));
    return updated;
  },

  clearSubmissions(): void {
    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify([]));
  },

  getActiveSession(): ExamSession | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
      if (data) {
        return JSON.parse(data);
      }
    } catch {
      // ignore
    }
    return null;
  },

  saveActiveSession(session: ExamSession | null): void {
    if (!session) {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
    } else {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(session));
    }
  },
};

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Generate randomized exam session for candidate
 */
export function generateExamSession(
  candidate: CandidateInfo,
  config: ContestConfig,
  questionsPool: Question[]
): ExamSession {
  let pool = [...questionsPool];

  // Shuffle question list
  if (config.shuffleQuestions) {
    pool = shuffleArray(pool);
  }

  // Take requested count (default 50)
  const count = Math.min(config.questionsCount, pool.length);
  const selectedPool = pool.slice(0, count);

  const examQuestions: ShuffledQuestion[] = selectedPool.map((q, idx) => {
    let options = [...q.options];

    // Track which text was correct before shuffling
    const correctOption = q.options.find((o) => o.id === q.correctOptionId);
    const correctText = correctOption ? correctOption.text : '';

    if (config.shuffleOptions) {
      options = shuffleArray(options);
    }

    const alphabet = ['A', 'B', 'C', 'D', 'E', 'F'];
    let newCorrectId = 'A';

    const normalizedOptions = options.map((opt, optIdx) => {
      const newId = alphabet[optIdx] || opt.id;
      if (opt.text === correctText) {
        newCorrectId = newId;
      }
      return {
        id: newId,
        text: opt.text,
      };
    });

    return {
      originalId: q.id,
      displayIndex: idx + 1,
      question: q.question,
      options: normalizedOptions,
      correctOptionId: newCorrectId,
      category: q.category,
    };
  });

  const now = Date.now();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const certCode = `VKS3-QT-${new Date().getFullYear()}-${randomSuffix}`;

  return {
    id: `exam-${now}-${Math.random().toString(36).substring(2, 7)}`,
    certificateCode: certCode,
    candidate,
    startTime: now,
    timeSpentSeconds: 0,
    questions: examQuestions,
    answers: {},
    flagged: [],
    score: 0,
    correctCount: 0,
    totalQuestions: examQuestions.length,
    submittedAt: '',
    phoneRecipient: config.organizerPhone || '09837645',
  };
}
