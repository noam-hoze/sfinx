/** Error thrown on invalid/NaN inputs. */
export class InvalidInputError extends Error {
  override name = "InvalidInputError";

  constructor(message?: string) {
    super(message ?? "Invalid input to weighted mean scorer");
    Object.setPrototypeOf(this, InvalidInputError.prototype);
  }
}


