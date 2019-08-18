const mongoose = require('mongoose');
const express = require('express');
var cors = require('cors');
const bodyParser = require('body-parser');
const logger = require('morgan');
const { LaundryMachine, Cycle, LogEntry } = require('./db');

const API_PORT = 3001;
const app = express();
app.use(cors());
const router = express.Router();

const dbUser = 'laundry_server';
const dbPass = 'maytag';
// this is our MongoDB database
const dbRoute =
  `mongodb://${dbUser}:${dbPass}@localhost/laundry_detector`;

const CLIENT_SECRET = 'very-secure-123';

const authenticate = (headers) => {
  const authenticated = Boolean(headers.client_secret && headers.client_secret === CLIENT_SECRET);
  return {
    success: authenticated,
    errors: authenticated ? [] : ['authentication failed'],
  };
};

// connects our back end code with the database
mongoose.connect(dbRoute, { useNewUrlParser: true, useFindAndModify: false });

let db = mongoose.connection;

db.once('open', () => console.log('connected to the database'));

// checks if connection with the database is successful
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

// (optional) only made for logging and
// bodyParser, parses the request body to be a readable json format
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(logger('dev'));

router.get('/machines', async (request, response) => {
  const auth = authenticate(request.headers);
  if (!auth.success) {
    return response.json(auth);
  }

  return response.json(await LaundryMachine.find({}, (err, machines) => machines));
});

router.get('/cycles', async (request, response) => {
  const auth = authenticate(request.headers);
  if (!auth.success) {
    return response.json(auth);
  }

  const { page, limit } = request.query;

  if (page === undefined || limit === undefined || limit < 1) {
    return response.json({
      success: false,
      error: 'Provide page (starting with 0) and limit (minimum 1)',
    });
  }

  const cycles = await Cycle.find({}, (err, cycles) => cycles, { limit, skip: (page || 0) * limit });
  return response.json(cycles);
});

router.get('/logs', async (request, response) => {
  const auth = authenticate(request.headers);
  if (!auth.success) {
    return response.json(auth);
  }

  const { page, limit } = request.query;

  if (page === undefined || limit === undefined || limit < 1) {
    return response.json({
      success: false,
      error: 'Provide page (starting with 0) and limit (minimum 1)',
    });
  }

  const logs = await LogEntry.find({}, (err, logs) => logs, { limit, skip: (page || 0) * limit });
  return response.json(logs);
});

// business logic for handling an incoming Arduino event request
const handleEvent = async (event, errors = []) => {

  let machineUpdate = {};
  let cycleUpdate = {};

  let cycle;

  machine = await LaundryMachine.findOne({ id: event.machine_id }, (err, machine) => machine);

  const {
    running: wasRunning,
    cycle_ids = [],
    id: machine_id,
  } = machine;

  const running = event.running;
  let timeElapsed, remaining;

  if (running) {
    timeElapsed = (new Date() - machine.last_cycle_started) / 1000 / 60;
    remaining = machine.cycle_duration_minutes - timeElapsed;
  }

  if (running === wasRunning) {
    if (running) {
      machine.cycle_minutes_remaining = remaining;

      machine.save((machineError) => {
        if (machineError) {
          errors.push(machineError);
        } else {
          machineUpdate = machine;
        }
      });
    }
  } else {
  // cycle started or ended

    // grab recent events from the log for this machine
    const events = await LogEntry.find({machine_id: machine.id}, (err, logs) => logs, {limit: 3, sort: {'createdAt': -1}});

    if (running && !wasRunning) {
      if (events.reduce((wasRunning, e) => (wasRunning || e.running), false)) {
        // if the machine was running in any of the previous events,
        // we'll contiune the previous cycle instead of starting a new one.
        const cycle = await Cycle.findOne({machine_id: machine.id}, (err, cycle) => cycle, {sort: {'start_time': -1}});

        if (cycle) {
          cycle.status = "IN_PROGRESS";
          cycle.end_time = undefined;
          cycle.actual_duration_minutes = undefined;

          cycle.save((cycleError) => {
            if (cycleError) {
              errors.push(cycleError);
            } else {
              cycleUpdate = cycle;
            }
          });

          machine.cycle_minutes_remaining = remaining;
        }
      } else {
        // start a new cycle
        start_time = new Date();

        cycle = new Cycle();
        cycle.machine_id = machine.id;
        cycle.status = "IN_PROGRESS";
        cycle.expected_duration_minutes = machine.cycle_duration_minutes;
        cycle.start_time = start_time;

        cycle.save((cycleError) => {
          if (cycleError) {
            errors.push(cycleError);
          } else {
            cycleUpdate = cycle;
          }
        });

        cycle_ids.push(cycle._id);

        machine.cycle_ids = cycle_ids;
        machine.cycle_minutes_remaining = machine.cycle_duration_minutes;
        machine.last_cycle_started = start_time;

      }

      machine.running = running;

      machine.save((machineError) => {
        if (machineError) {
          errors.push(machineError);
        } else {
          machineUpdate = machine;
        }
      });
    }

    // cycle ended
    if (!running && wasRunning) {

      const end_time = new Date();

      cycle = await Cycle.findOne({
        machine_id,
        status: "IN_PROGRESS"
      }, (err, cycle) => cycle);

      duration = (end_time - cycle.start_time) / 1000 / 60;

      cycle.status = "COMPLETED";
      cycle.end_time = end_time;
      cycle.actual_duration_minutes = duration;

      await cycle.save((cycleError) => {
        if (cycleError) {
          errors.push(cycleError);
        } else {
          cycleUpdate = cycle;
        }
      });

      machine.last_cycle_completed = end_time;
      machine.running = false;
      machine.cycle_minutes_remaining = 0;
      machine.cycle_ids = cycle._id;

      machine.save((machineError) => {
        if (machineError) {
          errors.push(machineError);
        } else {
          machineUpdate = machine;
        }
      });
    }
  }

  return {
    machine,
    cycle,
    errors,
  };

};

