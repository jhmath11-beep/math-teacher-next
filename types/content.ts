export type AchievementStandard = {
  code: string;
  description: string;
  relation: "직접 추출" | "후보" | string;
};

export type GeneratedContent = {
  achievementStandards?: AchievementStandard[];
  summary: string[];
  checkQuizzes: Array<{
    difficulty: string;
    type: string;
    question: string;
    choices?: string[];
    answer: string;
    explanation?: string;
  }>;
  examQuestions: Array<{
    difficulty?: string;
    question: string;
    choices?: string[];
    answer: string;
    solution: string;
  }>;
  essayQuestions: Array<{
    title?: string;
    scenario?: string;
    passages?: Array<{ label: string; text: string }>;
    subQuestions?: Array<{ number: string; question: string; answer: string }>;
    question: string;
    modelAnswer: string;
  }>;
  rubric: unknown;
  // 논술형을 실전 평가지 수준으로 내기 위해 마크다운 문자열로 생성한다(표·LaTeX 포함).
  // 존재하면 구조화 essayQuestions/rubric 대신 이 마크다운을 렌더링한다.
  essayMarkdown?: string;
  gameActivities: Array<{
    title: string;
    duration: string;
    target?: string;
    materials: string;
    procedure: string | string[];
    variation: string | string[];
    teacherGuide?: string;
    aiPrompt: string;
  }>;
  teacherTips: {
    intro: string;
    development: string;
    wrapUp: string;
  };
};
