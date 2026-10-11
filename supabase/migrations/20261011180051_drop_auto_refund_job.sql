-- Auto-refund was dropped by decision (admins refund by hand, or the payment stands).
-- Removes the job an earlier version of the scheduled-jobs migration created. Safe to re-run.
select cron.unschedule(jobid) from cron.job where jobname = 'auto-refund';
