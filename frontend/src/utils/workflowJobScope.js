export const JOB_PINNED_KEY = "jobPinnedFromTimeline";

export function persistJobContext(job, setActiveJobId) {
  if (!job?._id) return;
  setActiveJobId(job._id);
  localStorage.setItem("activeJobId", job._id);
  localStorage.setItem(`activeJobData_${job._id}`, JSON.stringify(job));
  localStorage.setItem("activeJobData", JSON.stringify(job));
}

export function pinJobContext(job, setActiveJobId, setPinned) {
  if (!job?._id) return;
  persistJobContext(job, setActiveJobId);
  if (setPinned) setPinned(true);
  localStorage.setItem(JOB_PINNED_KEY, "true");
}

export function clearJobPinContext(setActiveJobId, setPinned) {
  setActiveJobId("");
  if (setPinned) setPinned(false);
  localStorage.removeItem("activeJobId");
  localStorage.removeItem(JOB_PINNED_KEY);
  localStorage.removeItem("activeJobData");
}

export function readJobPinned() {
  return localStorage.getItem(JOB_PINNED_KEY) === "true";
}

/** Include the active/pinned job in picker lists even when it fails eligibility filters. */
export function withPinnedJob(jobs, eligibleJobs, pinnedJobId) {
  if (!pinnedJobId) return eligibleJobs;
  const pinned = jobs.find((j) => j._id === pinnedJobId);
  if (!pinned) return eligibleJobs;
  if (eligibleJobs.some((j) => j._id === pinnedJobId)) return eligibleJobs;
  return [pinned, ...eligibleJobs];
}

export function resolveWorkflowJobId(queryJobId, activeJobId) {
  return queryJobId || activeJobId || localStorage.getItem("activeJobId") || "";
}

export function workflowPathWithJob(basePath, jobId) {
  if (!jobId) return basePath;
  return `${basePath}?jobId=${jobId}`;
}
