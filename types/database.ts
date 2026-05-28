export type BootstrapData = {
  grades: Array<{ id: string; name: string; order_index: number }>;
  publishers: Array<{ id: string; name: string; order_index: number; is_active: boolean }>;
  units: Array<{
    id: string;
    gradeId: string;
    publisherId: string;
    title: string;
    order: number;
  }>;
  subunits: Array<{
    id: string;
    unitId: string;
    title: string;
    achievementStandard: string;
    keywords: string[];
    status: string;
    order: number;
  }>;
  pdfTexts: Record<string, {
    fileName: string;
    filePath: string;
    text: string;
    updatedAt: string;
  }>;
  generated: Record<string, {
    content: unknown;
    source: string;
    model: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
};

export type CreateSubunitInput = {
  gradeName: string;
  publisherName: string;
  unitTitle: string;
  subunitTitle: string;
};
