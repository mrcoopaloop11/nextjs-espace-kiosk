import { NextResponse, NextRequest } from 'next/server';

// Helper: Get Token
async function getToken() {
  const response = await fetch('https://api.espace.cool/api/v2/requesttoken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: process.env.ESPACE_API_KEY }),
    cache: 'no-store' 
  });

  if (!response.ok) throw new Error('Failed to get token');
  const data = await response.json();
  return data.token || data.access_token || data;
}

// Helper: Get Rooms
async function getEventSpaces(eventId: number, scheduleId: number, token: string) {
  try {
    const response = await fetch(
      `https://api.espace.cool/api/v2/event/spaces?eventId=${eventId}&scheduleId=${scheduleId}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.Data ? data.Data.map((s: any) => s.Name) : [];
  } catch {
    return [];
  }
}

// Main API Handler
export async function GET(request: NextRequest) {
  try {
    const token = await getToken();

    const searchParams = request.nextUrl.searchParams;
    const locationParam = searchParams.get('location');     
    const dayParam = searchParams.get('day') || 'today';     
    const filterParam = searchParams.get('filter') || 'active'; 

    const codeToSearch = locationParam || process.env.ESPACE_LOC_CODE || '';

    const now = new Date();
    const targetDateObj = new Date(now.getTime());
    // const targetDateObj = new Date(now);
    // targetDateObj.setHours(0, 0, 0, 0);
    
    if (dayParam === 'tomorrow') {
      targetDateObj.setDate(targetDateObj.getDate() + 1);
    } else if (Number.isFinite(Number(dayParam))) {
      targetDateObj.setDate(targetDateObj.getDate() + Number(dayParam));
    }
    
    const dateFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
    });
    
    const [tMonth, tDay, tYear] = dateFormatter.format(targetDateObj).split('/');
    const targetDateString = `${tYear}-${tMonth}-${tDay}`;

    const [cMonth, cDay, cYear] = dateFormatter.format(now).split('/');
    const currentTimeStr = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).format(now); 

    const currentPTString = `${cYear}-${cMonth}-${cDay}T${currentTimeStr}`;
    
    const fetchStart = encodeURIComponent(`${targetDateString}T00:00:00.000Z`);
    const fetchEnd = encodeURIComponent(`${targetDateString}T23:59:59.000Z`);

    const locationQuery = codeToSearch ? `&locCodes=${encodeURIComponent(codeToSearch)}` : '';
    
    const listResponse = await fetch(
      `https://api.espace.cool/api/v2/event/list?startDate=${fetchStart}&endDate=${fetchEnd}${locationQuery}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
    );

    const rawData = await listResponse.json();

    if (!rawData.Data) return NextResponse.json({ events: [], locationName: '' });

    // --- EXTRACT LOCATION NAME ---
    let foundLocationName = '';
    if (codeToSearch && rawData.Data.length > 0) {
      for (const event of rawData.Data) {
        const match = event.Locations?.find((l: any) => 
          l.LocationCode?.toLowerCase() === codeToSearch.toLowerCase() || 
          l.Name?.toLowerCase() === codeToSearch.toLowerCase()
        );
        if (match) {
          foundLocationName = match.Name;
          break;
        }
      }
    }

    // --- DEDUPLICATION LOGIC ---
    const seenEventIds = new Set();
    const uniqueEvents = rawData.Data.filter((e: any) => {
      if (seenEventIds.has(e.EventId)) return false; 
      seenEventIds.add(e.EventId); 
      return true; 
    });

    // 2. Filter for Approved & Active
    const activeAndApprovedEvents = uniqueEvents.filter((e: any) => {
      if (e.Status !== 'Approved') return false;
      if (filterParam === 'all') return true; 

      // Use Teardown time for expiry if it exists, otherwise use EndTime
      const expiryTimePart = e.TearDownEndTime || e.EndTime || '23:59:59';
      const expiryString = `${targetDateString}T${expiryTimePart}`;

      return expiryString > currentPTString;
    });

    // 3. Get Rooms and Format
    const detailedEvents = await Promise.all(
      activeAndApprovedEvents.map(async (e: any) => {
        const roomNames = await getEventSpaces(e.EventId, e.ScheduleId, token);
        
        const sTime = e.StartTime || '00:00:00';
        const fullStartDate = `${targetDateString}T${sTime}`;

        const eTime = e.EndTime || '23:59:59';
        const tTime = e.TearDownEndTime || eTime; // Fallback to end time
        
        // Logic for expiry (teardown)
        const expiryDate = `${targetDateString}T${tTime}`;

        return {
          id: e.EventId, 
          eventName: e.EventName, 
          scheduleName: e.ScheduleName, // This is now explicitly passed
          startDate: fullStartDate, 
          endDate: `${targetDateString}T${eTime}`, // Original end time for display
          expiryDate: expiryDate, // New field used for client-side auto-hide
          description: e.Description, 
          locationName: e.Locations?.[0]?.Name || '', 
          rooms: roomNames
        };
      })
    );

    // 4. SORT EVENTS CHRONOLOGICALLY BY START TIME
    detailedEvents.sort((a, b) => {
      const timeA = new Date(a.startDate).getTime();
      const timeB = new Date(b.startDate).getTime();
      return timeA - timeB;
    });

    return NextResponse.json({ events: detailedEvents, locationName: foundLocationName });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ events: [], locationName: '' }, { status: 500 });
  }
}