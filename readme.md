# laundry-detector

## Apparatus for monitoring and recording the operational status of a system of 'legacy' laundry machines

Laundry detector is a project I started because of a rotten laundry situation in my previous apartment building.

### Overview

_note: The hardware side of this project is still under active consideration. The readme as it stands in regards to hardware should be considered a working draft._

The system uses an Arduino Mega, equipped with a Wifi Shield and two [SW-420 Vibration Sensors](https://www.amazon.com/Hiletgo-SW-420-Vibration-Sensor-Arduino/dp/B00HJ6ACY2/ref=asc_df_B00HJ6ACY2/?tag=hyprod-20&linkCode=df0&hvadid=254874987968&hvpos=1o3&hvnetw=g&hvrand=11504069928765069995&hvpone=&hvptwo=&hvqmt=&hvdev=c&hvdvcmdl=&hvlocint=&hvlocphy=9021727&hvtargid=aud-801381245258:pla-623142100707&psc=1).
The sensors are taped to the back of the washer and dryer. The main Arduino `loop()` function runs every minute, sending a `POST` request to a web server with the current status of the machines.

From there, a webserver handles the incoming event request and updates the Mongo database accordingly. The server provides client APIs to access the current status of the machines as well as historical data about previous cycles, etc.
