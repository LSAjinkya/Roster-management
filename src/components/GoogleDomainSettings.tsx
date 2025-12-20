import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Plus, X, Globe } from 'lucide-react';

export function GoogleDomainSettings() {
  const [domains, setDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchDomains();
  }, []);

  const fetchDomains = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'allowed_google_domains')
        .maybeSingle();

      if (error) throw error;
      
      if (data?.value) {
        // Handle both string and array formats
        const parsedValue = typeof data.value === 'string' 
          ? JSON.parse(data.value) 
          : data.value;
        setDomains(Array.isArray(parsedValue) ? parsedValue : []);
      }
    } catch (error) {
      console.error('Error fetching domains:', error);
      toast.error('Failed to load domain settings');
    } finally {
      setLoading(false);
    }
  };

  const saveDomains = async (newDomains: string[]) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({ value: JSON.stringify(newDomains) })
        .eq('key', 'allowed_google_domains');

      if (error) throw error;

      setDomains(newDomains);
      toast.success('Domain settings saved');
    } catch (error) {
      console.error('Error saving domains:', error);
      toast.error('Failed to save domain settings');
    } finally {
      setSaving(false);
    }
  };

  const handleAddDomain = () => {
    const domain = newDomain.trim().toLowerCase();
    
    if (!domain) {
      toast.error('Please enter a domain');
      return;
    }

    // Basic domain validation
    const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/;
    if (!domainRegex.test(domain)) {
      toast.error('Please enter a valid domain (e.g., example.com)');
      return;
    }

    if (domains.includes(domain)) {
      toast.error('This domain is already added');
      return;
    }

    const newDomains = [...domains, domain];
    saveDomains(newDomains);
    setNewDomain('');
  };

  const handleRemoveDomain = (domain: string) => {
    if (domains.length === 1) {
      toast.error('You must have at least one allowed domain');
      return;
    }

    const newDomains = domains.filter(d => d !== domain);
    saveDomains(newDomains);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <Globe className="h-5 w-5 text-muted-foreground" />
        <div>
          <p className="font-medium">Allowed Google Sign-in Domains</p>
          <p className="text-sm text-muted-foreground">
            Only users with email addresses from these domains can sign in with Google
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {domains.map((domain) => (
          <Badge 
            key={domain} 
            variant="secondary" 
            className="flex items-center gap-1.5 py-1.5 px-3"
          >
            @{domain}
            <button
              onClick={() => handleRemoveDomain(domain)}
              className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
              disabled={saving}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            placeholder="Enter domain (e.g., company.com)"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
            disabled={saving}
          />
        </div>
        <Button onClick={handleAddDomain} disabled={saving} size="icon">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Note: Users will only be able to sign in with Google if their email domain matches one of the allowed domains.
      </p>
    </div>
  );
}