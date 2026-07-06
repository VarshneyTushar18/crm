import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  JOB_PINNED_KEY,
  pinJobContext,
  clearJobPinContext,
  readJobPinned,
} from "@/utils/workflowJobScope";

const JobContext = createContext(null);

export function JobProvider({ children }) {
  const [activeJobId, setActiveJobId] = useState(
    () => localStorage.getItem("activeJobId") || ""
  );
  const [isJobPinned, setIsJobPinned] = useState(() => readJobPinned());

  useEffect(() => {
    if (activeJobId) localStorage.setItem("activeJobId", activeJobId);
    else localStorage.removeItem("activeJobId");
  }, [activeJobId]);

  useEffect(() => {
    if (isJobPinned) localStorage.setItem(JOB_PINNED_KEY, "true");
    else localStorage.removeItem(JOB_PINNED_KEY);
  }, [isJobPinned]);

  const pinJob = (job) => pinJobContext(job, setActiveJobId, setIsJobPinned);

  const clearJobPin = () => clearJobPinContext(setActiveJobId, setIsJobPinned);

  const value = useMemo(
    () => ({
      activeJobId,
      setActiveJobId,
      isJobPinned,
      pinJob,
      clearJobPin,
    }),
    [activeJobId, isJobPinned]
  );

  return <JobContext.Provider value={value}>{children}</JobContext.Provider>;
}

export function useJob() {
  const ctx = useContext(JobContext);
  return (
    ctx || {
      activeJobId: "",
      setActiveJobId: () => {},
      isJobPinned: false,
      pinJob: () => {},
      clearJobPin: () => {},
    }
  );
}
