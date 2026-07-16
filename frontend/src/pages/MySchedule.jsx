import { useEffect, useState } from "react";
import * as scheduleApi from "../api/schedule";
import LoadingState from "../components/LoadingState";
import ScheduleView from "../components/ScheduleView";

export default function MySchedule() {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    scheduleApi
      .getWeekSchedule()
      .then(setBlocks)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-ink">My Schedule</h1>
        <p className="text-sm text-ink-muted mt-1">
          Your personalized week — each block shows why it&apos;s on your plan.
        </p>
      </div>

      {loading ? (
        <LoadingState message="Loading your schedule…" />
      ) : error ? (
        <p className="text-risk-high text-sm">{error}</p>
      ) : (
        <ScheduleView blocks={blocks} />
      )}
    </div>
  );
}
