import { useMemo } from 'react';
import { format, eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarOff, Users } from 'lucide-react';

interface PreviewAssignment {
  member_id: string;
  shift_type: string;
  date: string;
  department: string;
}

interface WeekOffDistributionChartProps {
  assignments: PreviewAssignment[];
  month: Date;
  totalMembers: number;
}

const DAY_COLORS = {
  Sun: 'hsl(var(--destructive))',
  Mon: 'hsl(var(--primary))',
  Tue: 'hsl(var(--primary))',
  Wed: 'hsl(var(--primary))',
  Thu: 'hsl(var(--primary))',
  Fri: 'hsl(var(--primary))',
  Sat: 'hsl(var(--destructive))',
};

export function WeekOffDistributionChart({ 
  assignments, 
  month,
  totalMembers 
}: WeekOffDistributionChartProps) {
  const chartData = useMemo(() => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    // Count week-offs per day
    const offCountByDate: Record<string, number> = {};
    assignments.forEach(a => {
      if (a.shift_type === 'week-off' || a.shift_type === 'public-off' || a.shift_type === 'comp-off') {
        offCountByDate[a.date] = (offCountByDate[a.date] || 0) + 1;
      }
    });

    return days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayName = format(day, 'EEE');
      const offCount = offCountByDate[dateStr] || 0;
      const workingCount = totalMembers - offCount;
      
      return {
        date: format(day, 'd'),
        day: dayName,
        fullDate: dateStr,
        offCount,
        workingCount,
        coverage: totalMembers > 0 ? Math.round((workingCount / totalMembers) * 100) : 0,
      };
    });
  }, [assignments, month, totalMembers]);

  // Calculate weekly aggregation for day-of-week pattern
  const dayOfWeekStats = useMemo(() => {
    const stats: Record<string, { total: number; count: number }> = {};
    
    chartData.forEach(d => {
      if (!stats[d.day]) {
        stats[d.day] = { total: 0, count: 0 };
      }
      stats[d.day].total += d.offCount;
      stats[d.day].count += 1;
    });

    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => ({
      day,
      avgOff: stats[day] ? Math.round(stats[day].total / stats[day].count) : 0,
      totalOff: stats[day]?.total || 0,
    }));
  }, [chartData]);

  // Calculate min/max coverage
  const minCoverage = Math.min(...chartData.map(d => d.coverage));
  const maxCoverage = Math.max(...chartData.map(d => d.coverage));
  const avgOff = chartData.length > 0 
    ? Math.round(chartData.reduce((sum, d) => sum + d.offCount, 0) / chartData.length)
    : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <CalendarOff size={16} />
          Week-Off Distribution
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-2 rounded-lg bg-muted/50">
            <div className="text-lg font-bold text-primary">{avgOff}</div>
            <div className="text-[10px] text-muted-foreground">Avg Off/Day</div>
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <div className="text-lg font-bold text-green-600">{maxCoverage}%</div>
            <div className="text-[10px] text-muted-foreground">Max Coverage</div>
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <div className="text-lg font-bold text-amber-600">{minCoverage}%</div>
            <div className="text-[10px] text-muted-foreground">Min Coverage</div>
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <div className="text-lg font-bold">{totalMembers}</div>
            <div className="text-[10px] text-muted-foreground">Total Staff</div>
          </div>
        </div>

        {/* Daily Off Count Chart */}
        <div className="h-[120px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 9 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                tick={{ fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                width={30}
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-popover border rounded-lg shadow-lg p-2 text-xs">
                        <p className="font-medium">{data.day}, {format(new Date(data.fullDate), 'MMM d')}</p>
                        <p className="text-destructive">{data.offCount} off</p>
                        <p className="text-green-600">{data.workingCount} working ({data.coverage}%)</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="offCount" radius={[2, 2, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={DAY_COLORS[entry.day as keyof typeof DAY_COLORS] || 'hsl(var(--primary))'}
                    opacity={entry.day === 'Sun' || entry.day === 'Sat' ? 1 : 0.7}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Day of Week Pattern */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <Users size={12} />
            Average Off by Day of Week
          </p>
          <div className="grid grid-cols-7 gap-1">
            {dayOfWeekStats.map(d => (
              <div 
                key={d.day} 
                className={`p-1.5 rounded text-center text-xs ${
                  d.day === 'Sun' || d.day === 'Sat' 
                    ? 'bg-destructive/10 text-destructive' 
                    : 'bg-muted/50'
                }`}
              >
                <div className="font-medium">{d.day}</div>
                <div className="text-lg font-bold">{d.avgOff}</div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
