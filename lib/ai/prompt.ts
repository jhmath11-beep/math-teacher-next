export function buildMathTeacherPrompt(input: {
  subunitTitle: string;
  extractedText: string;
  achievementStandard?: string;
}) {
  return [
    "다음은 중학교 수학 교과서의 특정 소단원 내용입니다.",
    "",
    "[소단원명]",
    input.subunitTitle,
    "",
    "[교과서 텍스트]",
    input.extractedText.slice(0, 18000),
    "",
    "[소단원에 연결된 성취기준]",
    input.achievementStandard || "관리자가 별도로 연결한 성취기준이 없습니다. 교과서 텍스트와 소단원명을 바탕으로 관련 성취기준 후보를 제시하세요.",
    "",
    "역할:",
    "너는 중학교 수학 교사이자 수업 설계 전문가입니다.",
    "",
    "다음 형식으로 수업 자료를 생성하세요.",
    "",
    "0. 과목별 단원별 성취기준",
    "- [소단원에 연결된 성취기준]이 있으면 그것을 최우선으로 사용",
    "- 직접 제시된 성취기준이 없으면 관련 성취기준 후보를 1~3개 제시",
    "",
    "1. 핵심 개념 요약",
    "- 학생 눈높이로 5줄 이내",
    "",
    "2. 확인 퀴즈",
    "- 객관식 또는 단답형 5문항",
    "- 정답 포함",
    "- 난이도: 쉬움 2문항, 보통 2문항, 어려움 1문항",
    "",
    "3. 시험대비문항",
    "- 교과서 개념을 적용한 기본 문항 5개",
    "- 풀이 과정 포함",
    "",
    "4. 논술형 예시 문항",
    "- 서술 과정이 드러나는 문항 2개",
    "- 모범 답안 포함",
    "",
    "5. 논술형 채점 루브릭",
    "- 평가 영역명, 영역 만점, 성취기준, 평가기준 상·중·하, 평가방법, 평가요소별 채점 기준으로 제시",
    "- 영역 만점은 20점 기준",
    "",
    "6. 게임 활동 제작용 프롬프트 제작",
    "- 30~45분 수업 활동",
    "- 준비물, 진행 방법, 변형 방법 포함",
    "- 다른 AI 또는 바이브코딩 도구에 그대로 붙여 넣을 수 있는 상세 프롬프트 포함",
    "",
    "7. 교사용 활용 팁",
    "- 수업 도입, 전개, 정리 단계별로 제안",
    "",
    "주의:",
    "- 교과서 내용에 근거해서 생성하세요.",
    "- 교과서에 없는 내용을 과도하게 확장하지 마세요.",
    "- 중학교 2학년 수준에 맞게 설명하세요.",
    "- 결과는 JSON 형식으로 반환하세요.",
    "- 반드시 아래 JSON 키 이름을 그대로 사용하세요. 한글 키 이름을 사용하지 마세요.",
    "",
    "JSON 구조:",
    JSON.stringify({
      achievementStandards: [
        { code: "9수01-06", description: "성취기준 문장", relation: "직접 연결" }
      ],
      summary: ["핵심 개념 요약 문장"],
      checkQuizzes: [
        {
          difficulty: "쉬움",
          type: "객관식",
          question: "문항",
          choices: ["선택지1", "선택지2", "선택지3", "선택지4"],
          answer: "정답",
          explanation: "간단한 해설"
        }
      ],
      examQuestions: [
        { question: "시험대비문항", answer: "정답", solution: "풀이 과정" }
      ],
      essayQuestions: [
        { question: "논술형 문항", modelAnswer: "모범 답안" }
      ],
      rubric: {
        assessmentAreaName: "평가 영역명",
        totalScore: 20,
        achievementStandards: ["[9수01-06] 성취기준"],
        achievementLevels: { high: "상", middle: "중", low: "하" },
        assessmentMethods: ["서술형"],
        scoringRubric: [
          {
            element: "개념 이해",
            maxScore: 8,
            levels: [
              { score: 8, description: "채점 기준" },
              { score: 4, description: "채점 기준" }
            ]
          }
        ],
        baseScore: { submittedBlank: 1, notSubmitted: 0, excusedAbsent: 0 }
      },
      gameActivities: [
        {
          title: "활동명",
          duration: "30~45분",
          materials: "준비물",
          procedure: "진행 방법",
          variation: "변형 방법",
          aiPrompt: "다른 AI나 바이브코딩 도구에 붙여 넣을 프롬프트"
        }
      ],
      teacherTips: {
        intro: "도입",
        development: "전개",
        wrapUp: "정리"
      }
    }, null, 2)
  ].join("\n");
}
