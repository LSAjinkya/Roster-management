import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Download, Filter, History, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

interface Datacenter {
  id: string;
  name: string;
  code: string;
}

interface Transfer {
  id: string;
  member_id: string;
  source_datacenter_id: string | null;
  target_datacenter_id: string;
  transfer_date: string;
  shift_type: string;
  reason: string;
  status: string;
  created_at: string;
}

interface TeamMember {
  id: string;
  name: string;
}

export function DCTransferHistory() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [datacenters, setDatacenters] = useState<Datacenter[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [filterMonth, setFilterMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [filterDC, setFilterDC] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, [filterMonth]);

  async function fetchData() {
    setLoading(true);
    try {
      // Parse month filter
      const [year, month] = filterMonth.split('-').map(Number);
      const startDate = format(startOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');

      const [transfersRes, dcsRes, membersRes] = await Promise.all([
        supabase
          .from('dc_staff_transfers')
          .select('*')
          .gte('transfer_date', startDate)
          .lte('transfer_date', endDate)
          .order('transfer_date', { ascending: false }),
        supabase
          .from('datacenters')
          .select('id, name, code')
          .eq('is_active', true),
        supabase
          .from('team_members')
          .select('id, name')
          .eq('department', 'Infra')
      ]);

      if (transfersRes.error) throw transfersRes.error;
      if (dcsRes.error) throw dcsRes.error;
      if (membersRes.error) throw membersRes.error;

      setTransfers(transfersRes.data || []);
      setDatacenters(dcsRes.data || []);
      setMembers(membersRes.data || []);
    } catch (error) {
      console.error('Error fetching transfer history:', error);
    } finally {
      setLoading(false);
    }
  }

  function getMemberName(memberId: string) {
    return members.find(m => m.id === memberId)?.name || memberId;
  }

  function getDCName(dcId: string | null) {
    if (!dcId) return 'Home DC';
    return datacenters.find(dc => dc.id === dcId)?.name || 'Unknown';
  }

  // Filter transfers
  const filteredTransfers = transfers.filter(transfer => {
    if (filterDC !== 'all' && transfer.target_datacenter_id !== filterDC) return false;
    if (filterStatus !== 'all' && transfer.status !== filterStatus) return false;
    if (searchTerm) {
      const memberName = getMemberName(transfer.member_id).toLowerCase();
      if (!memberName.includes(searchTerm.toLowerCase())) return false;
    }
    return true;
  });

  // Calculate summary stats
  const stats = {
    total: filteredTransfers.length,
    active: filteredTransfers.filter(t => t.status === 'active').length,
    completed: filteredTransfers.filter(t => t.status === 'completed').length,
    cancelled: filteredTransfers.filter(t => t.status === 'cancelled').length,
  };

  function exportToCSV() {
    const headers = ['Date', 'Staff Member', 'From DC', 'To DC', 'Shift', 'Reason', 'Status'];
    const rows = filteredTransfers.map(t => [
      format(new Date(t.transfer_date), 'dd/MM/yyyy'),
      getMemberName(t.member_id),
      getDCName(t.source_datacenter_id),
      getDCName(t.target_datacenter_id),
      t.shift_type,
      t.reason,
      t.status
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dc-transfers-${filterMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Generate month options (last 12 months)
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy')
    };
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              DC Transfer History & Reports
            </CardTitle>
            <CardDescription>
              View and export datacenter staff transfer records
            </CardDescription>
          </div>
          <Button variant="outline" onClick={exportToCSV} disabled={filteredTransfers.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterDC} onValueChange={setFilterDC}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All DCs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All DCs</SelectItem>
                {datacenters.map(dc => (
                  <SelectItem key={dc.id} value={dc.id}>
                    {dc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder="Search staff name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-[200px]"
          />
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Transfers</div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.active}</div>
            <div className="text-sm text-muted-foreground">Active</div>
          </div>
          <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-950/30 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-500">{stats.cancelled}</div>
            <div className="text-sm text-muted-foreground">Cancelled</div>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredTransfers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No transfers found for the selected filters
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Staff Member</TableHead>
                <TableHead>From DC</TableHead>
                <TableHead>To DC</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransfers.map(transfer => (
                <TableRow key={transfer.id}>
                  <TableCell className="font-medium">
                    {format(new Date(transfer.transfer_date), 'dd MMM yyyy')}
                  </TableCell>
                  <TableCell>{getMemberName(transfer.member_id)}</TableCell>
                  <TableCell>{getDCName(transfer.source_datacenter_id)}</TableCell>
                  <TableCell>{getDCName(transfer.target_datacenter_id)}</TableCell>
                  <TableCell>
                    <span className="capitalize text-foreground">{transfer.shift_type}</span>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate" title={transfer.reason}>
                    {transfer.reason}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={
                        transfer.status === 'active' ? 'default' : 
                        transfer.status === 'completed' ? 'secondary' : 'outline'
                      }
                      className="capitalize"
                    >
                      {transfer.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
