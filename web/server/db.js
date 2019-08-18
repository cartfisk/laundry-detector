const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// this will be our data base's data structure
const LaundryMachine = new Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
    },
    type: {
      type: String,
      enum: ["washer", "dryer", "other"],
      required: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "ARCHIVED", "OUT_OF_SERVICE"],
      required: true,
      default: "ACTIVE",
    },
    running: {
      type: Boolean,
      default: false,
      returied: true,
    },
    cycle_duration_minutes: {
      type: Number,
      required: true,
    },
    cycle_minutes_remaining: {
      type: Number,
      default: 0,
    },
    last_cycle_started: {
      type: Date,
      default: undefined,
    },
    last_cycle_completed: {
      type: Date,
      default: undefined,
    },
    cycle_ids: {
      type: [String],
      default: [],
    },
  },
);

const Cycle = new Schema(
  {
    machine_id: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["IN_PROGRESS", "COMPLETED"],
      required: true,
    },
    start_time: {
      type: Date,
      required: true,
    },
    end_time: Date,
    expected_duration_minutes: {
      type: Number,
      required: true,
    },
    actual_duration_minutes: Number,
  },
);

const LogEntry = new Schema(
  {
    machine_id: {
      type: String,
      required: true,
    },
    running: {
      type: Boolean,
      required: true,
    },
  },
  { timestamps: true, }
);

module.exports = {
  LaundryMachine: mongoose.model("LaundryMachine", LaundryMachine),
  Cycle: mongoose.model("Cycle", Cycle),
  LogEntry: mongoose.model("LogEntry", LogEntry),
}
