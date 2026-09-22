import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { message } from "antd";
import { getWorkerAssignedJobs } from "@/api/extensionApi";

export function useWorkerJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const list = await getWorkerAssignedJobs();
      setJobs(Array.isArray(list) ? list : []);
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to load assigned jobs");
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const allAssignments = useMemo(() => {
    const flat = [];
    for (const job of jobs) {
      for (const assignment of job.assignments || []) {
        flat.push({
          ...assignment,
          jobCode: job.jobId,
          job_id: job._id,
          site: job.site,
        });
      }
    }
    return flat.sort((a, b) => {
      const priorityDiff = Number(a.priority || 3) - Number(b.priority || 3);
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });
  }, [jobs]);

  const todayAssignments = useMemo(
    () => allAssignments.filter((a) => dayjs(a.startTime).isSame(dayjs(), "day")),
    [allAssignments]
  );

  const upcomingAssignments = useMemo(
    () =>
      allAssignments.filter(
        (a) =>
          dayjs(a.startTime).isAfter(dayjs(), "day") &&
          dayjs(a.startTime).isBefore(dayjs().add(7, "day"), "day")
      ),
    [allAssignments]
  );

  return { jobs, loading, todayAssignments, upcomingAssignments, reload: loadJobs };
}
