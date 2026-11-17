import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toIcsDate(isoDate: string): string {
  return isoDate.replace(/-/g, "");
}

function toIcsStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const apartmentId = new URL(req.url).searchParams.get("apartment_id") ?? "";
    if (!UUID_PATTERN.test(apartmentId)) {
      return jsonResponse({ error: "Invalid apartment_id" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { data: apartment, error: aptError } = await supabase
      .from("apartments")
      .select("id")
      .eq("id", apartmentId)
      .maybeSingle();
    if (aptError) throw new Error(`Failed to fetch apartment: ${aptError.message}`);
    if (!apartment) return jsonResponse({ error: "Apartment not found" }, 404);

    const today = new Date().toISOString().split("T")[0];
    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select("id, check_in, check_out")
      .eq("apartment_id", apartmentId)
      .eq("archived", false)
      .is("external_uid", null)
      .gte("check_out", today)
      .order("check_in", { ascending: true });
    if (bookingsError) throw new Error(`Failed to fetch bookings: ${bookingsError.message}`);

    // Fetch recently-deleted manual bookings so we can emit CANCELLED events.
    // Airbnb only releases dates when it sees an explicit CANCELLED VEVENT —
    // simply omitting the event leaves the dates blocked.
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: deletedBookings, error: deletedError } = await supabase
      .from("deleted_bookings")
      .select("ical_uid, check_in, check_out")
      .eq("apartment_id", apartmentId)
      .gte("deleted_at", thirtyDaysAgo);
    if (deletedError) throw new Error(`Failed to fetch deleted bookings: ${deletedError.message}`);

    // Clean up entries older than 30 days
    if (deletedBookings && deletedBookings.length > 0) {
      supabase
        .from("deleted_bookings")
        .delete()
        .eq("apartment_id", apartmentId)
        .lt("deleted_at", thirtyDaysAgo)
        .then(({ error }) => {
          if (error) console.error("Failed to clean up old deleted_bookings:", error.message);
        });
    }

    const stamp = toIcsStamp(new Date());
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Property Management//Booking Export//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
    ];
    for (const booking of bookings ?? []) {
      lines.push(
        "BEGIN:VEVENT",
        `UID:booking-${booking.id}@property-management`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${toIcsDate(booking.check_in)}`,
        `DTEND;VALUE=DATE:${toIcsDate(booking.check_out)}`,
        "SUMMARY:Reserved",
        "END:VEVENT",
      );
    }
    for (const deleted of deletedBookings ?? []) {
      lines.push(
        "BEGIN:VEVENT",
        `UID:${deleted.ical_uid}`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${toIcsDate(deleted.check_in)}`,
        `DTEND;VALUE=DATE:${toIcsDate(deleted.check_out)}`,
        "SUMMARY:Cancelled",
        "STATUS:CANCELLED",
        "END:VEVENT",
      );
    }
    lines.push("END:VCALENDAR");

    return new Response(lines.join("\r\n") + "\r\n", {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
