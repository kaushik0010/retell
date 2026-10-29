/**
 * Authoritative Transcript Accumulator
 *
 * Establishes a single, authoritative, monotonic transcript state for each practice attempt.
 * Prevents transcript loss when finishing an attempt immediately after speaking,
 * handles partial and finalized events safely, and rejects late events after completion.
 */

export class TranscriptAccumulator {
  private _finalizedText: string = "";
  private _interimText: string = "";
  private _isCompleted: boolean = false;

  constructor(initialFinal: string = "", initialInterim: string = "") {
    this._finalizedText = initialFinal.trim();
    this._interimText = initialInterim.trim();
  }

  public get finalizedText(): string {
    return this._finalizedText;
  }

  public get interimText(): string {
    return this._interimText;
  }

  public get isCompleted(): boolean {
    return this._isCompleted;
  }

  /**
   * Updates transcript with an incoming delta from Meta ASR or browser SpeechRecognition.
   * Silently rejects any events that arrive after completion.
   */
  public update(text: string, isFinal: boolean): void {
    if (this._isCompleted) return;

    const trimmed = text.trim();

    if (isFinal) {
      if (trimmed) {
        if (!this._finalizedText) {
          this._finalizedText = trimmed;
        } else if (trimmed === this._finalizedText) {
          // No-op, already identical
        } else if (trimmed.startsWith(this._finalizedText)) {
          // Recognizer replaced previous finalized prefix with longer text
          this._finalizedText = trimmed;
        } else if (this._finalizedText.includes(trimmed)) {
          // Subset of already accumulated text, do not duplicate
        } else {
          // Append new finalized segment
          this._finalizedText = `${this._finalizedText} ${trimmed}`.trim();
        }
      }
      this._interimText = "";
    } else {
      // For interim deltas: if the recognizer emits the full sentence including finalized text,
      // isolate only the new interim portion to avoid duplication.
      if (this._finalizedText && trimmed.startsWith(this._finalizedText)) {
        this._interimText = trimmed.slice(this._finalizedText.length).trim();
      } else {
        this._interimText = trimmed;
      }
    }
  }

  /**
   * Returns the current full transcript string combining finalized text and in-flight interim words.
   */
  public getFullTranscript(): string {
    const finalPart = this._finalizedText.trim();
    const interimPart = this._interimText.trim();

    if (!finalPart) return interimPart;
    if (!interimPart) return finalPart;

    if (interimPart.startsWith(finalPart)) {
      return interimPart;
    }

    if (finalPart.endsWith(interimPart) || finalPart.includes(interimPart)) {
      return finalPart;
    }

    return `${finalPart} ${interimPart}`.trim();
  }

  /**
   * Finalizes the transcript monotonically:
   * 1. Merges any unfinalized interim speech into the finalized text.
   * 2. Incorporates server final text if provided.
   * 3. Locks the accumulator against any subsequent late events.
   * 4. Returns the definitive, non-empty transcript (never silently replaced with empty).
   */
  public finalize(serverFinal?: string): string {
    if (this._isCompleted) return this._finalizedText;

    const localFull = this.getFullTranscript();
    let bestResult = localFull;

    if (serverFinal && serverFinal.trim().length > 0) {
      const serverClean = serverFinal.trim();
      if (serverClean.length >= localFull.length) {
        bestResult = serverClean;
      } else if (!localFull.includes(serverClean)) {
        bestResult = `${localFull} ${serverClean}`.trim();
      }
    }

    // Critical safety: if bestResult is empty but we had content in localFull, preserve localFull
    if (!bestResult && localFull) {
      bestResult = localFull;
    }

    this._finalizedText = bestResult.trim();
    this._interimText = "";
    this._isCompleted = true;

    return this._finalizedText;
  }

  /**
   * Resets accumulator for a new attempt.
   */
  public reset(): void {
    this._finalizedText = "";
    this._interimText = "";
    this._isCompleted = false;
  }
}
