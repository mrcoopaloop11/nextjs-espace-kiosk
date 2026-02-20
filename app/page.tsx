"use client";

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef, Suspense } from "react";
import { IconDoor, IconClock, IconCalendar } from '@tabler/icons-react';

type EventData = {
  id: number;
  name: string;
  scheduleName: string; // Add this
  startDate: string;
  endDate: string;
  expiryDate: string;   // Add this
  description: string;
  rooms: string[];
  locationName: string;
};

// --- CONFIGURATION ---
// Add or remove times you want to act as separators. 
// Format must be 24-hour time: "HH:MM:00"
// To disable completely, just leave it empty: []
const TIME_SEPARATORS = [
  { time: "12:00:00", label: "12:00 PM" },
  { time: "17:00:00", label: "5:00 PM" }
];

function KioskContent() {
  const searchParams = useSearchParams();
  
  const locationCode = searchParams.get('location') || process.env.NEXT_PUBLIC_LOCATION_CODE || 'AN';
  const dayParam = searchParams.get('day') || 'today';     
  const filterParam = searchParams.get('filter') || 'active'; 
  const theme = searchParams.get('theme') || 'dark';
  
  const compressRooms = searchParams.get('compressRooms') !== 'false';
  const isDark = theme !== 'light';

  // State
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [displayDate, setDisplayDate] = useState<Date | null>(null);
  const [events, setEvents] = useState<EventData[]>([]);
  const [apiLocationName, setApiLocationName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. Clock Timer & Target Date Calculator
  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    const targetDate = new Date();
    if (dayParam === 'tomorrow') {
      targetDate.setDate(targetDate.getDate() + 1);
    } else if (dayParam !== 'today' && !isNaN(Number(dayParam))) {
      targetDate.setDate(targetDate.getDate() + Number(dayParam));
    }
    setDisplayDate(targetDate);

    return () => clearInterval(timer);
  }, [dayParam]);

  // 2. Data Fetcher
  const fetchEvents = async () => {
    try {
      const res = await fetch(`/api/events?location=${locationCode}&day=${dayParam}&filter=${filterParam}`);
      
      if (!res.ok) throw new Error(`API Error: ${res.status}`);

      const data = await res.json();
      setEvents(data.events || []);
      
      if (data.locationName) {
        setApiLocationName(data.locationName);
      }
      
      // We succeeded! Make sure offline warning is hidden.
      setIsOffline(false); 
      
    } catch (error) {
      console.error("Failed to fetch events. Keeping previous schedule on screen.", error);
      
      // We failed! Show the offline warning and retry in 60 seconds.
      setIsOffline(true);
      setTimeout(fetchEvents, 60 * 1000); 
    } finally {
      setLoading(false);
    }
  };

  // 3. Polling (5 mins)
  useEffect(() => {
    fetchEvents();
    const poller = setInterval(fetchEvents, 5 * 60 * 1000); 
    return () => clearInterval(poller);
  }, [locationCode, dayParam, filterParam]);

  // 4. Auto-Scroll Logic
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || loading || events.length === 0) return;

    let animationFrameId: number;
    let timeoutId: NodeJS.Timeout;
    let currentScroll = 0;
    let direction = 1; 
    let isPaused = true; 

    timeoutId = setTimeout(() => { isPaused = false; }, 5000);
    const speed = 1; 

    const animate = () => {
      if (!container) return;
      const maxScroll = container.scrollHeight - container.clientHeight;

      if (maxScroll > 0 && !isPaused) {
        currentScroll += speed * direction;
        
        if (currentScroll >= maxScroll) {
          currentScroll = maxScroll;
          isPaused = true;
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => { direction = -1; isPaused = false; }, 5000); 
        } 
        else if (currentScroll <= 0) {
          currentScroll = 0;
          isPaused = true;
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => { direction = 1; isPaused = false; }, 5000); 
        }
        
        container.scrollTop = currentScroll;
      }
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
      clearTimeout(timeoutId);
    };
  }, [events, loading]);

  // --- HELPERS ---
  const formatTime = (dateStr: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getCleanRooms = (rawRooms: string[], fallback: string) => {
    if (!rawRooms || rawRooms.length === 0) return [fallback || ""];

    let cleaned = rawRooms.map((r) => {
      let cleanName = r.replace(new RegExp(`^${locationCode}(?:,|\\s)\\s*`, 'i'), ""); 
      cleanName = cleanName.replace(/,\s*(?:Room|Rm|Rms)\s+.*$/i, ""); 
      return cleanName.trim();
    });

    cleaned = Array.from(new Set(cleaned.filter(Boolean)));

    if (!compressRooms || cleaned.length <= 1) {
      return cleaned.length > 0 ? cleaned : [fallback || ""];
    }

    const items = cleaned.map(name => ({
      original: name,
      tokens: name.split(/\s+/)
    }));

    const clustered: string[] = [];
    let unclustered = [...items];
    const maxTokens = Math.max(...items.map(t => t.tokens.length));

    for (let N = maxTokens - 1; N >= 1; N--) {
      const groups: Record<string, typeof items> = {};
      
      unclustered.forEach(item => {
        if (item.tokens.length > N) {
          const prefixKey = item.tokens.slice(0, N).join(' ').replace(/,/g, '').toLowerCase();
          if (!groups[prefixKey]) groups[prefixKey] = [];
          groups[prefixKey].push(item);
        }
      });

      const nextUnclustered: typeof items = [];
      const clusteredThisPass = new Set<string>();

      for (const key in groups) {
        const groupItems = groups[key];
        let shouldCluster = false;

        if (groupItems.length >= 2) {
          if (N >= 2) {
            shouldCluster = true;
          } else {
            const allTwoWords = groupItems.every(item => item.tokens.length <= 2);
            if (groupItems.length >= 3 || allTwoWords) {
              shouldCluster = true;
            }
          }
        }

        if (shouldCluster) {
          const actualPrefix = groupItems[0].tokens.slice(0, N).join(' ');
          const suffixes = groupItems.map(item => item.tokens.slice(N).join(' '));
          clustered.push(`${actualPrefix} ${suffixes.join(' + ')}`);
          groupItems.forEach(item => clusteredThisPass.add(item.original));
        }
      }

      unclustered.forEach(item => {
        if (!clusteredThisPass.has(item.original)) {
          nextUnclustered.push(item);
        }
      });
      unclustered = nextUnclustered;
    }

    unclustered.forEach(item => {
      clustered.push(item.original);
    });

    return clustered.sort();
  };

  // --- STYLES ---
  const styles = {
    main: isDark 
      ? "bg-gradient-to-br from-neutral-800 to-stone-900 text-neutral-300" 
      : "bg-gradient-to-br from-slate-100 to-white text-neutral-800",
    
    header: isDark 
      ? "bg-neutral-800 border-orange-900/30 shadow-lg" 
      : "bg-white border-orange-200 shadow-sm",
    
    headerTitle: isDark ? "text-white" : "text-neutral-900",
    headerSub: isDark ? "text-orange-500" : "text-orange-600",
    clockTime: isDark ? "text-white" : "text-neutral-900",
    clockDate: isDark ? "text-neutral-400" : "text-neutral-500",

    container: isDark 
      ? "bg-neutral-900 border-neutral-800 shadow-2xl" 
      : "bg-white border-slate-200 shadow-xl",

    tableHead: isDark 
      ? "bg-neutral-800 text-orange-500 border-neutral-700" 
      : "bg-slate-100 text-orange-600 border-slate-200",

    rowEven: isDark ? "bg-neutral-900" : "bg-white",
    rowOdd: isDark ? "bg-neutral-900/50" : "bg-slate-50",
    rowHover: isDark ? "hover:bg-orange-900/10" : "hover:bg-orange-50",
    
    cellTextMain: isDark ? "text-white" : "text-neutral-900",
    cellTextSub: isDark ? "text-neutral-500" : "text-neutral-400",
    cellBorder: isDark ? "border-neutral-800/50" : "border-slate-100",
  };

  if (!currentTime || !displayDate) return null;

  const fallbackTitle = dayParam === 'tomorrow' ? "Tomorrow's Schedule" 
    : dayParam !== 'today' ? "Upcoming Schedule" 
    : "Today's Schedule";

  const churchName = process.env.NEXT_PUBLIC_ESPACE_CHURCH_NAME || fallbackTitle;
  const rawLocationName = apiLocationName || process.env.NEXT_PUBLIC_ESPACE_CAMPUS || locationCode;
  const campusSubtitle = rawLocationName.toLowerCase().endsWith('campus') 
    ? rawLocationName 
    : `${rawLocationName} Campus`;

  const isToday = dayParam === 'today';

  // --- BUILD TABLE ROWS (Auto-Expiring & Dynamic Indicators) ---
  const tableRows: any[] = [];
  
  if (events.length > 0) {
    // NEW: Filter events locally against the ticking clock!
    // Even if the internet dies, events will vanish as their time passes.
    const visibleEvents = events.filter(event => {
      if (filterParam !== 'active') return true; 
      
      // Use expiryDate (teardown) instead of endDate (display end)
      const expiryTime = new Date(event.expiryDate).getTime();
      return expiryTime > currentTime.getTime(); 
    });

    let activeIndicators = [...TIME_SEPARATORS].sort((a, b) => a.time.localeCompare(b.time));

    if (isToday) {
      const h = currentTime.getHours().toString().padStart(2, '0');
      const m = currentTime.getMinutes().toString().padStart(2, '0');
      const currentString = `${h}:${m}:00`;
      
      activeIndicators = activeIndicators.filter(ind => ind.time > currentString);
    } else if (!isNaN(Number(dayParam)) && Number(dayParam) < 0) {
      activeIndicators = [];
    }

    let highestPrintedIndex = -1;

    // IMPORTANT: Loop over visibleEvents instead of events
    visibleEvents.forEach((event, i) => {
      const timeString = event.startDate.split('T')[1] || "00:00:00";

      let matchedIndex = -1;
      for (let j = activeIndicators.length - 1; j >= 0; j--) {
        if (timeString >= activeIndicators[j].time) {
          matchedIndex = j;
          break;
        }
      }

      if (matchedIndex > highestPrintedIndex) {
        tableRows.push({ 
          type: 'indicator', 
          label: activeIndicators[matchedIndex].label, 
          key: `indicator-${matchedIndex}` 
        });
        highestPrintedIndex = matchedIndex;
      }

      tableRows.push({ type: 'event', data: event, index: i, key: `${event.id}-${i}` });
    });
  }

  return (
    <main className={`min-h-screen font-sans flex flex-col selection:bg-orange-500 selection:text-white transition-colors duration-500 ${styles.main}`}>
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* NEW: Offline Warning Banner */}
      {isOffline && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-red-600/90 backdrop-blur-sm text-white text-xs px-4 py-1.5 rounded-b-lg font-bold uppercase tracking-widest shadow-lg z-50 flex items-center gap-2">
          <span className="animate-pulse w-2 h-2 bg-white rounded-full"></span>
          Offline • Using Cached Schedule
        </div>
      )}

      {/* Header */}
      <header className={`px-8 py-6 flex items-center justify-between z-20 relative border-b ${styles.header}`}>
        <div>
          <h1 className={`text-3xl font-bold tracking-tight ${styles.headerTitle}`}>
            {churchName}
          </h1>
          <p className={`text-lg font-medium tracking-wide capitalize mt-1 ${styles.headerSub}`}>
            {campusSubtitle}
          </p>
        </div>

        <div className="text-right">
          {isToday ? (
            <>
              <div className={`text-4xl font-variant-numeric tabular-nums font-semibold tracking-tight ${styles.clockTime}`}>
                {currentTime.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </div>
              <div className={`text-lg font-medium mt-1 ${styles.clockDate}`}>
                {displayDate.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </div>
            </>
          ) : (
            <div className={`text-3xl font-bold tracking-tight mt-2 ${styles.clockTime}`}>
              {displayDate.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </div>
          )}
        </div>
      </header>

      {/* Table Container */}
      <div className="flex-1 overflow-hidden p-6 flex flex-col">
        <div className={`border rounded-lg flex flex-col h-full overflow-hidden ${styles.container}`}>
          
          <div ref={scrollRef} className="overflow-y-auto flex-1 h-full no-scrollbar">
            <table className="w-full text-left border-collapse table-fixed">
              <thead className={`uppercase text-lg tracking-wider font-bold sticky top-0 z-10 shadow-md ${styles.tableHead}`}>
                <tr>
                  <th className={`w-[160px] px-6 py-4 border-b ${isDark ? 'border-neutral-700 bg-neutral-800' : 'border-slate-200 bg-slate-100'}`}>
                    <div className="flex items-center gap-2">
                      <IconClock size={24} />
                      <span>Time</span>
                    </div>
                  </th>
                  <th className={`w-[50%] px-6 py-4 border-b ${isDark ? 'border-neutral-700 bg-neutral-800' : 'border-slate-200 bg-slate-100'}`}>
                    <div className="flex items-center gap-2">
                      <IconCalendar size={24} />
                      <span>Event Name</span>
                    </div>
                  </th>
                  <th className={`w-[40%] px-6 py-4 border-b ${isDark ? 'border-neutral-700 bg-neutral-800' : 'border-slate-200 bg-slate-100'}`}>
                    <div className="flex items-center gap-2">
                      <IconDoor size={24} />
                      <span>Rooms</span>
                    </div>
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-32 text-center text-neutral-500 text-2xl animate-pulse">
                      Loading schedule...
                    </td>
                  </tr>
                ) : tableRows.length > 0 ? (
                  tableRows.map((row) => {
                    // --- RENDER TIME INDICATOR ROW ---
                    if (row.type === 'indicator') {
                      return (
                        <tr key={row.key} className="bg-transparent pointer-events-none">
                          <td colSpan={3} className="p-2 align-middle">
                            <div className="flex items-center gap-4 opacity-70">
                              <div className="h-px bg-orange-500 flex-1"></div>
                              <span className="text-orange-500 font-bold uppercase tracking-widest text-lg">
                                {row.label}
                              </span>
                              <div className="h-px bg-orange-500 flex-1"></div>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    // --- RENDER NORMAL EVENT ROW ---
                    const event = row.data;
                    const i = row.index;
                    
                    const rooms = getCleanRooms(event.rooms, event.locationName);
                    const totalChars = rooms.join("").length;
                    const count = rooms.length;
                    
                    let sizeClass = "text-2xl leading-normal"; 
                    let gapClass = "gap-1";

                    if (count > 4 || totalChars > 60) {
                      sizeClass = "text-lg leading-tight";
                      gapClass = "gap-0";
                    } else if (count > 2 || totalChars > 30) {
                      sizeClass = "text-xl leading-snug";
                      gapClass = "gap-0.5";
                    }

                    return (
                      <tr
                        key={row.key}
                        className={`transition-colors border-b last:border-0 ${styles.rowHover} ${styles.cellBorder} ${
                          i % 2 === 0 ? styles.rowEven : styles.rowOdd
                        }`}
                      >
                        {/* Time */}
                        <td className={`px-6 py-6 align-top whitespace-nowrap text-2xl font-medium font-variant-numeric tabular-nums border-r ${styles.cellBorder}`}>
                          <div className="flex flex-col gap-1">
                            <span className={styles.cellTextMain}>
                              {formatTime(event.startDate)}
                            </span>
                            <span className={`text-base ${styles.cellTextSub}`}>
                              {formatTime(event.endDate)}
                            </span>
                          </div>
                        </td>

                        {/* Event Name & Schedule Name Column */}
                        <td className={`px-6 py-6 align-top border-r ${styles.cellBorder}`}>
                          <div className="flex items-center gap-2 flex-wrap text-left">
                            {/* Primary Text: Always show the Schedule Name as the main heading */}
                            <span className={`text-3xl font-bold leading-tight ${styles.cellTextMain}`}>
                              {event.scheduleName}
                            </span>

                            {/* Secondary Text: Only show Event Name if it is different from the Schedule Name */}
                            {event.eventName && event.eventName !== event.scheduleName && (
                              <>
                                <span className={`${styles.headerSub} text-xl pt-1`}>•</span>
                                <span className={`text-sm font-semibold tracking-wider ${styles.headerSub} opacity-90 pt-2`}>
                                  {event.eventName}
                                </span>
                              </>
                            )}
                          </div>

                          {/* Description */}
                          {event.description && (
                            <p className={`text-lg font-normal mt-2 line-clamp-2 ${styles.cellTextSub}`}>
                              {event.description}
                            </p>
                          )}
                        </td>

                        {/* Rooms */}
                        <td className={`px-6 py-6 align-top break-words ${styles.cellTextSub}`}>
                          <div className={`flex flex-col overflow-hidden ${sizeClass} ${gapClass}`}>
                            {rooms.length > 4 ? (
                              <span>{rooms.join(", ")}</span>
                            ) : (
                              rooms.map((r: string, rIdx: number) => (
                                <div key={rIdx}>{r}</div>
                              ))
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={3} className="px-6 py-32 text-center text-neutral-500 text-2xl font-light">
                      No approved events scheduled for {
                        dayParam === 'today' ? "today" : 
                        dayParam === 'tomorrow' ? "tomorrow" : 
                        "this date"
                      }.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function KioskPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">Loading...</div>}>
      <KioskContent />
    </Suspense>
  );
}