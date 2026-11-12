export class GameError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function requireRule(condition, message) {
  if (!condition) throw new GameError(message);
}
