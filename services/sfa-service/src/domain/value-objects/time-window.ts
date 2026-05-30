/**
 * Immutable TimeWindow value object.
 * Represents a closed time range [start, end].
 */
export class TimeWindow {
  public readonly start: Date;
  public readonly end: Date;

  private constructor(start: Date, end: Date) {
    if (end.getTime() < start.getTime()) {
      throw new Error(
        `TimeWindow end (${end.toISOString()}) cannot be before start (${start.toISOString()})`,
      );
    }
    this.start = start;
    this.end = end;
  }

  static create(start: Date, end: Date): TimeWindow {
    return new TimeWindow(start, end);
  }

  /** Check if a specific point in time falls within this window (inclusive). */
  contains(date: Date): boolean {
    const t = date.getTime();
    return t >= this.start.getTime() && t <= this.end.getTime();
  }

  /** Check if two windows overlap. */
  overlaps(other: TimeWindow): boolean {
    return this.start.getTime() <= other.end.getTime() && other.start.getTime() <= this.end.getTime();
  }

  /** Duration in milliseconds. */
  durationMs(): number {
    return this.end.getTime() - this.start.getTime();
  }

  /** Duration in minutes, rounded. */
  durationMinutes(): number {
    return Math.round(this.durationMs() / 60_000);
  }

  /** Duration in hours, rounded to 2 decimals. */
  durationHours(): number {
    return Math.round((this.durationMs() / 3_600_000) * 100) / 100;
  }

  equals(other: TimeWindow): boolean {
    return this.start.getTime() === other.start.getTime() && this.end.getTime() === other.end.getTime();
  }

  toString(): string {
    return `[${this.start.toISOString()} – ${this.end.toISOString()}]`;
  }

  toJSON(): { start: string; end: string } {
    return { start: this.start.toISOString(), end: this.end.toISOString() };
  }
}
