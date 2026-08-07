import React, { useMemo } from "react";
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from "recharts";
import { Requisition } from "../types";
import { formatDistanceToNow } from "date-fns";

interface ApprovalSparklineProps {
  req: Requisition;
}

export const ApprovalSparkline: React.FC<ApprovalSparklineProps> = ({ req }) => {
  const data = useMemo(() => {
    const historyArr = Array.isArray(req.approvalHistory) ? req.approvalHistory : [];
    const history = [...historyArr].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    // Calculate durations between steps
    let lastTime = new Date(req.submittedAt).getTime();
    
    return history.map((note, index) => {
      const currentTime = new Date(note.timestamp).getTime();
      const durationHours = Math.max(0, (currentTime - lastTime) / (1000 * 60 * 60));
      lastTime = currentTime;
      return {
        name: `Step ${index + 1}`,
        duration: durationHours,
        decision: note.decision
      };
    });
  }, [req]);

  if (data.length === 0) return null;

  return (
    <div className="h-16 w-full opacity-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line 
            type="monotone" 
            dataKey="duration" 
            stroke="#6366f1" 
            strokeWidth={2} 
            dot={{ r: 3, fill: "#6366f1" }} 
          />
          <YAxis hide />
          <Tooltip 
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                    <div className="bg-slate-800 text-white text-[9px] p-2 rounded shadow">
                      {payload[0].payload.decision}: {typeof payload[0].value === 'number' ? payload[0].value.toFixed(1) : 0} hrs
                    </div>
                );
              }
              return null;
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
