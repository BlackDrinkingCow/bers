// Live weather from Open-Meteo: free, no key, no account. Cached for 30 minutes.
import { kv } from "./db.js";

export const ABU_DHABI = { name: "Abu Dhabi", lat: 24.4539, lon: 54.3773 };
const DESC = { 0: "clear", 1: "mostly clear", 2: "partly cloudy", 3: "cloudy", 45: "fog", 48: "fog", 51: "drizzle", 53: "drizzle", 55: "drizzle",
  61: "rain", 63: "rain", 65: "heavy rain", 80: "showers", 81: "showers", 82: "heavy showers", 95: "thunderstorm", 96: "thunderstorm", 99: "thunderstorm" };

export async function today(place) {
  place = place || (await kv.get("place", ABU_DHABI));
  const cached = await kv.get("weather");
  if (cached && cached.place === place.name && Date.now() - cached.at < 30 * 60e3) return cached.w;
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}&timezone=auto&forecast_days=1` +
    "&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,weather_code" +
    "&hourly=temperature_2m,visibility,wind_gusts_10m,weather_code";
  const r = await fetch(u);
  if (!r.ok) throw new Error("weather " + r.status);
  const d = await r.json(), c = d.current, h = d.hourly;
  const hours = h.time.map((t, i) => ({ hour: +t.slice(11, 13), temp: Math.round(h.temperature_2m[i]), vis: h.visibility[i], gust: h.wind_gusts_10m[i], code: h.weather_code[i] }));
  const w = {
    place: place.name, temp: Math.round(c.temperature_2m), humidity: c.relative_humidity_2m, wind: Math.round(c.wind_speed_10m),
    gust: Math.round(c.wind_gusts_10m), desc: DESC[c.weather_code] || "", hours,
    max: Math.max(...hours.map((x) => x.temp)), min: Math.min(...hours.map((x) => x.temp)),
  };
  await kv.set("weather", { place: place.name, at: Date.now(), w });
  return w;
}

export const summary = (w) => w ? `${w.place} ${w.temp}°C now, ${w.min}–${w.max}° today, humidity ${w.humidity}%, wind ${w.wind} km/h${w.desc ? ", " + w.desc : ""}` : "unknown";

/* Rossi's warnings, worked out on the phone (no tokens). */
export function rideWarnings(w) {
  if (!w) return [];
  const out = [], later = w.hours.filter((x) => x.hour >= new Date().getHours());
  const hot = later.find((x) => x.temp >= 42);
  if (hot) out.push(`Heat: ${hot.temp}° around ${hot.hour}:00. Ride early, mesh only, carry water.`);
  const dust = later.find((x) => x.gust >= 45 || (x.vis != null && x.vis < 2000 && x.code < 45));
  if (dust) out.push(`Dust risk: gusts of ${Math.round(dust.gust)} km/h${dust.vis < 2000 ? ` and visibility ${(dust.vis / 1000).toFixed(1)} km` : ""} around ${dust.hour}:00. Visor down, or wait it out.`);
  const fog = later.find((x) => x.code === 45 || x.code === 48 || (x.vis != null && x.vis < 1000));
  if (fog) out.push(`Fog around ${fog.hour}:00. Visibility drops fast on the highways. Clear visor, slow down.`);
  const wet = later.find((x) => x.code >= 51);
  if (wet) out.push(`Rain around ${wet.hour}:00. UAE roads get slick with oil after the first rain. Easy on the brakes.`);
  return out;
}

export async function geocode(name) {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(name)}`);
  const d = await r.json(), p = d.results?.[0];
  if (!p) throw new Error(`Couldn't find "${name}".`);
  return { name: p.name, lat: p.latitude, lon: p.longitude };
}

export async function forecastFor(place, days) {
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}&timezone=auto&forecast_days=${Math.min(16, days)}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max`);
  const d = (await r.json()).daily;
  return d.time.map((t, i) => `${t}: ${Math.round(d.temperature_2m_min[i])}–${Math.round(d.temperature_2m_max[i])}°, rain ${d.precipitation_probability_max[i]}%`).join("; ");
}
