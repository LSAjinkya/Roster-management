import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyTOTPRequest {
  userId: string;
  totpSecret: string;
  code: string;
  emailOtpEnabled: boolean;
}

// TOTP implementation based on RFC 6238
const base32Decode = (str: string): ArrayBuffer => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleanStr = str.toUpperCase().replace(/=+$/, '');
  
  let bits = '';
  for (const char of cleanStr) {
    const val = alphabet.indexOf(char);
    if (val === -1) throw new Error('Invalid base32 character');
    bits += val.toString(2).padStart(5, '0');
  }
  
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, (i + 1) * 8), 2);
  }
  
  return bytes.buffer as ArrayBuffer;
};

const verifyTOTP = async (secret: string, code: string, window: number = 1): Promise<boolean> => {
  // Check current time step and a window around it
  for (let i = -window; i <= window; i++) {
    const timeStep = 30;
    const counter = Math.floor(Date.now() / 1000 / timeStep) + i;
    
    const counterBuffer = new ArrayBuffer(8);
    const counterView = new DataView(counterBuffer);
    counterView.setBigUint64(0, BigInt(counter), false);
    
    const keyData = base32Decode(secret);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );
    
    const hmacResult = await crypto.subtle.sign('HMAC', key, counterBuffer);
    const hmacBytes = new Uint8Array(hmacResult);
    
    const offset = hmacBytes[hmacBytes.length - 1] & 0x0f;
    const binary = (
      ((hmacBytes[offset] & 0x7f) << 24) |
      ((hmacBytes[offset + 1] & 0xff) << 16) |
      ((hmacBytes[offset + 2] & 0xff) << 8) |
      (hmacBytes[offset + 3] & 0xff)
    );
    
    const expectedOtp = (binary % Math.pow(10, 6)).toString().padStart(6, '0');
    
    if (expectedOtp === code) {
      return true;
    }
  }
  
  return false;
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, totpSecret, code, emailOtpEnabled }: VerifyTOTPRequest = await req.json();

    if (!userId || !totpSecret || !code) {
      return new Response(
        JSON.stringify({ error: "userId, totpSecret, and code are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate code format
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      return new Response(
        JSON.stringify({ error: "Invalid code format. Please enter a 6-digit code." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Verifying TOTP for user: ${userId}`);

    // Verify the TOTP code against the secret
    const isValid = await verifyTOTP(totpSecret, code);

    if (!isValid) {
      console.log(`TOTP verification failed for user: ${userId}`);
      return new Response(
        JSON.stringify({ error: "Invalid verification code. Please scan the QR code and try again." }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`TOTP verified successfully for user: ${userId}`);

    // Save the 2FA settings
    const { error: upsertError } = await supabase
      .from("user_2fa_settings")
      .upsert({
        user_id: userId,
        totp_enabled: true,
        totp_secret: totpSecret,
        email_otp_enabled: emailOtpEnabled,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (upsertError) {
      console.error("Error saving 2FA settings:", upsertError);
      throw new Error("Failed to save 2FA settings");
    }

    return new Response(
      JSON.stringify({ success: true, message: "TOTP enabled successfully" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in verify-totp function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to verify TOTP" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
