import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Bot, Send, Loader2, Sparkles, RotateCcw, Lightbulb } from 'lucide-react';
import { toast } from 'sonner';
import { TeamMember, Department } from '@/types/roster';
import { MemberRotationState } from '@/types/shiftRules';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIRosterAssistantProps {
  teamMembers: TeamMember[];
  selectedDepartments: string[];
  monthName: string;
  rotationStates: MemberRotationState[];
  publicHolidays: string[];
  weeklyOffPolicy: {
    enabled: boolean;
    weekOffPattern: 'fixed' | 'staggered';
    fixedDays: string[];
    defaultOffDays: number;
  };
  previewAssignments?: { member_id: string; shift_type: string; date: string; department: string }[];
}

const QUICK_PROMPTS = [
  { label: 'Optimize coverage', prompt: 'Analyze the current roster setup and suggest optimizations for better shift coverage across all departments.' },
  { label: 'Check staffing gaps', prompt: 'Are there any staffing shortages or gaps in the current roster configuration? List them by department and shift.' },
  { label: 'Week-off fairness', prompt: 'Review the week-off distribution. Are week-offs fairly distributed across team members? Any improvements?' },
  { label: 'Night shift safety', prompt: 'Check if all night shift transitions have proper rest days. Flag any safety concerns.' },
  { label: 'Setup guide', prompt: 'Guide me step-by-step through setting up the roster for this month. What should I configure first?' },
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-roster-assistant`;

export function AIRosterAssistant({
  teamMembers,
  selectedDepartments,
  monthName,
  rotationStates,
  publicHolidays,
  weeklyOffPolicy,
  previewAssignments,
}: AIRosterAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const buildContext = useCallback(() => {
    const filteredMembers = selectedDepartments.length > 0
      ? teamMembers.filter(m => selectedDepartments.includes(m.department))
      : teamMembers;

    return {
      month: monthName,
      departments: selectedDepartments.length > 0 ? selectedDepartments : undefined,
      teamMembers: filteredMembers.slice(0, 50).map(m => ({
        name: m.name,
        role: m.role,
        department: m.department,
        weekOffEntitlement: m.weekOffEntitlement || 2,
      })),
      rotationStates: rotationStates.slice(0, 50).map(s => ({
        member_id: s.member_id,
        current_shift_type: s.current_shift_type,
        cycle_start_date: s.cycle_start_date,
      })),
      publicHolidays,
      weeklyOffPolicy,
      currentAssignments: previewAssignments?.length || 0,
    };
  }, [teamMembers, selectedDepartments, monthName, rotationStates, publicHolidays, weeklyOffPolicy, previewAssignments]);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: messageText.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    let assistantSoFar = '';

    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: 'assistant', content: assistantSoFar }];
      });
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          context: buildContext(),
        }),
      });

      if (resp.status === 429) {
        toast.error('Rate limit exceeded. Please wait a moment and try again.');
        setIsLoading(false);
        return;
      }
      if (resp.status === 402) {
        toast.error('AI credits exhausted. Please add funds to your workspace.');
        setIsLoading(false);
        return;
      }
      if (!resp.ok || !resp.body) {
        throw new Error('Failed to connect to AI assistant');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      console.error('AI assistant error:', e);
      toast.error('Failed to get AI response. Please try again.');
      // Remove the user message if no response was generated
      if (assistantSoFar === '') {
        setMessages(prev => prev.slice(0, -1));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setInput('');
  };

  return (
    <div className="flex flex-col h-[400px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b mb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h4 className="text-sm font-medium">AI Roster Assistant</h4>
            <p className="text-xs text-muted-foreground">
              {selectedDepartments.length > 0
                ? `${selectedDepartments.join(', ')} • ${monthName}`
                : `All departments • ${monthName}`}
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearChat} className="gap-1 text-xs">
            <RotateCcw className="h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">How can I help with your roster?</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ask about setup, coverage, optimization, or troubleshooting
              </p>
            </div>
            <div className="flex flex-wrap gap-2 max-w-md justify-center">
              {QUICK_PROMPTS.map((qp, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1 h-7"
                  onClick={() => sendMessage(qp.prompt)}
                >
                  <Lightbulb className="h-3 w-3" />
                  {qp.label}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <div className="whitespace-pre-wrap break-words">{msg.content}</div>
              </div>
            </div>
          ))
        )}
        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-3 py-2 text-sm flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-muted-foreground">Thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2 mt-3 pt-3 border-t">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about roster setup, coverage gaps, optimization..."
          className="min-h-[40px] max-h-[80px] resize-none text-sm"
          rows={1}
          disabled={isLoading}
        />
        <Button
          size="icon"
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isLoading}
          className="shrink-0"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
