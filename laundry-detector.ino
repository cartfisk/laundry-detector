/*//==============================================================================//
 * Vibration Sensor interfacing with Arduino
 * Date: - 15-04-2019
 * Author:- Sourav Gupta
 * For:- circuitdigest.com
 */ //=============================================================================//
// #include <Arduino.h>
// #include <stdio.h>

#define ON 1
#define OFF 0

/*
 * Pin Description
 */
int WASHER_PIN = A5;
int DRYER_PIN = A6;
int LED = 13;

/*
 * Time counter
 */
int seconds = 0;

/*
 * Laundry machine class
 */
typedef struct LaundryMachine {
  int sensor_pin;
  char id[];
  int vibrations_count;
  bool running;
} LaundryMachine;

/*
 * Pin mode setup
 */
void setup() {

  LaundryMachine washer = {
    WASHER_PIN,
    "washer",
    0,
    false,
  };

  LaundryMachine dryer = {
    DRYER_PIN,
    "dryer",
    0,
    false,
  };

  LaundryMachine machines[] = [washer, dryer];

  for (int i = 0; i < sizeof(machines); i++) {
    pinMode(machine[i].sensor_pin, INPUT);
  }

  pinMode(LED, OUTPUT);
}

/*
 * Led blink
 */
void led_blink(void);

/*
 * main_loop
 */

void loop() {

  time += 1;

  for (int i = 0; i < sizeof(machines); i++) {
    vibrating = poll_sensor(machines[i]);
    if (vibrating) {
      machines[i].vibrations_count += 1;
    }
  }

  if (time == 60) {
    for (int i = 0; i < sizeof(machines); i++) {
      machine = machines[i];

      if (machine.vibrations > 30) {
        machine.running = true;
      } else {
        machine.running = false;
      }
      client.post(
        "/machine/" + machine.id + "/update",
        {"running": machine.running},
      )
    }

    time = 0;
  }



  delay(1000);

}

bool poll_sensor(LaundryMachine machine) {
  return digitalRead(machine.pin); // Reading digital data from the machine's sensor
}

void led_blink(void) {
digitalWrite(LED, ON);
delay(250);
digitalWrite(LED, OFF);
delay(250);
digitalWrite(LED, ON);
delay(250);
digitalWrite(LED, OFF);
delay(250);
}
