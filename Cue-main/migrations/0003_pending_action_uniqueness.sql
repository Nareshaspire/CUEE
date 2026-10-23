CREATE UNIQUE INDEX IF NOT EXISTS pending_actions_one_open_per_task
  ON pending_actions(owner_id, run_id, task_key)
  WHERE status = 'PENDING';
