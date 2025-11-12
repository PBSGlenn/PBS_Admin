// PBS Admin - Upcoming Bookings Component
// Displays upcoming appointments and training sessions

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "../ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Button } from "../ui/button";
import { getUpcomingBookingsForDashboard } from "@/lib/services/eventService";
import { formatDate } from "@/lib/utils/dateUtils";

export function UpcomingBookings() {
  const [days, setDays] = useState(30);

  const { data: bookings, isLoading, error } = useQuery({
    queryKey: ["bookings", "upcoming", days],
    queryFn: () => getUpcomingBookingsForDashboard(days),
  });

  return (
    <div>
      {/* Filter buttons */}
      <div className="flex gap-1.5 mb-2">
        <Button
          variant={days === 7 ? "default" : "outline"}
          size="sm"
          onClick={() => setDays(7)}
          className="h-6 px-2 text-[11px]"
        >
          7d
        </Button>
        <Button
          variant={days === 14 ? "default" : "outline"}
          size="sm"
          onClick={() => setDays(14)}
          className="h-6 px-2 text-[11px]"
        >
          14d
        </Button>
        <Button
          variant={days === 30 ? "default" : "outline"}
          size="sm"
          onClick={() => setDays(30)}
          className="h-6 px-2 text-[11px]"
        >
          30d
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground">Loading bookings...</p>
        </div>
      ) : error ? (
        <div className="text-center py-4">
          <p className="text-xs text-destructive">Error loading bookings</p>
        </div>
      ) : !bookings || bookings.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground">
            No upcoming bookings in the next {days} days
          </p>
        </div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-7 text-[11px] py-1">Type</TableHead>
                <TableHead className="h-7 text-[11px] py-1">Client</TableHead>
                <TableHead className="h-7 text-[11px] py-1">Pet(s)</TableHead>
                <TableHead className="h-7 text-[11px] py-1">Date & Time</TableHead>
                <TableHead className="h-7 text-[11px] py-1">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((booking: any) => (
                <TableRow
                  key={booking.eventId}
                  className="cursor-pointer h-10"
                  onClick={() => {
                    // TODO: Navigate to event detail
                    console.log("View event:", booking.eventId);
                  }}
                >
                  <TableCell className="py-1">
                    <Badge variant="outline" className="text-[10px] h-5 px-1.5">{booking.eventType}</Badge>
                  </TableCell>
                  <TableCell className="font-medium text-xs py-1">
                    {booking.clientName}
                  </TableCell>
                  <TableCell className="text-[11px] text-muted-foreground py-1">
                    {booking.petNames || "-"}
                  </TableCell>
                  <TableCell className="py-1">
                    <div className="text-[11px] leading-tight">
                      <div>{formatDate(booking.date)}</div>
                      <div className="text-muted-foreground">
                        {formatDate(booking.date, "h:mm a")}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-1">
                    {booking.calendlyStatus && (
                      <Badge
                        variant={
                          booking.calendlyStatus === "Completed"
                            ? "success"
                            : booking.calendlyStatus === "Scheduled"
                            ? "info"
                            : "secondary"
                        }
                        className="text-[10px] h-5 px-1.5"
                      >
                        {booking.calendlyStatus}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
