export interface Question {
  id: string;
  type: 'text' | 'choice' | 'rating' | 'boolean';
  text: string;
  options?: string[]; // for choice type
  required: boolean;
}

export interface ResponseItem {
  questionId: string;
  answer: string | number | boolean;
}

export interface SurveyProps {
  id: string;
  tenantId: string;
  outletId: string;
  agentId: string;
  questions: Question[];
  responses: ResponseItem[];
  completedAt?: Date;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class Survey {
  private props: SurveyProps;

  private constructor(props: SurveyProps) {
    this.props = {
      ...props,
      questions: [...props.questions],
      responses: [...props.responses],
    };
  }

  static create(input: {
    id: string;
    tenantId: string;
    outletId: string;
    agentId: string;
    questions: Question[];
  }): Survey {
    const now = new Date();
    return new Survey({
      ...input,
      responses: [],
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(props: SurveyProps): Survey {
    return new Survey(props);
  }

  get id(): string { return this.props.id; }
  get tenantId(): string { return this.props.tenantId; }
  get outletId(): string { return this.props.outletId; }
  get agentId(): string { return this.props.agentId; }
  get questions(): ReadonlyArray<Question> { return this.props.questions; }
  get responses(): ReadonlyArray<ResponseItem> { return this.props.responses; }
  get completedAt(): Date | undefined { return this.props.completedAt; }
  get version(): number { return this.props.version; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  /**
   * Submit responses for the survey
   */
  submitResponses(responses: ResponseItem[]): void {
    if (this.props.completedAt) {
      throw new Error('Survey is already completed');
    }

    // Validate required questions
    for (const q of this.props.questions) {
      if (q.required) {
        const found = responses.find((r) => r.questionId === q.id);
        if (!found) {
          throw new Error(`Missing response for required question: ${q.id}`);
        }
      }
    }

    this.props.responses = [...responses];
    this.props.completedAt = new Date();
    this.props.updatedAt = new Date();
  }
}
