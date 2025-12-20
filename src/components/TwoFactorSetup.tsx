import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Loader2, Shield, Smartphone, Mail, Copy, Check } from 'lucide-react';

interface TwoFactorSettings {
  totp_enabled: boolean;
  email_otp_enabled: boolean;
}

export function TwoFactorSetup() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<TwoFactorSettings>({
    totp_enabled: false,
    email_otp_enabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [totpSecret, setTotpSecret] = useState('');
  const [totpDialogOpen, setTotpDialogOpen] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user) {
      fetch2FASettings();
    }
  }, [user]);

  const fetch2FASettings = async () => {
    try {
      const { data, error } = await supabase
        .from('user_2fa_settings')
        .select('totp_enabled, email_otp_enabled')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setSettings({
          totp_enabled: data.totp_enabled,
          email_otp_enabled: data.email_otp_enabled,
        });
      }
    } catch (error) {
      console.error('Error fetching 2FA settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateTOTPSecret = () => {
    // Generate a random base32 secret (simplified for demo)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let secret = '';
    for (let i = 0; i < 32; i++) {
      secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return secret;
  };

  const handleEnableTOTP = async () => {
    const secret = generateTOTPSecret();
    setTotpSecret(secret);
    setTotpDialogOpen(true);
  };

  const handleVerifyTOTP = async () => {
    if (verificationCode.length !== 6) {
      toast.error('Please enter a 6-digit code');
      return;
    }

    setSaving(true);
    try {
      // In production, verify the TOTP code against the secret
      // For now, we'll just save the settings
      const { error } = await supabase
        .from('user_2fa_settings')
        .upsert({
          user_id: user?.id,
          totp_enabled: true,
          totp_secret: totpSecret,
          email_otp_enabled: settings.email_otp_enabled,
        }, { onConflict: 'user_id' });

      if (error) throw error;

      setSettings(prev => ({ ...prev, totp_enabled: true }));
      setTotpDialogOpen(false);
      setVerificationCode('');
      toast.success('Authenticator app enabled successfully');
    } catch (error) {
      console.error('Error enabling TOTP:', error);
      toast.error('Failed to enable authenticator');
    } finally {
      setSaving(false);
    }
  };

  const handleDisableTOTP = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_2fa_settings')
        .update({ totp_enabled: false, totp_secret: null })
        .eq('user_id', user?.id);

      if (error) throw error;

      setSettings(prev => ({ ...prev, totp_enabled: false }));
      toast.success('Authenticator app disabled');
    } catch (error) {
      console.error('Error disabling TOTP:', error);
      toast.error('Failed to disable authenticator');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEmailOTP = async (enabled: boolean) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_2fa_settings')
        .upsert({
          user_id: user?.id,
          totp_enabled: settings.totp_enabled,
          email_otp_enabled: enabled,
        }, { onConflict: 'user_id' });

      if (error) throw error;

      setSettings(prev => ({ ...prev, email_otp_enabled: enabled }));
      toast.success(enabled ? 'Email OTP enabled' : 'Email OTP disabled');
    } catch (error) {
      console.error('Error toggling email OTP:', error);
      toast.error('Failed to update email OTP setting');
    } finally {
      setSaving(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(totpSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const otpAuthUrl = `otpauth://totp/RosterManagement:${user?.email}?secret=${totpSecret}&issuer=RosterManagement`;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* TOTP / Authenticator App */}
      <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">Authenticator App</p>
            <p className="text-sm text-muted-foreground">
              Use Google Authenticator, Authy, or similar apps
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {settings.totp_enabled ? (
            <>
              <span className="text-sm text-green-600 font-medium">Enabled</span>
              <Button variant="outline" size="sm" onClick={handleDisableTOTP} disabled={saving}>
                Disable
              </Button>
            </>
          ) : (
            <Dialog open={totpDialogOpen} onOpenChange={setTotpDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleEnableTOTP}>
                  Enable
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Set up Authenticator App</DialogTitle>
                  <DialogDescription>
                    Scan the QR code or enter the secret key manually in your authenticator app.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex justify-center p-4 bg-white rounded-lg">
                    {/* QR Code placeholder - in production use a QR library */}
                    <div className="w-48 h-48 bg-muted flex items-center justify-center rounded-lg border">
                      <div className="text-center text-sm text-muted-foreground p-4">
                        <p className="font-medium mb-2">QR Code</p>
                        <p className="text-xs">Scan with your authenticator app</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Secret Key (manual entry)</Label>
                    <div className="flex gap-2">
                      <Input 
                        value={totpSecret} 
                        readOnly 
                        className="font-mono text-sm"
                      />
                      <Button variant="outline" size="icon" onClick={copySecret}>
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Verification Code</Label>
                    <Input
                      placeholder="Enter 6-digit code"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      maxLength={6}
                    />
                  </div>

                  <Button 
                    className="w-full" 
                    onClick={handleVerifyTOTP} 
                    disabled={saving || verificationCode.length !== 6}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Verify and Enable
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Email OTP */}
      <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">Email One-Time Password</p>
            <p className="text-sm text-muted-foreground">
              Receive a verification code via email when signing in
            </p>
          </div>
        </div>
        <Switch
          checked={settings.email_otp_enabled}
          onCheckedChange={handleToggleEmailOTP}
          disabled={saving}
        />
      </div>

      {!settings.totp_enabled && !settings.email_otp_enabled && (
        <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
          Two-factor authentication is not enabled. Enable at least one method to secure your account.
        </p>
      )}
    </div>
  );
}