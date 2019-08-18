// client/src/App.js
import React, { Component } from "react";

function LaundryMachine({
  name,
  type,
  running,
  status,
  cycleDurationMinutes,
  cycleMinutesRemaining,
  lastCycleStarted,
  lastCycleCompleted,
}) {
  return (
    <div className="laundry-machine">
      <h1>{name}</h1>
      <h2>{status}</h2>
      <p>Running: {running}</p>
      <p>Cycle Duration (Minutes}: {cycleDurationMinutes}</p>
      <p>Minutes Remaining:{cycleMinutesRemaining}</p>
      <p>Last Cycle Started At: {lastCycleStarted}</p>
      <p>Last Cycle Completed At: {lastCycleCompleted}</p>
    </div>
  );
}

export { LaundryMachine };
