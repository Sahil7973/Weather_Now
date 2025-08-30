
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MapPin,
  Search,
  LocateFixed,
  Thermometer,
  Wind,
  Droplets,
  Cloud,
  CloudRain,
  Sun,
  Clock,
} from "lucide-react";

// -----------------------------
// WEATHER CODE MAP (icons + labels)
// -----------------------------
const WEATHER_MAP = {
  0: { label: "Clear sky", Icon: Sun },
  1: { label: "Mainly clear", Icon: Sun },
  2: { label: "Partly cloudy", Icon: Cloud },
  3: { label: "Overcast", Icon: Cloud },
  45: { label: "Fog", Icon: Cloud },
  48: { label: "Depositing rime fog", Icon: Cloud },
  51: { label: "Drizzle: light", Icon: CloudRain },
  53: { label: "Drizzle: moderate", Icon: CloudRain },
  55: { label: "Drizzle: dense", Icon: CloudRain },
  61: { label: "Rain: slight", Icon: CloudRain },
  63: { label: "Rain: moderate", Icon: CloudRain },
  65: { label: "Rain: heavy", Icon: CloudRain },
  71: { label: "Snow: slight", Icon: CloudRain },
  73: { label: "Snow: moderate", Icon: CloudRain },
  75: { label: "Snow: heavy", Icon: CloudRain },
  80: { label: "Rain showers: slight", Icon: CloudRain },
  81: { label: "Rain showers: moderate", Icon: CloudRain },
  82: { label: "Rain showers: violent", Icon: CloudRain },
  95: { label: "Thunderstorm", Icon: CloudRain },
  99: { label: "Thunderstorm w/ hail", Icon: CloudRain },
};

// -----------------------------
// HELPER FUNCTIONS
// -----------------------------
const prettyTime = (iso, tz) =>
  new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: tz || undefined,
  }).format(new Date(iso));

const prettyDate = (iso, tz) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "2-digit",
    timeZone: tz || undefined,
  }).format(new Date(iso));

