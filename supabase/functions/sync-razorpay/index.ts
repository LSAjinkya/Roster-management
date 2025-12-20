import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RAZORPAY_BASE_URL = 'https://api.razorpay.com/v1';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const keyId = Deno.env.get('RAZORPAY_KEY_ID');
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!keyId || !keySecret) {
      console.error('Razorpay credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Razorpay credentials not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = btoa(`${keyId}:${keySecret}`);
    const headers = {
      'Authorization': `Basic ${authHeader}`,
      'Content-Type': 'application/json',
    };

    const { syncType } = await req.json();
    console.log(`Starting Razorpay sync for: ${syncType || 'all'}`);

    const results: Record<string, any> = {};

    // Sync Employees
    if (!syncType || syncType === 'employees') {
      console.log('Fetching employees from Razorpay...');
      try {
        const employeesResponse = await fetch(`${RAZORPAY_BASE_URL}/employees`, { headers });
        
        if (employeesResponse.ok) {
          const employeesData = await employeesResponse.json();
          const employees = employeesData.items || [];
          console.log(`Found ${employees.length} employees`);

          for (const emp of employees) {
            // Map Razorpay employee to team_members table
            const { error } = await supabase
              .from('team_members')
              .upsert({
                id: emp.id,
                name: emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
                email: emp.email,
                department: emp.department || 'General',
                role: emp.designation || 'member',
                status: emp.status === 'active' ? 'active' : 'inactive',
              }, { onConflict: 'id' });

            if (error) {
              console.error(`Error upserting employee ${emp.id}:`, error);
            }
          }
          results.employees = { synced: employees.length };
        } else {
          const errorText = await employeesResponse.text();
          console.error('Failed to fetch employees:', errorText);
          results.employees = { error: 'Failed to fetch from Razorpay' };
        }
      } catch (empError) {
        console.error('Employee sync error:', empError);
        results.employees = { error: empError instanceof Error ? empError.message : 'Unknown error' };
      }
    }

    // Sync Attendance (check-in/check-out)
    if (!syncType || syncType === 'attendance') {
      console.log('Fetching attendance from Razorpay...');
      try {
        const today = new Date().toISOString().split('T')[0];
        const attendanceResponse = await fetch(
          `${RAZORPAY_BASE_URL}/attendance?from=${today}&to=${today}`,
          { headers }
        );

        if (attendanceResponse.ok) {
          const attendanceData = await attendanceResponse.json();
          const records = attendanceData.items || [];
          console.log(`Found ${records.length} attendance records`);

          for (const record of records) {
            // Map to shift_assignments or a dedicated attendance table
            const { error } = await supabase
              .from('shift_assignments')
              .upsert({
                member_id: record.employee_id,
                date: record.date,
                department: 'General',
                shift_type: record.check_in ? 'present' : 'absent',
              }, { onConflict: 'member_id,date' });

            if (error) {
              console.error(`Error upserting attendance ${record.employee_id}:`, error);
            }
          }
          results.attendance = { synced: records.length };
        } else {
          const errorText = await attendanceResponse.text();
          console.error('Failed to fetch attendance:', errorText);
          results.attendance = { error: 'Failed to fetch from Razorpay' };
        }
      } catch (attError) {
        console.error('Attendance sync error:', attError);
        results.attendance = { error: attError instanceof Error ? attError.message : 'Unknown error' };
      }
    }

    // Sync Leaves
    if (!syncType || syncType === 'leaves') {
      console.log('Fetching leaves from Razorpay...');
      try {
        const leavesResponse = await fetch(`${RAZORPAY_BASE_URL}/leaves`, { headers });

        if (leavesResponse.ok) {
          const leavesData = await leavesResponse.json();
          const leaves = leavesData.items || [];
          console.log(`Found ${leaves.length} leave records`);

          for (const leave of leaves) {
            const { error } = await supabase
              .from('leave_requests')
              .upsert({
                id: leave.id,
                user_id: leave.employee_id,
                start_date: leave.from_date,
                end_date: leave.to_date,
                leave_type: leave.leave_type || 'casual',
                status: leave.status === 'approved' ? 'approved' : 
                        leave.status === 'rejected' ? 'rejected' : 'pending',
                reason: leave.reason || null,
              }, { onConflict: 'id' });

            if (error) {
              console.error(`Error upserting leave ${leave.id}:`, error);
            }
          }
          results.leaves = { synced: leaves.length };
        } else {
          const errorText = await leavesResponse.text();
          console.error('Failed to fetch leaves:', errorText);
          results.leaves = { error: 'Failed to fetch from Razorpay' };
        }
      } catch (leaveError) {
        console.error('Leave sync error:', leaveError);
        results.leaves = { error: leaveError instanceof Error ? leaveError.message : 'Unknown error' };
      }
    }

    // Sync Public Holidays
    if (!syncType || syncType === 'holidays') {
      console.log('Fetching holidays from Razorpay...');
      try {
        const holidaysResponse = await fetch(`${RAZORPAY_BASE_URL}/holidays`, { headers });

        if (holidaysResponse.ok) {
          const holidaysData = await holidaysResponse.json();
          const holidays = holidaysData.items || [];
          console.log(`Found ${holidays.length} holidays`);

          for (const holiday of holidays) {
            const { error } = await supabase
              .from('public_holidays')
              .upsert({
                id: holiday.id,
                name: holiday.name,
                date: holiday.date,
                year: new Date(holiday.date).getFullYear(),
                description: holiday.description || null,
              }, { onConflict: 'id' });

            if (error) {
              console.error(`Error upserting holiday ${holiday.id}:`, error);
            }
          }
          results.holidays = { synced: holidays.length };
        } else {
          const errorText = await holidaysResponse.text();
          console.error('Failed to fetch holidays:', errorText);
          results.holidays = { error: 'Failed to fetch from Razorpay' };
        }
      } catch (holError) {
        console.error('Holiday sync error:', holError);
        results.holidays = { error: holError instanceof Error ? holError.message : 'Unknown error' };
      }
    }

    console.log('Sync completed:', results);
    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
