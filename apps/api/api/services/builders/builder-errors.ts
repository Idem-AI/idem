/** Refus métier d'Idem Builders : un statut HTTP, un code stable, une phrase lisible. */
export class BuildersError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'BuildersError';
  }
}
