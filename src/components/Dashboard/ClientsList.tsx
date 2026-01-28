// PBS Admin - Clients List Component
// Displays searchable, sortable table of all clients

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { getClientsForDashboard } from "@/lib/services/clientService";
import { formatFullName } from "@/lib/utils";
import { formatDate } from "@/lib/utils/dateUtils";
import { Plus, Search } from "lucide-react";
import { LoadingCard } from "../ui/loading-spinner";

interface ClientsListProps {
  onNewClient?: () => void;
  onEditClient?: (client: any) => void;
}

export function ClientsList({ onNewClient, onEditClient }: ClientsListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: clients, isLoading, error } = useQuery({
    queryKey: ["clients", "dashboard"],
    queryFn: getClientsForDashboard,
  });

  // Filter clients based on search query
  const filteredClients = clients?.filter((client: any) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      client.firstName?.toLowerCase().includes(query) ||
      client.lastName?.toLowerCase().includes(query) ||
      client.email?.toLowerCase().includes(query) ||
      client.mobile?.includes(query) ||
      client.city?.toLowerCase().includes(query)
    );
  }) || [];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header with search and actions */}
      <div className="px-3 py-2 border-b border-border space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <Button size="sm" onClick={onNewClient} className="h-8">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            <span className="text-xs">New</span>
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          {filteredClients.length} client{filteredClients.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <LoadingCard message="Loading clients..." />
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-destructive">Error loading clients: {error instanceof Error ? error.message : String(error)}</p>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">No clients found</p>
              {searchQuery && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Try adjusting your search
                </p>
              )}
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-8 text-xs">Name</TableHead>
                <TableHead className="h-8 text-xs">Contact</TableHead>
                <TableHead className="h-8 text-xs">Location</TableHead>
                <TableHead className="h-8 text-xs text-center">Pets</TableHead>
                <TableHead className="h-8 text-xs">Last Event</TableHead>
                <TableHead className="h-8 text-xs text-center">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map((client: any) => (
                <TableRow
                  key={client.clientId}
                  className="cursor-pointer h-10"
                  onClick={() => {
                    if (onEditClient) {
                      onEditClient(client);
                    }
                  }}
                >
                  <TableCell className="font-medium text-xs py-1.5">
                    {formatFullName(client.firstName, client.lastName)}
                  </TableCell>
                  <TableCell className="py-1.5">
                    <div className="text-[11px] leading-tight">
                      <div className="truncate max-w-[140px]">{client.email}</div>
                      <div className="text-muted-foreground">{client.mobile}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs py-1.5">
                    {client.city && client.state
                      ? `${client.city}, ${client.state}`
                      : client.city || client.state || "-"}
                  </TableCell>
                  <TableCell className="text-center py-1.5">
                    <Badge variant="secondary" className="text-[10px] h-5 px-2">{client.petCount || 0}</Badge>
                  </TableCell>
                  <TableCell className="text-xs py-1.5">
                    {client.lastEventDate
                      ? formatDate(client.lastEventDate)
                      : "-"}
                  </TableCell>
                  <TableCell className="text-center py-1.5">
                    {client.hasNotes ? (
                      <Badge variant="outline" className="text-xs h-5 px-2">📝</Badge>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
