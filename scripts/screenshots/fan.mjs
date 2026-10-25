// Renders the fan cards with the mock home and saves the README screenshots.
// Usage: npm install && npm run build && node scripts/screenshots/fan.mjs
import { pair, shoot } from "./harness.mjs";
import { mockHass } from "./mock.mjs";

const entity = "fan.bedroom_fan_fan";

await shoot({
  prefix: "fan",
  tag: "climate-air-fan-card",
  shots: pair("card"),
  setup: (_s, lang) => ({ hass: mockHass(lang), config: { entity } }),
});

await shoot({
  prefix: "fan",
  tag: "climate-air-fan-mini-card",
  shots: pair("mini"),
  setup: (_s, lang) => ({ hass: mockHass(lang), config: { entity } }),
});
