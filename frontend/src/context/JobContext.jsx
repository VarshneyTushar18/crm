import { createContext, useContext, useEffect, useMemo, useState } from "react";

const JobContext = createContext(null);

export function JobProvider({ children }) {
  const [activeJobId, setActiveJobId] = useState(() => localStorage.getItem("activeJobId") || "");

  useEffect(() => {
    if (activeJobId) localStorage.setItem("activeJobId", activeJobId);
    else localStorage.removeItem("activeJobId");
  }, [activeJobId]);

  const value = useMemo(() => ({ activeJobId, setActiveJobId }), [activeJobId]);

  return <JobContext.Provider value={value}>{children}</JobContext.Provider>;
}

export function useJob() {
  const ctx = useContext(JobContext);
  return ctx || { activeJobId: "", setActiveJobId: () => {} }; // ✅ no crash even if provider missing
}
