import assert from "node:assert/strict";
import { test } from "node:test";
import { makeHass } from "./hass.mjs";
import { load, mount } from "./load.mjs";

const lib = load();
const html = (el) => el.shadowRoot.innerHTML;

test("every card and its editor are registered", () => {
  for (const [tag, cls] of Object.entries(lib.cards)) {
    assert.ok(cls, tag);
    assert.ok(lib.customElements.get(`${tag}-editor`), `${tag}-editor`);
  }
  assert.equal(lib.window.customCards.length, 7);
});

test("purifier: air quality, filter, presets and options", () => {
  const el = mount(lib, "climate-air-purifier-card", { entity: "fan.living_room_purifier_air_purifier" }, makeHass());
  const out = html(el);
  assert.match(out, /<span class="val">6<small> µg\/m³/);
  assert.match(out, /Good air/);
  assert.match(out, /76 %/);
  assert.match(out, /data-action="preset" data-value="Sleep"/);
  assert.match(out, /data-range="percentage"/);
  assert.match(out, /class="picture k-purifier st-on running"/);
  // The favorite level only shows in the favorite preset.
  assert.doesNotMatch(out, /data-number="number\.living_room_purifier_favorite_fan_level"/);
  const fav = mount(lib, "climate-air-purifier-card", { entity: "fan.living_room_purifier_air_purifier" },
    makeHass("en", { "fan.living_room_purifier_air_purifier": { preset_mode: "Favorite" } }));
  assert.match(html(fav), /data-number="number\.living_room_purifier_favorite_fan_level"/);
});

test("purifier: a worn filter is flagged, and its mode select replaces presets", () => {
  const el = mount(lib, "climate-air-purifier-card", { entity: "fan.bedroom_purifier" }, makeHass("fr"));
  const out = html(el);
  assert.match(out, /chip warn.*Filtre à changer/);
  assert.match(out, /Air moyen/);
  assert.match(out, /data-action="mode" data-value="manual"/);
  assert.match(out, /Purification/);
});

test("purifier off: no animation, idle color", () => {
  const el = mount(lib, "climate-air-purifier-card", { entity: "fan.bedroom_purifier" }, makeHass("en", { "fan.bedroom_purifier": { state: "off" } }));
  assert.doesNotMatch(html(el), /class="picture[^"]*running/);
  assert.match(html(el), /--ca-color:var\(--disabled-text-color/);
});

test("fan: speed, oscillation, natural wind and options", () => {
  const h = makeHass();
  const el = mount(lib, "climate-air-fan-card", { entity: "fan.bedroom_fan_fan" }, h);
  const out = html(el);
  assert.match(out, /class="picture k-fan st-on running osc natural"/);
  assert.match(out, /--ca-spin:1\.13s/);
  assert.match(out, /Oscillation 90°/);
  assert.match(out, /data-press="button\.bedroom_fan_turn_left"/);
  el._onClick({ composedPath: () => [{ dataset: { action: "oscillate" } }] });
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls.at(-1))), ["fan", "oscillate", { entity_id: "fan.bedroom_fan_fan", oscillating: false }]);
});

test("unavailable device: offline chip, no controls", () => {
  const el = mount(lib, "climate-air-fan-card", { entity: "fan.bedroom_fan_fan" }, makeHass("en", { "fan.bedroom_fan_fan": { state: "unavailable" } }));
  assert.match(html(el), /Device offline/);
  assert.doesNotMatch(html(el), /data-range/);
  assert.doesNotMatch(html(el), /data-action="power"/);
});

test("air conditioner: temperatures, modes, compressor and swing", () => {
  const el = mount(lib, "climate-air-aircon-card", { entity: "climate.air_conditioner" }, makeHass("fr"));
  const out = html(el);
  assert.match(out, /25,5<small> °C/);
  assert.match(out, /→ 22 °C/);
  assert.match(out, /k-aircon st-cool running m-cool active swing-v/);
  assert.match(out, /Extérieur 31 °C/);
  assert.match(out, /640 W/);
  assert.match(out, /data-toggle="switch\.air_conditioner_eco"/);
  // Many modes: the selected one keeps its label, the others show only their icon.
  assert.match(out, /class="seg on" data-action="hvac" data-value="cool"[^>]*>.*<span>Froid<\/span>/);
  assert.match(out, /class="seg short" data-action="hvac" data-value="heat"/);
});

