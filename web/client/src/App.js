// client/src/App.js
import React, { Component } from "react";
import { LaundryMachine } from './LaundryMachine/LaundryMachine';

const CLIENT_SECRET = 'very-secure-123';

const getMachineData = async () => {
  const data = await fetch(
    '/api/machines',
    {
      method: 'GET',
      headers: {'client_secret': CLIENT_SECRET},
    },
  );
  const json = await data.json();
  return json;
};

class App extends Component {

  render() {
    const machines = getMachineData().then((machines) => machines);
    console.log(machines);

    return (
      <div className="app">
        {machines.map((m) => (
          <LaundryMachine
            name={m.name}
            type={m.type}
            running={m.running}
            status={m.status}
            cycleDurationMinutes={m.cycleDurationMinutes}
            cycleMinutesRemaining={m.cycleMinutesRemaining}
            lastCycleStarted={m.lastCycleStarted}
            lastCycleCompleted={m.lastCycleCompleted}
          />
        ))}
      </div>
    );
  }
}



export default App;