// -----------------------------
// MAIN APP
// -----------------------------
export default function App() {
  const [query, setQuery] = useState("");
  const [unit, setUnit] = useState("c"); // "c" = Celsius, "f" = Fahrenheit
  const [cities, setCities] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [wx, setWx] = useState(null);
  const [tz, setTz] = useState("auto");

  const refreshTimer = useRef(null);

  // -----------------------------
  // Search for a city
  // -----------------------------
  const onSearch = async (e) => {
    e?.preventDefault?.();
    setError("");

    if (!query.trim()) return;

    try {
      setLoading(true);
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        query.trim()
      )}&count=5&language=en&format=json`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("Geocoding failed");

      const data = await res.json();
      setCities(data?.results || []);

      if (data?.results?.length > 0) {
        setSelected(data.results[0]);
      } else {
        setSelected(null);
        setWx(null);
        setError("❌ No matching city found.");
      }
    } catch (err) {
      setError("❌ Search error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------
  // Fetch weather for city
  // -----------------------------
  const fetchWeather = async (loc) => {
    if (!loc) return;
    setLoading(true);
    setError("");

    try {
      const tempUnit = unit === "c" ? "celsius" : "fahrenheit";
      const windUnit = unit === "c" ? "kmh" : "mph";

      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.searchParams.set("latitude", loc.latitude);
      url.searchParams.set("longitude", loc.longitude);
      url.searchParams.set("timezone", "auto");
      url.searchParams.set(
        "current",
        "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m"
      );
      url.searchParams.set("hourly", "temperature_2m,precipitation_probability");
      url.searchParams.set("temperature_unit", tempUnit);
      url.searchParams.set("wind_speed_unit", windUnit);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Weather fetch failed");

      const data = await res.json();
      setWx(data);
      setTz(data?.timezone || "auto");
    } catch (err) {
      setError("❌ Failed to fetch weather.");
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------
  // Auto-refresh every 60s
  // -----------------------------
  useEffect(() => {
    if (!selected) return;
    fetchWeather(selected);

    if (refreshTimer.current) clearInterval(refreshTimer.current);
    refreshTimer.current = setInterval(
      () => fetchWeather(selected),
      60_000
    );

    return () => refreshTimer.current && clearInterval(refreshTimer.current);
  }, [selected, unit]);

  // -----------------------------
  // Detect user location
  // -----------------------------
  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError("❌ Geolocation not supported.");
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const revUrl = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}&language=en&format=json`;
          const res = await fetch(revUrl);
          const data = await res.json();

          const place =
            data?.results?.[0] || {
              name: "My location",
              latitude,
              longitude,
            };

          setSelected(place);
          setQuery(place.name);
        } catch {
          setSelected({ name: "My location", latitude, longitude });
        } finally {
          setLoading(false);
        }
      },
      () => {
        setError("❌ Location permission denied.");
        setLoading(false);
      }
    );
  };

  // -----------------------------
  // Helpers
  // -----------------------------
  const CurrentIcon = useMemo(() => {
    if (!wx?.current) return Sun;
    const code = wx.current.weather_code;
    return WEATHER_MAP[code]?.Icon || Cloud;
  }, [wx]);

  const unitSym = unit === "c" ? "°C" : "°F";
  const windSym = unit === "c" ? "km/h" : "mph";

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-sky-100 to-white p-4 sm:p-8">
      <div className="mx-auto max-w-3xl">
        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mb-4 flex items-center gap-2"
        >
          <Cloud className="h-8 w-8" /> Weather Now
        </motion.h1>
        <p className="text-slate-600 mb-6">
          Quickly check live weather for any city 🌍
        </p>

        {/* Search Bar */}
        <Card className="rounded-2xl shadow-sm mb-6">
          <CardContent className="p-4 sm:p-6">
            <form
              onSubmit={onSearch}
              className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-center"
            >
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-slate-500" />
                <Input
                  placeholder="Enter city (e.g., Delhi, London, Tokyo)"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-11"
                />
              </div>

              {/* Unit toggle + Search button */}
              <div className="flex gap-2">
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger className="h-11 w-[140px]">
                    <SelectValue placeholder="Units" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="c">℃ / km/h</SelectItem>
                    <SelectItem value="f">℉ / mph</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="submit" className="h-11">
                  Search
                </Button>
              </div>

              {/* My location button */}
              <Button
                type="button"
                variant="secondary"
                onClick={useMyLocation}
                className="h-11 flex items-center gap-2"
              >
                <LocateFixed className="h-4 w-4" /> Use my location
              </Button>
            </form>

            {/* Suggestions */}
            {cities.length > 0 && (
              <div className="mt-3 flex gap-2 flex-wrap">
                {cities.map((c, i) => (
                  <button
                    key={`${c.id}-${i}`}
                    onClick={() => setSelected(c)}
                    className={`px-3 py-1.5 rounded-full text-sm border ${
                      selected?.id === c.id
                        ? "bg-sky-600 text-white"
                        : "bg-white hover:bg-slate-50"
                    }`}
                  >
                    <MapPin className="h-4 w-4" /> {c.name},{" "}
                    {c.country || ""}
                  </button>
                ))}
              </div>
            )}

            {error && (
              <div className="mt-3 text-sm text-red-600">{error}</div>
            )}
          </CardContent>
        </Card>

        {/* Current Weather */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <Card className="rounded-2xl shadow-sm mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <CurrentIcon className="h-6 w-6" />
                {selected ? (
                  <>
                    {selected.name}{" "}
                    <span className="text-slate-500 text-base">
                      • {selected.country}
                    </span>
                  </>
                ) : (
                  <span>Choose a city</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-6">
              {/* Left: Main Temperature */}
              <div className="flex items-center gap-4">
                <Thermometer className="h-10 w-10" />
                <div>
                  <div className="text-4xl font-semibold">
                    {wx?.current
                      ? `${Math.round(wx.current.temperature_2m)}${unitSym}`
                      : "--"}
                  </div>
                  <div className="text-slate-600">
                    {wx?.current
                      ? WEATHER_MAP[wx.current.weather_code]?.label
                      : ""}
                  </div>
                  {wx?.current && (
                    <div className="text-slate-500 text-sm flex items-center gap-1 mt-1">
                      <Clock className="h-4 w-4" /> Updated{" "}
                      {prettyTime(wx.current.time, tz)} •{" "}
                      {prettyDate(wx.current.time, tz)}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Metrics */}
              <div className="grid grid-cols-3 gap-3">
                <Metric
                  label="Feels like"
                  value={
                    wx?.current
                      ? `${Math.round(wx.current.apparent_temperature)}${unitSym}`
                      : "--"
                  }
                />
                <Metric
                  label="Humidity"
                  value={
                    wx?.current ? `${wx.current.relative_humidity_2m}%` : "--"
                  }
                  Icon={Droplets}
                />
                <Metric
                  label="Wind"
                  value={
                    wx?.current
                      ? `${Math.round(wx.current.wind_speed_10m)} ${windSym}`
                      : "--"
                  }
                  Icon={Wind}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Next Hours */}
        {wx?.hourly?.time && (
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>Next Hours</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                {sampleNextHours(wx).map((h, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-white border flex flex-col items-center"
                  >
                    <div className="text-xs text-slate-500 mb-1">
                      {prettyTime(h.time, tz)}
                    </div>
                    <div className="text-lg font-semibold">
                      {Math.round(h.temp)}
                      {unitSym}
                    </div>
                    <div className="text-xs text-slate-500">
                      {h.precip}% rain
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <footer className="text-center text-xs text-slate-500 mt-8">
          Data powered by Open-Meteo (no API key required)
        </footer>
      </div>
    </div>
  );
}

// -----------------------------
// SMALL COMPONENTS
// -----------------------------
function Metric({ label, value, Icon }) {
  const Ico = Icon || Thermometer;
  return (
    <div className="rounded-xl border bg-white p-3">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="flex items-center gap-2 text-lg">
        <Ico className="h-4 w-4" /> {value}
      </div>
    </div>
  );
}

function sampleNextHours(wx) {
  // return next 6 hours forecast
  const nowIdx = wx.hourly.time.findIndex(
    (t) => new Date(t) >= new Date(wx.current.time)
  );
  const start = Math.max(0, nowIdx);
  const end = Math.min(wx.hourly.time.length, start + 6);

  return wx.hourly.time.slice(start, end).map((time, i) => ({
    time,
    temp: wx.hourly.temperature_2m?.[start + i],
    precip: wx.hourly.precipitation_probability?.[start + i] ?? 0,
  }));
}
