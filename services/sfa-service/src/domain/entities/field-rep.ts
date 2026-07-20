export type FieldRepStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'TERMINATED';

export interface FieldRepProps {
  id: string;
  tenantId: string;
  userId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: FieldRepStatus;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export class FieldRep {
  private props: FieldRepProps;

  private constructor(props: FieldRepProps) {
    this.props = { ...props };
  }

  static create(input: {
    id: string;
    tenantId: string;
    userId: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    status?: FieldRepStatus;
  }): FieldRep {
    if (!input.id || input.id.trim().length === 0) throw new Error('ID cannot be empty');
    if (!input.tenantId || input.tenantId.trim().length === 0) throw new Error('tenantId cannot be empty');
    if (!input.userId || input.userId.trim().length === 0) throw new Error('userId cannot be empty');
    if (!input.employeeCode || input.employeeCode.trim().length === 0) throw new Error('employeeCode cannot be empty');
    if (!input.firstName || input.firstName.trim().length === 0) throw new Error('firstName cannot be empty');
    if (!input.lastName || input.lastName.trim().length === 0) throw new Error('lastName cannot be empty');
    if (!input.email || !input.email.includes('@')) throw new Error('Invalid email format');
    if (!input.phone || input.phone.trim().length === 0) throw new Error('phone cannot be empty');

    const now = new Date();
    return new FieldRep({
      id: input.id,
      tenantId: input.tenantId,
      userId: input.userId,
      employeeCode: input.employeeCode,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      status: input.status ?? 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      version: 1,
    });
  }

  static fromPersistence(props: FieldRepProps): FieldRep {
    return new FieldRep(props);
  }

  get id(): string { return this.props.id; }
  get tenantId(): string { return this.props.tenantId; }
  get userId(): string { return this.props.userId; }
  get employeeCode(): string { return this.props.employeeCode; }
  get firstName(): string { return this.props.firstName; }
  get lastName(): string { return this.props.lastName; }
  get email(): string { return this.props.email; }
  get phone(): string { return this.props.phone; }
  get status(): FieldRepStatus { return this.props.status; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get version(): number { return this.props.version; }

  // State transitions methods
  updateInfo(input: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  }): void {
    if (this.props.status === 'TERMINATED') {
      throw new Error('Cannot update details of a terminated representative');
    }

    if (input.firstName !== undefined) {
      if (input.firstName.trim().length === 0) throw new Error('firstName cannot be empty');
      this.props.firstName = input.firstName;
    }
    if (input.lastName !== undefined) {
      if (input.lastName.trim().length === 0) throw new Error('lastName cannot be empty');
      this.props.lastName = input.lastName;
    }
    if (input.email !== undefined) {
      if (!input.email.includes('@')) throw new Error('Invalid email format');
      this.props.email = input.email;
    }
    if (input.phone !== undefined) {
      if (input.phone.trim().length === 0) throw new Error('phone cannot be empty');
      this.props.phone = input.phone;
    }

    this.props.updatedAt = new Date();
  }

  activate(): void {
    if (this.props.status === 'TERMINATED') {
      throw new Error('Cannot activate a terminated representative');
    }
    this.props.status = 'ACTIVE';
    this.props.updatedAt = new Date();
  }

  deactivate(): void {
    if (this.props.status === 'TERMINATED') {
      throw new Error('Cannot deactivate a terminated representative');
    }
    this.props.status = 'INACTIVE';
    this.props.updatedAt = new Date();
  }

  suspend(): void {
    if (this.props.status === 'TERMINATED') {
      throw new Error('Cannot suspend a terminated representative');
    }
    this.props.status = 'SUSPENDED';
    this.props.updatedAt = new Date();
  }

  terminate(): void {
    this.props.status = 'TERMINATED';
    this.props.updatedAt = new Date();
  }

  incrementVersion(): void {
    this.props.version += 1;
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.props.id,
      tenantId: this.props.tenantId,
      userId: this.props.userId,
      employeeCode: this.props.employeeCode,
      firstName: this.props.firstName,
      lastName: this.props.lastName,
      email: this.props.email,
      phone: this.props.phone,
      status: this.props.status,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
      version: this.props.version,
    };
  }
}
