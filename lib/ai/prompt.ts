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
    "- 단순 정의 확인만 만들지 말고, 대표 오개념 확인, 반례 고르기, 조건 바꾸기, 빈칸 추론, 생활 맥락 적용을 섞으세요.",
    "- 각 문항은 교과서 예제를 그대로 복사하지 말고 숫자, 맥락, 조건, 표현 방식을 변형하세요.",
    "",
    "3. 시험대비문항",
    "- 교과서 개념을 적용한 문항 5개",
    "- 난이도: 보통 2문항, 어려움 2문항, 최상 1문항",
    "- 단순 계산만 묻지 말고, 개념 적용·오개념 판별·서술 풀이가 필요한 문항을 포함",
    "- 5문항 안에 다음 유형을 골고루 포함: 조건 변형형, 오류 수정형, 여러 표현 연결형, 실생활 맥락형, 단계적 추론형",
    "- 실제 학교 시험에서 변별력이 생기도록 한 문항 안에 2개 이상의 개념 연결 또는 판단 단계를 포함",
    "- 교과서 본문·예제·활동의 구조를 참고하되 숫자와 상황은 새롭게 변형",
    "- 각 문항에 difficulty, question, answer, solution을 반드시 포함",
    "- 풀이 과정은 학생이 따라 쓸 수 있도록 단계별로 제시",
    "",
    "4. 논술형 예시 문항",
    "- 서술 과정이 드러나는 문항 2개",
    "- 모범 답안 포함",
    "- 교과서 개념을 바탕으로 하되 설명, 정당화, 비교, 오류 분석 중 적어도 하나를 요구",
    "- 학생이 계산 결과만 쓰면 만점을 받을 수 없도록 사고 과정과 근거를 요구",
    "- 모범 답안은 채점자가 바로 기준으로 삼을 수 있도록 문장형 풀이로 자세히 작성",
    "",
    "5. 논술형 채점 루브릭",
    "- 바로 위의 논술형 예시 문항 2개 각각에 대한 루브릭을 제시",
    "- 표 형태로 렌더링할 수 있도록 scoringRubric 배열을 반드시 채움",
    "- 평가요소는 개념 이해, 풀이 과정, 표현의 정확성을 반드시 포함",
    "- 각 평가요소는 만점과 부분점수 기준을 levels 배열로 구체적으로 제시",
    "- essayRubrics에는 논술형 문항별로 rows를 3개 이상 채우고, high/middle/low 기준을 매우 구체적으로 작성",
    "- 부분점수 기준에는 '무엇을 쓰면 몇 점인지', '어떤 오류가 있으면 감점인지'가 드러나야 함",
    "- 평가 영역명, 영역 만점, 성취기준, 평가기준 상·중·하, 평가방법, 평가요소별 채점 기준으로 제시",
    "- 영역 만점은 20점 기준",
    "",
    "6. 게임 활동 제작용 프롬프트 제작",
    "- gameActivities 배열은 반드시 1개 이상 생성",
    "- 30~45분 수업 활동",
    "- 해당 소단원 개념을 즐겁게 연습하는 활동이어야 함",
    "- title, duration, target, materials, procedure, variation, teacherGuide, aiPrompt를 반드시 포함",
    "- procedure는 수업자가 바로 진행할 수 있도록 5단계 이상으로 자세히 작성",
    "- variation은 수준별 변형, 모둠 활동 변형, 디지털 도구 변형을 포함",
    "- aiPrompt는 바이브코딩/생성형 AI에 그대로 붙여 넣어 웹게임 또는 활동지를 만들 수 있는 상세 프롬프트로 작성",
    "",
    "7. 교사용 활용 팁",
    "- 수업 도입, 전개, 정리 단계별로 제안",
    "",
    "주의:",
    "- 교과서 내용에 근거해서 생성하세요.",
    "- 교과서에 없는 내용을 과도하게 확장하지 마세요.",
    "- 웹 검색을 사용할 수 있으면 중학교 수학 문항 유형과 활동 아이디어를 참고하되, 최종 문항은 반드시 제공된 교과서 텍스트와 성취기준 범위 안에서 새로 작성하세요.",
    "- 웹에서 찾은 문항을 그대로 베끼지 말고 구조만 참고하여 숫자, 조건, 맥락, 발문을 새롭게 만드세요.",
    "- 중학교 2학년 수준에 맞게 설명하세요.",
    "- 결과는 JSON 형식으로 반환하세요.",
    "- 반드시 아래 JSON 키 이름을 그대로 사용하세요. 한글 키 이름을 사용하지 마세요.",
    "- 수식은 깨지지 않도록 LaTeX 대신 일반 텍스트 수식 표기를 사용하세요. 예: 1/3, x^2, a/b, 0.\\overline{3} 대신 순환소수 0.333...처럼 설명",
    "- 특수 기호가 깨질 수 있으므로 ×, ÷, ≤, ≥ 대신 가능하면 *, /, <=, >= 또는 한글 설명을 사용하세요.",
    "- 빈 배열이나 빈 문자열을 반환하지 마세요. 모든 섹션을 반드시 채우세요.",
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
        { difficulty: "어려움", question: "시험대비문항", answer: "정답", solution: "풀이 과정" }
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
        essayRubrics: [
          {
            essayQuestionIndex: 1,
            essayQuestionTitle: "논술형 문항 요약",
            rows: [
              { criterion: "개념 이해", maxScore: 8, high: "8점 기준", middle: "4~6점 기준", low: "0~2점 기준" },
              { criterion: "풀이 과정", maxScore: 8, high: "8점 기준", middle: "4~6점 기준", low: "0~2점 기준" },
              { criterion: "표현의 정확성", maxScore: 4, high: "4점 기준", middle: "2~3점 기준", low: "0~1점 기준" }
            ]
          }
        ],
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
          target: "활동 목표",
          materials: "준비물",
          procedure: ["진행 단계 1", "진행 단계 2", "진행 단계 3", "진행 단계 4", "진행 단계 5"],
          variation: ["수준별 변형", "모둠 활동 변형", "디지털 도구 변형"],
          teacherGuide: "교사용 진행 안내",
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
