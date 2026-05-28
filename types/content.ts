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
    question: string;
    answer: string;
    solution: string;
  }>;
  essayQuestions: Array<{
    question: string;
    modelAnswer: string;
  }>;
  rubric: unknown;
  gameActivities: Array<{
    title: string;
    duration: string;
    materials: string;
    procedure: string;
    variation: string;
    aiPrompt: string;
  }>;
  teacherTips: {
    intro: string;
    development: string;
    wrapUp: string;
  };
};
