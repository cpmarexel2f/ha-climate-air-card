import assert from "node:assert/strict";
import { test } from "node:test";
import { makeHass } from "./hass.mjs";
import { load } from "./load.mjs";

const lib = load();
const json = (v) => JSON.parse(JSON.stringify(v));

test("devices are sorted into air conditioners, purifiers and fans", () => {
  const h = makeHass();
  assert.equal(lib.caKindOf(h, "climate.air_conditioner"), "aircon");
  assert.equal(lib.caKindOf(h, "fan.living_room_purifier_air_purifier"), "purifier");
  // No "purifier" in its name: found from its PM2.5 sensor.
  h.states["fan.bedroom_purifier"].attributes.friendly_name = "Bedroom air";
  h.devices.dev_p2.name = "Bedroom air";
  assert.equal(lib.caKindOf(h, "fan.bedroom_purifier"), "purifier");
  assert.equal(lib.caKindOf(h, "fan.bedroom_fan_fan"), "fan");
});

test("a heat-only thermostat is not an air conditioner", () => {
  const h = makeHass();
  assert.equal(lib.caKindOf(h, "climate.bathroom_thermostat"), null);
  assert.deepEqual(json(lib.caFindEntities(h, "aircon")), ["climate.air_conditioner"]);
});

test("every device of a kind is found, sorted by name", () => {
  const h = makeHass();
  assert.deepEqual(json(lib.caFindEntities(h, "purifier")), ["fan.bedroom_purifier", "fan.living_room_purifier_air_purifier"]);
  assert.deepEqual(json(lib.caFindEntities(h, "fan")), ["fan.bedroom_fan_fan", "fan.office_fan_fan"]);
});

test("hidden and configuration entities are left out", () => {
  const h = makeHass();
  h.entities["fan.office_fan_fan"].hidden = true;
  assert.deepEqual(json(lib.caFindEntities(h, "fan")), ["fan.bedroom_fan_fan"]);
});

test("roles are found on the device", () => {
  const h = makeHass();
  const list = lib.caDeviceEntities(h, "dev_ac");
  // The real-time power, not the compressor's; the compressor frequency, not its target.
  assert.equal(lib.caFindRole(h, list, "power"), "sensor.air_conditioner_real_time_power");
  assert.equal(lib.caFindRole(h, list, "compressor"), "sensor.air_conditioner_compressor_frequency");
  assert.equal(lib.caFindRole(h, list, "outdoor_temp"), "sensor.air_conditioner_outdoor_temperature");
  assert.equal(lib.caFindRole(h, list, "filter_alert"), "binary_sensor.air_conditioner_full_dust");
  const p = lib.caDeviceEntities(h, "dev_p1");
  assert.equal(lib.caFindRole(h, p, "filter"), "sensor.living_room_purifier_filter_life_level");
  assert.equal(lib.caFindRole(h, p, "filter_hours"), "sensor.living_room_purifier_filter_used_time");
  assert.equal(lib.caFindRole(h, p, "child_lock"), "switch.living_room_purifier_physical_controls_locked");
  assert.equal(lib.caFindRole(h, p, "buzzer"), "switch.living_room_purifier_alarm");
  const f = lib.caDeviceEntities(h, "dev_f1");
  assert.equal(lib.caFindRole(h, f, "angle"), "number.bedroom_fan_horizontal_angle");
  assert.equal(lib.caFindRole(h, f, "timer"), "number.bedroom_fan_countdown_time");
  assert.equal(lib.caFindRole(h, f, "rotate_left"), "button.bedroom_fan_turn_left");
});

test("air quality from PM2.5, from HomeKit's 1–5 index, or from a US AQI", () => {
  const key = (pm, aqi) => lib.caAirQuality(pm, aqi)?.key;
  assert.equal(key(6), "good");
  assert.equal(key(18), "moderate");
  assert.equal(key(40), "unhealthy");
  assert.equal(key(90), "bad");
  assert.equal(key(null, 1), "good");
  assert.equal(key(null, 3), "moderate");
  assert.equal(key(null, 5), "bad");
  assert.equal(key(null, 120), "unhealthy");
  assert.equal(key(null, null), undefined);
});

test("the blades turn faster with the speed", () => {
  assert.ok(Number(lib.caSpin(100)) < Number(lib.caSpin(10)));
  assert.equal(lib.caSpin(100), "0.30");
});

test("names come from the device, without Xiaomi Home's trailing ' Fan' on entity names", () => {
  const h = makeHass();
  assert.equal(lib.caName(h, "fan.bedroom_fan_fan"), "Bedroom fan");
  delete h.entities["fan.bedroom_fan_fan"].device_id;
  h.states["fan.bedroom_fan_fan"].attributes.friendly_name = "Bedroom fan  Fan";
  assert.equal(lib.caName(h, "fan.bedroom_fan_fan"), "Bedroom fan");
});

test("the editor drops options left empty or at their default", () => {
  const out = lib.caCleanConfig({ entity: "fan.x", name: "", show_controls: true, zoom: false, entities: { pm25: "", filter: "sensor.f" } }, { show_controls: true, zoom: true }, "custom:t");
  assert.deepEqual(json(out), { type: "custom:t", entity: "fan.x", zoom: false, entities: { filter: "sensor.f" } });
});
