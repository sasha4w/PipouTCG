import { runJob } from './tournament-jobs';
import type { Job } from './tournament-jobs';

/** Processus enfant du tournoi : reçoit un job, renvoie son résultat. */
process.on('message', (job: Job) => {
  process.send!(runJob(job));
});
