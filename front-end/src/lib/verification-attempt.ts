/** Isolates asynchronous widget callbacks so stale attempts cannot settle new ones. */
export class VerificationAttempts {
  private sequence = 0;
  private pending?: { id: number; resolve: (token: string) => void; reject: (error: Error) => void };

  begin() {
    if (this.pending) throw new Error("Browser verification is already running.");
    const id = ++this.sequence;
    const promise = new Promise<string>((resolve, reject) => {
      this.pending = { id, resolve, reject };
    });
    return { id, promise };
  }

  isCurrent(id: number) {
    return this.pending?.id === id;
  }

  settle(id: number, token?: string, message?: string) {
    if (!this.isCurrent(id)) return false;
    const pending = this.pending!;
    this.pending = undefined;
    if (token) pending.resolve(token);
    else pending.reject(new Error(message || "Browser verification failed. Please try again."));
    return true;
  }

  cancel() {
    if (this.pending) this.settle(this.pending.id, undefined, "Verification cancelled.");
  }
}
