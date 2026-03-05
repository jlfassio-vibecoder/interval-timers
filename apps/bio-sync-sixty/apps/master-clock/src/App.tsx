import React, { useState, useEffect } from 'react';
import { addHours, addMinutes, isAfter, isBefore, differenceInMinutes } from 'date-fns';
import { fromZonedTime, toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { MapPin, Sun, Clock, Search, Navigation, AlertCircle, Info, Sunrise, Sunset, Utensils } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from './lib/utils';

interface LocationData {
  name: string;
  lat: number;
  lng: number;
  /** IANA timezone (e.g. America/New_York). From Open-Meteo when searching; when missing we use browser timezone so feeding window aligns with location. */
  timezone?: string;
}

interface SunData {
  sunrise: Date;
  sunset: Date;
  civilSunrise: Date;
  civilSunset: Date;
}

export default function App() {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  
  const [wakeTime, setWakeTime] = useState('06:30');
  const [bedTime, setBedTime] = useState('22:00');
  const [hungerDelay, setHungerDelay] = useState(60);
  const [feedingDuration, setFeedingDuration] = useState(10);
  
  const [sunData, setSunData] = useState<SunData | null>(null);
  const [isLoadingSun, setIsLoadingSun] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (location) {
      fetchSunData(location.lat, location.lng);
    }
  }, [location]);

  const fetchSunData = async (lat: number, lng: number) => {
    setIsLoadingSun(true);
    setError(null);
    try {
      // API returns UTC times; we interpret wake/bed and display in location timezone (or browser tz when unknown).
      const res = await fetch(`https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&formatted=0`);
      const data = await res.json();
      if (data.status === 'OK') {
        setSunData({
          sunrise: new Date(data.results.sunrise),
          sunset: new Date(data.results.sunset),
          civilSunrise: new Date(data.results.civil_twilight_begin),
          civilSunset: new Date(data.results.civil_twilight_end),
        });
      } else {
        setError('Failed to fetch sunrise/sunset data.');
      }
    } catch (err) {
      setError('Network error while fetching sun data.');
    } finally {
      setIsLoadingSun(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setError(null);
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchQuery)}&count=5&language=en&format=json`);
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        setSearchResults(data.results);
      } else {
        setSearchResults([]);
        setError('No locations found.');
      }
    } catch (err) {
      setError('Failed to search location.');
    } finally {
      setIsSearching(false);
    }
  };

  const selectLocation = (result: any) => {
    setLocation({
      name: `${result.name}, ${result.admin1 || result.country}`,
      lat: result.latitude,
      lng: result.longitude,
      timezone: result.timezone, // Open-Meteo returns IANA timezone so feeding window aligns with selected location
    });
    setSearchResults([]);
    setSearchQuery('');
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser. Use HTTPS or localhost.');
      return;
    }
    
    setError(null);
    setIsGettingLocation(true);
    const opts: PositionOptions = {
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 300000, // 5 min cache
    };
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`;
          // User-Agent cannot be set from client fetch (forbidden header); browser sends its own.
          const res = await fetch(url, {
            headers: { 'Accept': 'application/json' },
          });
          const data = res.ok ? await res.json() : null;
          const addr = data?.address;
          const name = addr?.city || addr?.town || addr?.village || addr?.municipality || 'Current Location';
          const region = addr?.state || addr?.country || '';
          setLocation({
            name: region ? `${name}, ${region}` : name,
            lat: latitude,
            lng: longitude,
          });
        } catch {
          setLocation({
            name: 'Current Location',
            lat: latitude,
            lng: longitude,
          });
        } finally {
          setIsGettingLocation(false);
        }
      },
      (err: GeolocationPositionError) => {
        setIsGettingLocation(false);
        const message =
          err.code === 1
            ? 'Location denied. Allow location access for this site and try again.'
            : err.code === 2
              ? 'Location unavailable. Check device location/GPS and try again.'
              : err.code === 3
                ? 'Location request timed out. Try again.'
                : 'Unable to retrieve your location. Use HTTPS or localhost and check permissions.';
        setError(message);
      },
      opts
    );
  };

  // Effective timezone: use location's so feeding window aligns with selected place; fallback to browser when unknown (e.g. current location).
  const tz = location?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Calculate feeding window (sun data is UTC; wake/bed interpreted in location timezone)
  let feedingStart: Date | null = null;
  let feedingEnd: Date | null = null;
  let wakeDate: Date | null = null;
  let bedDate: Date | null = null;
  let warnings: string[] = [];
  let isOptimal = false;

  if (sunData && wakeTime && bedTime) {
    const zonedNow = toZonedTime(new Date(), tz);
    const [wakeH, wakeM] = wakeTime.split(':').map(Number);
    const [bedH, bedM] = bedTime.split(':').map(Number);
    const y = zonedNow.getFullYear();
    const mo = zonedNow.getMonth();
    const d = zonedNow.getDate();
    wakeDate = fromZonedTime(new Date(y, mo, d, wakeH, wakeM), tz);
    bedDate = fromZonedTime(new Date(y, mo, d, bedH, bedM), tz);

    if (isBefore(bedDate, wakeDate)) {
      bedDate = addHours(bedDate, 24);
    }

    const metabolicReadyTime = addMinutes(wakeDate, hungerDelay);
    feedingStart = isAfter(metabolicReadyTime, sunData.sunrise) ? metabolicReadyTime : sunData.sunrise;
    feedingEnd = addHours(feedingStart, feedingDuration);

    // Check if window extends past sunset
    if (isAfter(feedingEnd, sunData.sunset)) {
      warnings.push(`Your ${feedingDuration}-hour window extends past sunset. Consider waking up earlier to fully align with daylight.`);
    } else {
      isOptimal = true;
    }

    // Check hunger delay (Melatonin-Insulin Conflict)
    if (hungerDelay < 60) {
      warnings.push("Eating within 1 hour of waking may spike glucose due to lingering melatonin. Consider waiting 60-90 mins.");
      isOptimal = false;
    }

    // Check if window is too close to bedtime (ideally 2-3 hours before)
    const hoursBeforeBed = differenceInMinutes(bedDate, feedingEnd) / 60;
    if (hoursBeforeBed < 2) {
      warnings.push(`Your window ends only ${Math.round(hoursBeforeBed * 10) / 10} hours before bed. Aim for at least 2 hours of fasting before sleep.`);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans selection:bg-emerald-500/30">
      <div className="max-w-3xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        
        {/* Header */}
        <header className="mb-12 text-center sm:text-left">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-3">
            Bio-Sync<span className="text-emerald-500">{feedingDuration < 10 ? `0${feedingDuration}` : feedingDuration}</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-xl">
            Align your {feedingDuration}-hour feeding window with seasonal daylight to perfect the Metabolic Switch.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Controls Sidebar */}
          <div className="md:col-span-5 space-y-6">
            
            {/* Location Card */}
            <div className="bg-[#171717] rounded-2xl p-6 border border-white/5 shadow-xl">
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Location
              </h2>
              
              {location ? (
                <div className="flex items-center justify-between bg-black/20 rounded-xl p-4 border border-white/5">
                  <div>
                    <p className="font-medium text-white">{location.name}</p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                    </p>
                  </div>
                  <button 
                    onClick={() => setLocation(null)}
                    className="text-xs text-emerald-500 hover:text-emerald-400 font-medium px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <form onSubmit={handleSearch} className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Search city..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                    />
                  </form>
                  
                  {searchResults.length > 0 && (
                    <div className="bg-[#222] border border-white/10 rounded-xl overflow-hidden">
                      {searchResults.map((res, i) => (
                        <button
                          key={i}
                          onClick={() => selectLocation(res)}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors"
                        >
                          <span className="text-white">{res.name}</span>
                          <span className="text-zinc-500 ml-2">{res.admin1 || res.country}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="relative flex items-center py-2">
                    <div className="flex-grow border-t border-white/10"></div>
                    <span className="flex-shrink-0 mx-4 text-xs text-zinc-600 uppercase">or</span>
                    <div className="flex-grow border-t border-white/10"></div>
                  </div>

                  <button
                    type="button"
                    onClick={useCurrentLocation}
                    disabled={isGettingLocation}
                    className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-2.5 text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isGettingLocation ? (
                      <>
                        <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        Getting location…
                      </>
                    ) : (
                      <>
                        <Navigation className="w-4 h-4" />
                        Use Current Location
                      </>
                    )}
                  </button>
                </div>
              )}
              
              {error && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-200 leading-relaxed">{error}</p>
                </div>
              )}
            </div>

            {/* Sunrise / Sunset Card */}
            {sunData && (
              <div className="bg-[#171717] rounded-2xl p-6 border border-white/5 shadow-xl overflow-hidden relative">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                    <Sun className="w-4 h-4" /> Civil Daylight
                  </h2>
                  <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">
                    {formatInTimeZone(new Date(), tz, 'MMM d, yyyy')}
                  </span>
                </div>
                
                <div className="flex items-center justify-between relative z-10">
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-3">
                      <Sunrise className="w-6 h-6 text-amber-400" />
                    </div>
                    <p className="text-2xl font-light text-white">{formatInTimeZone(sunData.civilSunrise, tz, 'h:mm')}</p>
                    <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mt-1">Sunrise</p>
                  </div>
                  
                  <div className="flex-1 px-6 relative flex flex-col items-center">
                    {/* Animated arc or line */}
                    <div className="h-px w-full bg-gradient-to-r from-amber-500/0 via-amber-500/50 to-indigo-500/0 relative mb-4">
                      <motion.div 
                        className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]"
                        initial={{ left: "0%" }}
                        animate={{ left: "100%" }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", repeatType: "reverse" }}
                      />
                    </div>
                    
                    {/* Duration */}
                    <div className="text-center">
                      <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest mb-0.5">Total Duration</p>
                      <p className="text-sm font-medium text-emerald-400">
                        {Math.floor(differenceInMinutes(sunData.civilSunset, sunData.civilSunrise) / 60)}h {differenceInMinutes(sunData.civilSunset, sunData.civilSunrise) % 60}m
                      </p>
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-3">
                      <Sunset className="w-6 h-6 text-indigo-400" />
                    </div>
                    <p className="text-2xl font-light text-white">{formatInTimeZone(sunData.civilSunset, tz, 'h:mm')}</p>
                    <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mt-1">Sunset</p>
                  </div>
                </div>
              </div>
            )}

            {/* Schedule Card */}
            <div className="bg-[#171717] rounded-2xl p-6 border border-white/5 shadow-xl">
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Daily Schedule
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Wake Up</label>
                  <input
                    type="time"
                    value={wakeTime}
                    onChange={(e) => setWakeTime(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Bedtime</label>
                  <input
                    type="time"
                    value={bedTime}
                    onChange={(e) => setBedTime(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all [color-scheme:dark]"
                  />
                </div>
              </div>
            </div>

            {/* Metabolic Readiness Card */}
            <div className="bg-[#171717] rounded-2xl p-6 border border-white/5 shadow-xl">
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Utensils className="w-4 h-4" /> Metabolic Readiness
                </div>
                <span className={cn("font-mono", hungerDelay < 60 ? "text-amber-400" : "text-emerald-400")}>
                  +{hungerDelay}m
                </span>
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-2">
                    Time until first meal after waking
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="180"
                    step="15"
                    value={hungerDelay}
                    onChange={(e) => setHungerDelay(parseInt(e.target.value))}
                    className={cn(
                      "w-full cursor-pointer",
                      hungerDelay < 60 ? "accent-amber-500" : "accent-emerald-500"
                    )}
                  />
                  <div className="flex justify-between text-xs text-zinc-500 mt-2 font-mono">
                    <span>0m</span>
                    <span>60m</span>
                    <span>120m</span>
                    <span>180m</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-3 leading-relaxed">
                    {hungerDelay < 60 
                      ? "⚠️ Eating too soon may cause glucose spikes due to high melatonin."
                      : "✅ Waiting 60-90 mins allows melatonin to drop and cortisol to stabilize."}
                  </p>
                </div>
              </div>
            </div>

            {/* Feeding Window Card */}
            <div className="bg-[#171717] rounded-2xl p-6 border border-white/5 shadow-xl">
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sun className="w-4 h-4" /> Feeding Window
                </div>
                <span className="text-emerald-400 font-mono">{feedingDuration}h</span>
              </h2>
              
              <div className="space-y-4">
                <div>
                  <input
                    type="range"
                    min="6"
                    max="12"
                    step="1"
                    value={feedingDuration}
                    onChange={(e) => setFeedingDuration(parseInt(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-zinc-500 mt-2 font-mono">
                    <span>6h</span>
                    <span>8h</span>
                    <span>10h</span>
                    <span>12h</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Main Dashboard Area */}
          <div className="md:col-span-7 space-y-6">
            
            {/* Results Card */}
            <div className="bg-[#171717] rounded-2xl p-6 border border-white/5 shadow-xl min-h-[400px] flex flex-col">
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-6">
                Your Metabolic Switch
              </h2>

              {!location ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <MapPin className="w-8 h-8 text-zinc-600" />
                  </div>
                  <h3 className="text-lg font-medium text-white mb-2">Set your location</h3>
                  <p className="text-sm text-zinc-500 max-w-xs">
                    We need your location to calculate seasonal daylight hours and optimize your feeding window.
                  </p>
                </div>
              ) : isLoadingSun ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : sunData && feedingStart && feedingEnd ? (
                <div className="space-y-8 flex-1">
                  
                  {/* Big Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-black/20 rounded-2xl p-5 border border-white/5">
                      <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-1">Start Fast-Break</p>
                      <p className="text-3xl sm:text-4xl font-light text-white">
                        {formatInTimeZone(feedingStart, tz, 'h:mm')} <span className="text-lg text-zinc-500">{formatInTimeZone(feedingStart, tz, 'a')}</span>
                      </p>
                    </div>
                    <div className="bg-black/20 rounded-2xl p-5 border border-white/5">
                      <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-1">Start Fasting</p>
                      <p className="text-3xl sm:text-4xl font-light text-emerald-400">
                        {formatInTimeZone(feedingEnd, tz, 'h:mm')} <span className="text-lg text-emerald-400/50">{formatInTimeZone(feedingEnd, tz, 'a')}</span>
                      </p>
                    </div>
                  </div>

                  {/* Timeline Visualization */}
                  <div className="relative pt-8 pb-4">
                    {/* Time labels */}
                    <div className="flex justify-between text-[10px] text-zinc-600 font-mono mb-2 px-1">
                      <span>00:00</span>
                      <span>06:00</span>
                      <span>12:00</span>
                      <span>18:00</span>
                      <span>24:00</span>
                    </div>
                    
                    {/* The Bar */}
                    <div className="h-12 bg-black/40 rounded-xl relative overflow-hidden border border-white/5">
                      
                      {/* Daylight overlay (positions in location local time) */}
                      <div 
                        className="absolute top-0 bottom-0 bg-amber-500/20 border-x border-amber-500/30"
                        style={{
                          left: `${(toZonedTime(sunData.sunrise, tz).getHours() + toZonedTime(sunData.sunrise, tz).getMinutes()/60) / 24 * 100}%`,
                          right: `${100 - (toZonedTime(sunData.sunset, tz).getHours() + toZonedTime(sunData.sunset, tz).getMinutes()/60) / 24 * 100}%`
                        }}
                      />
                      
                      {/* Feeding Window overlay */}
                      <div 
                        className="absolute top-1 bottom-1 bg-emerald-500/20 border border-emerald-500/50 rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                        style={{
                          left: `${(toZonedTime(feedingStart, tz).getHours() + toZonedTime(feedingStart, tz).getMinutes()/60) / 24 * 100}%`,
                          width: `${feedingDuration / 24 * 100}%`
                        }}
                      />

                      {/* Wake Marker */}
                      {wakeDate && (
                        <div 
                          className="absolute top-0 bottom-0 w-px bg-blue-400 z-10"
                          style={{ left: `${(toZonedTime(wakeDate, tz).getHours() + toZonedTime(wakeDate, tz).getMinutes()/60) / 24 * 100}%` }}
                        >
                          <div className="absolute -top-6 -translate-x-1/2 text-[10px] text-blue-400 font-medium bg-[#171717] px-1 rounded">Wake</div>
                        </div>
                      )}

                      {/* Bed Marker */}
                      {bedDate && (
                        <div 
                          className="absolute top-0 bottom-0 w-px bg-indigo-400 z-10"
                          style={{ left: `${(toZonedTime(bedDate, tz).getHours() + toZonedTime(bedDate, tz).getMinutes()/60) / 24 * 100}%` }}
                        >
                          <div className="absolute -top-6 -translate-x-1/2 text-[10px] text-indigo-400 font-medium bg-[#171717] px-1 rounded">Bed</div>
                        </div>
                      )}
                    </div>
                    
                    {/* Legend */}
                    <div className="flex items-center justify-center gap-6 mt-6 text-xs text-zinc-500">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/30"></div>
                        <span>Daylight</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/50"></div>
                        <span className="text-emerald-400">{feedingDuration}h Feeding Window</span>
                      </div>
                    </div>
                  </div>

                  {/* Insights / Warnings */}
                  <div className="space-y-3 mt-auto">
                    {isOptimal && warnings.length === 0 ? (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                          <Sun className="w-3.5 h-3.5 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-emerald-400 mb-1">Perfectly Aligned</p>
                          <p className="text-xs text-emerald-400/70 leading-relaxed">
                            Your {feedingDuration}-hour window is perfectly aligned with daylight hours, optimizing your circadian rhythm and metabolic switch.
                          </p>
                        </div>
                      </div>
                    ) : (
                      warnings.map((warning, i) => (
                        <div key={i} className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                          <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-200/80 leading-relaxed">{warning}</p>
                        </div>
                      ))
                    )}
                  </div>

                </div>
              ) : null}
            </div>

            {/* Info Card */}
            <div className="bg-[#171717] rounded-2xl p-6 border border-white/5 shadow-xl">
              <h3 className="text-sm font-medium text-white mb-2">The Science of eTRE</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                By aligning food intake with daylight, we significantly reduce the Glycemic Area Under Curve (AUC), forcing the body to burn fat for fuel during the "Digital Sunset." A {feedingDuration}-hour window gives your digestive system a {24 - feedingDuration}-hour rest to repair and rejuvenate.
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
