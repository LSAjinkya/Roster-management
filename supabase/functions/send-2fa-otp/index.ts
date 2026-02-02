import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OTPRequest {
  email: string;
  userId: string;
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured. Please add RESEND_API_KEY." }),
        { status: 503, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const resend = new Resend(resendApiKey);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, userId }: OTPRequest = await req.json();

    if (!email || !userId) {
      return new Response(
        JSON.stringify({ error: "Email and userId are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Server-side rate limiting check
    const { data: rateLimit, error: rateLimitError } = await supabase
      .from("otp_rate_limits")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (rateLimitError) {
      console.error("Error checking rate limit:", rateLimitError);
    }

    // Check if user is locked out
    if (rateLimit?.lockout_until) {
      const lockoutUntil = new Date(rateLimit.lockout_until);
      if (new Date() < lockoutUntil) {
        const remainingMinutes = Math.ceil((lockoutUntil.getTime() - Date.now()) / 60000);
        return new Response(
          JSON.stringify({ 
            error: `Too many attempts. Please try again in ${remainingMinutes} minutes.`,
            lockout: true,
            lockoutUntil: lockoutUntil.toISOString()
          }),
          { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      } else {
        // Lockout expired, reset attempts
        await supabase
          .from("otp_rate_limits")
          .upsert({
            email,
            attempts: 1,
            lockout_until: null,
            last_attempt: new Date().toISOString()
          }, { onConflict: "email" });
      }
    } else if (rateLimit) {
      // Check if we need to reset based on time (reset after 1 hour of no attempts)
      const lastAttempt = new Date(rateLimit.last_attempt);
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      if (lastAttempt < hourAgo) {
        // Reset attempts after 1 hour of inactivity
        await supabase
          .from("otp_rate_limits")
          .upsert({
            email,
            attempts: 1,
            lockout_until: null,
            last_attempt: new Date().toISOString()
          }, { onConflict: "email" });
      } else if (rateLimit.attempts >= MAX_ATTEMPTS) {
        // Lock out user
        const lockoutUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        await supabase
          .from("otp_rate_limits")
          .upsert({
            email,
            attempts: rateLimit.attempts + 1,
            lockout_until: lockoutUntil.toISOString(),
            last_attempt: new Date().toISOString()
          }, { onConflict: "email" });

        return new Response(
          JSON.stringify({ 
            error: "Too many attempts. Locked out for 15 minutes.",
            lockout: true,
            lockoutUntil: lockoutUntil.toISOString()
          }),
          { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      } else {
        // Increment attempt counter
        await supabase
          .from("otp_rate_limits")
          .upsert({
            email,
            attempts: rateLimit.attempts + 1,
            last_attempt: new Date().toISOString()
          }, { onConflict: "email" });
      }
    } else {
      // First attempt - create rate limit record
      await supabase
        .from("otp_rate_limits")
        .insert({
          email,
          attempts: 1,
          last_attempt: new Date().toISOString()
        });
    }

    console.log(`Generating OTP for user: ${userId}, email: ${email}`);

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Delete any existing pending verification for this user
    await supabase
      .from("pending_2fa_verification")
      .delete()
      .eq("user_id", userId);

    // Store the OTP in the database
    const { error: insertError } = await supabase
      .from("pending_2fa_verification")
      .insert({
        user_id: userId,
        otp_code: otp,
        method: "email",
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("Error storing OTP:", insertError);
      throw new Error("Failed to store verification code");
    }

    console.log(`OTP stored successfully, sending email to: ${email}`);

    // Send the email
    const emailResponse = await resend.emails.send({
      from: "Roster Management <onboarding@resend.dev>",
      to: [email],
      subject: "Your Login Verification Code",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          <div style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h1 style="color: #333; margin-bottom: 24px; font-size: 24px;">Verification Code</h1>
            <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
              Use the following code to complete your sign-in:
            </p>
            <div style="background-color: #f0f0f0; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
              <span style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${otp}</span>
            </div>
            <p style="color: #999; font-size: 14px; line-height: 1.5;">
              This code will expire in 10 minutes. If you didn't request this code, please ignore this email.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, message: "Verification code sent" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-2fa-otp function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send verification code" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
