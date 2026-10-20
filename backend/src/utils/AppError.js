export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.isOperational = true; // an expected error, safe to show to the user
  }
}