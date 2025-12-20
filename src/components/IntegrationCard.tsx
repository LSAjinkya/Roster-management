import { ReactNode, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Check, X } from 'lucide-react';
import { IntegrationDialog } from './IntegrationDialog';

export interface IntegrationConfig {
  id: string;
  name: string;
  description: string;
  icon: ReactNode;
  bgColor: string;
  fields: {
    key: string;
    label: string;
    type: 'text' | 'password' | 'url';
    placeholder: string;
    helpText?: string;
  }[];
}

interface IntegrationCardProps {
  config: IntegrationConfig;
  isConnected: boolean;
  onConnect: (id: string, values: Record<string, string>) => void;
  onDisconnect: (id: string) => void;
}

export function IntegrationCard({ 
  config, 
  isConnected, 
  onConnect, 
  onDisconnect 
}: IntegrationCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleConnect = (values: Record<string, string>) => {
    onConnect(config.id, values);
    setDialogOpen(false);
  };

  return (
    <>
      <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/20">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-lg ${config.bgColor} flex items-center justify-center`}>
            {config.icon}
          </div>
          <div>
            <p className="font-medium">{config.name}</p>
            <p className="text-sm text-muted-foreground">{config.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isConnected ? (
            <>
              <Badge variant="outline" className="bg-green-500/20 text-green-700 border-green-500/30">
                <Check size={12} className="mr-1" />
                Connected
              </Badge>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 text-destructive hover:text-destructive"
                onClick={() => onDisconnect(config.id)}
              >
                <X size={14} />
                Disconnect
              </Button>
            </>
          ) : (
            <>
              <Badge variant="outline" className="bg-amber-500/20 text-amber-700 border-amber-500/30">
                Not Connected
              </Badge>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={() => setDialogOpen(true)}
              >
                <ExternalLink size={14} />
                Connect
              </Button>
            </>
          )}
        </div>
      </div>

      <IntegrationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        config={config}
        onSubmit={handleConnect}
      />
    </>
  );
}
