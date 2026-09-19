/** A recognition failure with the HTTP status the import route should answer with. */
export class RecognitionError extends Error {
  constructor(message: string, public readonly status = 422) {
    super(message);
    this.name = 'RecognitionError';
  }
}