test("air conditioner: target steps add up and are sent once the taps stop", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const h = makeHass();
  const el = mount(lib, "climate-air-aircon-card", { entity: "climate.air_conditioner" }, h);
  el._action("temp", "1");
  el._action("temp", "1");
  assert.match(html(el), /<span class="tval">23 °C/);
  assert.equal(h.calls.length, 0);
  t.mock.timers.tick(1000);
  await Promise.resolve();
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls)), [["climate", "set_temperature", { entity_id: "climate.air_conditioner", temperature: 23 }]]);
});

test("air conditioner off: no target, dirty filter flagged", () => {
  const el = mount(lib, "climate-air-aircon-card", { entity: "climate.air_conditioner" },
    makeHass("en", { "climate.air_conditioner": { state: "off" }, "binary_sensor.air_conditioner_full_dust": { state: "on" } }));
  const out = html(el);
  assert.doesNotMatch(out, /data-action="temp"/);
  assert.doesNotMatch(out, /class="picture[^"]*running/);
  assert.match(out, /Clean the filter/);
});

test("mini cards are compact until their detail button is pressed", () => {
  const el = mount(lib, "climate-air-aircon-mini-card", { entity: "climate.air_conditioner" }, makeHass());
  assert.match(html(el), /<ha-card class="mini">/);
  assert.match(html(el), /data-action="zoom"/);
  assert.match(html(el), /data-action="temp" data-value="1"/);
  el._toggleZoom({ detail: 1 });
  assert.doesNotMatch(html(el), /class="mini"/);
  assert.match(html(el), /mdi:arrow-collapse/);
  const plain = mount(lib, "climate-air-fan-mini-card", { entity: "fan.bedroom_fan_fan", zoom: false }, makeHass());
  assert.doesNotMatch(html(plain), /data-action="zoom"/);
});

test("without an entity, a card takes the first device of its kind", () => {
  const el = mount(lib, "climate-air-purifier-card", {}, makeHass());
  assert.match(html(el), /Bedroom purifier/);
  assert.deepEqual(JSON.parse(JSON.stringify(lib.cards["climate-air-fan-card"].getStubConfig(makeHass()))), { entity: "fan.bedroom_fan_fan" });
});

const part = (el, sel) => el.shadowRoot.querySelector("ha-card").querySelector(sel);
const overview = (config = {}, hass = makeHass()) => {
  const el = mount(lib, "climate-air-overview-card", config, hass);
  return { el, body: part(el, ".body").innerHTML, head: part(el, ".head").innerHTML };
};

test("overview: only the devices on or needing attention, grouped by type", () => {
  const { body, head } = overview();
  assert.match(head, /4 on/);
  assert.doesNotMatch(body, /fan\.office_fan_fan/);
  assert.match(body, /data-id="fan\.bedroom_purifier"/);
  assert.match(body, /Replace the filter/);
  assert.deepEqual([...body.matchAll(/class="group">([^<]+)</g)].map((m) => m[1]), ["Air conditioners", "Air purifiers", "Fans"]);
});

test("overview: the detail button shows every device; zoom: false always does", () => {
  const { el } = overview();
  el._onClick({ composedPath: () => [{ dataset: { action: "zoom" } }], detail: 1 });
  assert.match(part(el, ".body").innerHTML, /fan\.office_fan_fan/);
  assert.match(overview({ zoom: false }).body, /fan\.office_fan_fan/);
});

test("overview: exclude, include and group by area", () => {
  const { body } = overview({ zoom: false, exclude: ["fan.office_fan_fan"], include: ["climate.bathroom_thermostat"], group_by: "area" });
  assert.doesNotMatch(body, /fan\.office_fan_fan/);
  assert.match(body, /climate\.bathroom_thermostat/);
  assert.deepEqual([...body.matchAll(/class="group">([^<]+)</g)].map((m) => m[1]), ["Bedroom", "Living room", "No area"]);
});

test("overview: tapping the icon turns the device off, tapping the tile unfolds its card", () => {
  const h = makeHass();
  const { el } = overview({}, h);
  el._onClick({ composedPath: () => [{ dataset: { toggle: "fan.bedroom_fan_fan" } }] });
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls.at(-1))), ["fan", "turn_off", { entity_id: "fan.bedroom_fan_fan" }]);
  el._tap("climate.air_conditioner");
  const panel = el.shadowRoot.querySelector(".panel");
  assert.equal(panel.hidden, false);
  assert.equal(panel.children[0]?._config.entity, "climate.air_conditioner");
});