// log laundry events posted from Arduino and update the LaundryMachine's document
router.post('/machines/event', async (request, response) => {
  const auth = authenticate(request.headers);
  if (!auth.success) {
    return response.json(auth);
  }

  let errors = [];

  // CREATE LOG EVENT & WRITE IT TO THE DATABASE
  let event = new LogEntry();
  const { machine_id, running } = request.body;

  if (machine_id === undefined || running === undefined) {
    return response.json({
      success: false,
      error: 'INVALID INPUTS',
    });
  }

  event.running = running;
  event.machine_id = machine_id;

  const {
    machine: machineUpdate,
    cycle: cycleUpdate,
    errors: errorsUpdate
  } = handleEvent(event, errors);

  event.save((logError) => {
    if (logError) {
      errors.push(logError);
      return response.json({ success: false, error: err });
    }
    return response.json({ success: true });
  });

  return

});

// reset DB to factory ;)
router.delete('/reset', (request, response) => {
  const auth = authenticate(request.headers);
  if (!auth.success) {
    return response.json(auth);
  }

  const { collections, defaults } = request.body;
  let results = {};

  if (defaults.LaundryMachine) {
    LaundryMachine.deleteMany({}, (err) => {
      if (err) results.machines = err;
       results.machines = { success: true };
    });
    LaundryMachine.insertMany([
      { id: "1242-washer-front", type: "washer", cycle_duration_minutes: 44 },
      { id: "1242-dryer-front", type: "dryer", cycle_duration_minutes: 99 },
    ], (err) => {
      if (err) results.defaults = err;
       results.defaults = { success: true };
    });;
  }
  if (collections.LaundryMachine) {
    LaundryMachine.deleteMany({}, (err) => {
      if (err) results.machines = err;
       results.machines = { success: true };
    });
  }
  if (collections.Cycle) {
    Cycle.deleteMany({}, (err) => {
      if (err) results.cycles = err;
      results.cycles = { success: true };
    });
  }
  if (collections.LogEntry) {
    LogEntry.deleteMany({}, (err) => {
      if (err) results.log = err;
      results.log = { success: true };
    });
  }
  return response.json(results);
});

// add a LaundryMachine to the database
router.post('/machines/create', async (request, response) => {
  const auth = authenticate(request.headers);
  if (!auth.success) {
    return response.json(auth);
  }

  let errors = [];

  const { id, type, cycle_duration_minutes } = request.body;

  if (!id || !type || !cycle_duration_minutes) {
    return response.json({
      success: false,
      error: 'INVALID INPUTS',
    });
  }

  const existing = await LaundryMachine.findOne({ id }, (err, machine) => {
    if (err) {
      return { errors: [err] };
    }
    return machine;
  });

  if (existing && !existing.errors) {

    return response.json({
      success: false,
      error: "Machine ID already in use. Use `PUT /api/machines/update` instead."
    });

  } else {
    // CREATE LOG EVENT & WRITE IT TO THE DATABASE
    let machine = new LaundryMachine();

    machine.id = id;
    machine.type = type;
    machine.cycle_duration_minutes = cycle_duration_minutes;

    machine.save((error) => {
      if (error) {
        errors.push(error);
        return response.json({ success: false, errors: [error] });
      }
      return response.json({ success: true });
    });
  }

});

// update a LaundryMachine entry in the database
router.put('/machines/update', async (request, response) => {
  const auth = authenticate(request.headers);
  if (!auth.success) {
    return response.json(auth);
  }

  const { id, type, cycle_duration_minutes } = request.body;

  if (!id || !type || !cycle_duration_minutes) {
    return response.json({
      success: false,
      error: 'INVALID INPUTS',
    });
  }

  const existing = await LaundryMachine.findOne({ id }, (err, machine) => {
    if (err) {
      return { errors: [err] };
    }
    return machine;
  });

  if (existing && !existing.errors) {

    existing.status = "ACTIVE";
    existing.type = type;
    existing.cycle_duration_minutes = cycle_duration_minutes;

    existing.save((error) => {
      if (error) {
        return response.json({ success: false, error });
      }
      return response.json({ success: true });
    });
  } else {
    return response.json(existing.errors);
  }

});

// mark a LaundryMachine as archived in the database
router.delete('/machines/delete', async (request, response) => {
  const auth = authenticate(request.headers);
  if (!auth.success) {
    return response.json(auth);
  }

  let errors = [];

  if (request.id === undefined) {
    return response.json({
      success: false,
      error: 'INVALID INPUTS',
    });z
  }

  const machine = await LaundryMachine.findOne({ id: request.id }, (err, machine) => {
    if (err) {
      return { errors: [err] };
    }
    return machine;
  });

  if (!machine.errors) {
    machine.status = "ARCHIVED";
    machine.running = false;
    machine.cycle_minutes_remaining = 0;

    return await machine.save((error) => {
      if (error) {
        return response.json(error);
      } else {
        return response.json(machine);
      }
    });
  }
});

// append /api for our http requests
app.use('/api', router);

// launch our backend into a port
app.listen(API_PORT, () => console.log(`LISTENING ON PORT ${API_PORT}`));
