import leapswitchLogo from '@/assets/leapswitch-logo-alt.png';

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 animate-fade-in">
        {/* Logo with pulse animation */}
        <div className="relative">
          <img 
            src={leapswitchLogo} 
            alt="Leapswitch Networks" 
            className="h-16 object-contain dark:brightness-0 dark:invert animate-pulse"
          />
        </div>
        
        {/* Loading bar */}
        <div className="w-48 h-1 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-[#e74c3c] rounded-full animate-loading-bar" />
        </div>
        
        {/* Loading text */}
        <p className="text-sm text-muted-foreground animate-pulse">
          Loading Roster Management...
        </p>
      </div>
    </div>
  );
}