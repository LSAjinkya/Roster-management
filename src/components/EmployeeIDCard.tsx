import { useRef, useState } from 'react';
import { TeamMember, WorkLocation } from '@/types/roster';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Download, Printer } from 'lucide-react';
import leapswitchLogo from '@/assets/leapswitch-logo-alt.png';

interface EmployeeIDCardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember;
  workLocation?: WorkLocation;
  avatarUrl?: string;
}

const COMPANY_INFO = {
  name: 'Leapswitch Networks Pvt. Ltd.',
  phone: '+91 9599656657',
  address: 'Spectra Premises Behind Jay Bhavani Bus Stop, Paud Rd, near Pratik Nagar, Kothrud, Pune, Maharashtra 411038',
};

export function EmployeeIDCard({
  open,
  onOpenChange,
  member,
  workLocation,
  avatarUrl,
}: EmployeeIDCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleDownload = async () => {
    if (!cardRef.current) return;
    
    setDownloading(true);
    try {
      // Dynamically import html2canvas
      const html2canvas = (await import('html2canvas')).default;
      
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      
      const link = document.createElement('a');
      link.download = `ID_Card_${member.name.replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error generating ID card:', error);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    const printContent = cardRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>ID Card - ${member.name}</title>
          <style>
            body { 
              margin: 0; 
              display: flex; 
              justify-content: center; 
              align-items: center; 
              min-height: 100vh;
              background: #f5f5f5;
            }
            .card-container {
              width: 3.375in;
              height: 2.125in;
              background: white;
              border-radius: 10px;
              box-shadow: 0 4px 20px rgba(0,0,0,0.15);
              overflow: hidden;
              font-family: system-ui, -apple-system, sans-serif;
            }
            .header {
              background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
              color: white;
              padding: 10px 15px;
              display: flex;
              align-items: center;
              gap: 10px;
            }
            .logo {
              width: 35px;
              height: 35px;
              background: white;
              border-radius: 6px;
              padding: 3px;
            }
            .logo img {
              width: 100%;
              height: 100%;
              object-fit: contain;
            }
            .company-name {
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 0.3px;
            }
            .content {
              padding: 12px 15px;
              display: flex;
              gap: 15px;
            }
            .avatar {
              width: 60px;
              height: 60px;
              border-radius: 50%;
              background: #f0f0f0;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 20px;
              font-weight: 600;
              color: #e74c3c;
              border: 2px solid #e74c3c;
              overflow: hidden;
            }
            .avatar img {
              width: 100%;
              height: 100%;
              object-fit: cover;
            }
            .details {
              flex: 1;
            }
            .name {
              font-size: 14px;
              font-weight: 700;
              color: #1a1a1a;
              margin-bottom: 3px;
            }
            .role {
              font-size: 10px;
              color: #666;
              margin-bottom: 2px;
            }
            .info-row {
              font-size: 9px;
              color: #555;
              margin-top: 3px;
              display: flex;
              gap: 5px;
            }
            .info-label {
              color: #888;
            }
            .footer {
              background: #f8f8f8;
              padding: 6px 15px;
              font-size: 7px;
              color: #666;
              border-top: 1px solid #eee;
              text-align: center;
            }
            @media print {
              body { background: white; }
              .card-container { box-shadow: none; }
            }
          </style>
        </head>
        <body>
          ${printContent.outerHTML}
          <script>
            window.onload = function() {
              window.print();
              window.close();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Employee ID Card</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* ID Card Preview */}
          <div 
            ref={cardRef}
            className="card-container mx-auto"
            style={{
              width: '3.375in',
              height: '2.125in',
              background: 'white',
              borderRadius: '10px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              overflow: 'hidden',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            {/* Header with company branding */}
            <div 
              className="header"
              style={{
                background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
                color: 'white',
                padding: '10px 15px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <div 
                className="logo"
                style={{
                  width: '35px',
                  height: '35px',
                  background: 'white',
                  borderRadius: '6px',
                  padding: '3px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img 
                  src={leapswitchLogo} 
                  alt="Leapswitch Logo"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
              <div 
                className="company-name"
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.3px',
                }}
              >
                {COMPANY_INFO.name}
              </div>
            </div>

            {/* Content */}
            <div 
              className="content"
              style={{
                padding: '12px 15px',
                display: 'flex',
                gap: '15px',
              }}
            >
              {/* Avatar */}
              <div 
                className="avatar"
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: '#fef2f2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  fontWeight: 600,
                  color: '#e74c3c',
                  border: '2px solid #e74c3c',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                {avatarUrl ? (
                  <img 
                    src={avatarUrl} 
                    alt={member.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  getInitials(member.name)
                )}
              </div>

              {/* Details */}
              <div className="details" style={{ flex: 1, minWidth: 0 }}>
                <div 
                  className="name"
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#1a1a1a',
                    marginBottom: '3px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {member.name}
                </div>
                <div 
                  className="role"
                  style={{
                    fontSize: '10px',
                    color: '#666',
                    marginBottom: '2px',
                  }}
                >
                  {member.role} | {member.department}
                </div>
                <div 
                  className="info-row"
                  style={{
                    fontSize: '9px',
                    color: '#555',
                    marginTop: '5px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  <span style={{ color: '#888' }}>Email:</span> {member.email}
                </div>
                {(member as any).phoneNumber && (
                  <div 
                    className="info-row"
                    style={{
                      fontSize: '9px',
                      color: '#555',
                      marginTop: '3px',
                    }}
                  >
                    <span style={{ color: '#888' }}>Phone:</span> {(member as any).phoneNumber}
                  </div>
                )}
                <div 
                  className="info-row"
                  style={{
                    fontSize: '9px',
                    color: '#555',
                    marginTop: '3px',
                  }}
                >
                  <span style={{ color: '#888' }}>Location:</span> {workLocation?.name || 'Not Assigned'}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div 
              className="footer"
              style={{
                background: '#f8f8f8',
                padding: '6px 15px',
                fontSize: '7px',
                color: '#666',
                borderTop: '1px solid #eee',
                textAlign: 'center',
              }}
            >
              {COMPANY_INFO.address} | {COMPANY_INFO.phone}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={handlePrint}>
              <Printer size={16} className="mr-2" />
              Print
            </Button>
            <Button onClick={handleDownload} disabled={downloading}>
              <Download size={16} className="mr-2" />
              {downloading ? 'Generating...' : 'Download PNG'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
